import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import Modal from '../components/Modal';
import { formatBRL } from '../lib/utils';
import { toast } from 'sonner';
import {
  ShoppingCart, Search, X, Plus, Minus, Trash2, User,
  Scissors, Package, Check, Banknote, Smartphone, CreditCard,
  ChevronRight, UserPlus, AlertTriangle, Copy, MessageCircle, Star,
} from 'lucide-react';
import type { Service, Product, Client } from '../types/db';

/* ─── types ─────────────────────────────────────────────────────── */
type Step = 'idle' | 'client' | 'venda' | 'pagamento' | 'done';
type PayForma = 'dinheiro' | 'pix' | 'debito' | 'credito';

interface CartItem {
  id: string;          // service or product id
  tipo: 'servico' | 'produto';
  nome: string;
  preco: number;
  qtd: number;
  estoque?: number;    // only products
  comissao_percentual?: number;
}

interface VendaState {
  client: Client | null;
  barberId: string | null;
}

/* ─── PDV ────────────────────────────────────────────────────────── */
export default function PDV() {
  const { barbershop, member } = useAuth();
  const { session: cashSession, refresh: refreshCash } = useCash();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('idle');
  const [vendaState, setVendaState] = useState<VendaState>({ client: null, barberId: null });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [svcSearch, setSvcSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [cancelModal, setCancelModal] = useState(false);
  const [doneInfo, setDoneInfo] = useState<{ total: number; telefone: string } | null>(null);

  // barbers
  const { data: barbers } = useQuery({
    queryKey: ['barbers-pdv', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('*')
        .eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome_exibicao');
      return data ?? [];
    },
  });

  // services & products
  const { data: services } = useQuery({
    queryKey: ['svc-pdv', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*')
        .eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return (data ?? []) as Service[];
    },
  });

  const { data: products, refetch: refetchProducts } = useQuery({
    queryKey: ['prod-pdv', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*')
        .eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return (data ?? []) as Product[];
    },
  });

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.preco * i.qtd, 0), [cart]);
  const total    = Math.max(0, subtotal - desconto);

  /* Cart helpers */
  const addSvc = (s: Service) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === s.id && i.tipo === 'servico');
      if (ex) return prev.map(i => i.id === s.id && i.tipo === 'servico' ? { ...i, qtd: i.qtd + 1 } : i);
      return [...prev, { id: s.id, tipo: 'servico', nome: s.nome, preco: Number(s.valor), qtd: 1 }];
    });
  };

  const addProd = (p: Product) => {
    const inCart = cart.find(i => i.id === p.id && i.tipo === 'produto');
    const currentQtd = inCart?.qtd ?? 0;
    if (currentQtd >= p.estoque) return toast.error('Estoque insuficiente');
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id && i.tipo === 'produto');
      if (ex) return prev.map(i => i.id === p.id && i.tipo === 'produto' ? { ...i, qtd: i.qtd + 1 } : i);
      // Produto nunca ganha comissão, então comissao_percentual fica 0 ou undefined
      return [...prev, { id: p.id, tipo: 'produto', nome: p.nome, preco: Number(p.preco), qtd: 1, estoque: p.estoque, comissao_percentual: 0 }];
    });
  };

  const changeQtd = (id: string, tipo: 'servico' | 'produto', delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id || i.tipo !== tipo) return i;
      if (tipo === 'produto' && delta > 0 && i.qtd >= (i.estoque ?? 0)) {
        toast.error('Estoque insuficiente'); return i;
      }
      return { ...i, qtd: Math.max(1, i.qtd + delta) };
    }));
  };

  const removeItem = (id: string, tipo: 'servico' | 'produto') =>
    setCart(prev => prev.filter(i => !(i.id === id && i.tipo === tipo)));

  const resetAll = () => {
    setStep('idle');
    setVendaState({ client: null, barberId: null });
    setCart([]);
    setDesconto(0);
    setSvcSearch('');
    setProdSearch('');
  };

  /* Finalize sale */
  const finalize = async (forma: PayForma, subForma?: 'credito' | 'debito', pagoValor?: number) => {
    if (!barbershop || !member || !vendaState.barberId) return;
    const formaFinal = subForma ?? forma;

    if (!cashSession) {
      toast.error('Abra o caixa antes de registrar uma venda');
      return;
    }

    // 1. Create order as 'aberta'
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      barbershop_id: barbershop.id,
      client_id: vendaState.client?.id,
      barber_id: vendaState.barberId,
      total: subtotal, // Original total without discount/tip (those are params to close_order)
      desconto: desconto,
      status: 'aberta',
      cash_session_id: cashSession.id,
    }).select('id').single();

    if (orderErr) return toast.error(orderErr.message);

    // 2. Save items
    for (const item of cart) {
      let comissao_v = 0;
      let perc = 0;
      
      if (item.tipo === 'servico') {
        const { data: b } = await supabase.from('barbers').select('comissao_padrao').eq('id', vendaState.barberId).single();
        perc = b?.comissao_padrao ?? 50;
        comissao_v = (item.preco * item.qtd * perc) / 100;
      }
        
      await supabase.from('order_items').insert({
        order_id: order.id,
        tipo: item.tipo,
        ref_id: item.id,
        descricao: item.nome,
        qtd: item.qtd,
        valor_unit: item.preco,
        valor_total: item.preco * item.qtd,
        comissao_percentual: perc,
        comissao_valor: comissao_v
      });
    }

    // 3. Call close_order RPC (this handles stock, cash movement, and loyalty)
    const { error: closeErr } = await supabase.rpc('close_order', {
      p_order_id: order.id,
      p_forma: formaFinal,
      p_desconto: desconto,
      p_gorjeta: 0 // PDV avulso doesn't have tip field yet
    });

    if (closeErr) return toast.error(closeErr.message);

    await refreshCash();
    qc.invalidateQueries({ queryKey: ['prod-pdv'] });
    qc.invalidateQueries({ queryKey: ['clients'] }); // Refresh loyalty counters
    refetchProducts();

    toast.success(`Venda de ${formatBRL(total)} registrada`);
    setDoneInfo({ total, telefone: vendaState.client?.telefone ?? '' });
    setStep('done');
  };

  /* ── IDLE ─────────────────────────────────────────────────────── */
  if (step === 'idle') return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col items-center gap-6 pt-16">
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
        style={{ background: 'var(--bg-hover)' }}>
        <ShoppingCart size={40} className="text-muted" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">PDV — Venda Avulsa</h1>
        <p className="text-muted text-sm">Registre vendas diretas sem agendamento.</p>
        {!cashSession && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg text-sm text-amber-400"
            style={{ background: 'rgba(245,158,11,0.1)' }}>
            <AlertTriangle size={14} /> Caixa fechado — abra o caixa para registrar vendas
          </div>
        )}
      </div>
      <button className="btn-primary px-8 py-3 text-base gap-2" onClick={() => setStep('client')}>
        <Plus size={18} /> Iniciar venda
      </button>
    </div>
  );

  /* ── DONE ─────────────────────────────────────────────────────── */
  if (step === 'done' && doneInfo) return (
    <div className="p-8 max-w-md mx-auto flex flex-col items-center gap-6 pt-16">
      <div className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: 'rgb(6 78 59 / 0.3)' }}>
        <Check size={32} className="text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold">{formatBRL(doneInfo.total)}</p>
        <p className="text-muted text-sm mt-1">venda registrada com sucesso</p>
      </div>
      {doneInfo.telefone && (
        <a href={`https://wa.me/${doneInfo.telefone.replace(/\D/g, '')}?text=${encodeURIComponent('Obrigado pela compra! Até a próxima!')}`}
          target="_blank" rel="noreferrer"
          className="btn-outline w-full gap-2 flex items-center justify-center">
          <MessageCircle size={15} /> Enviar mensagem ao cliente
        </a>
      )}
      <button className="btn-primary w-full" onClick={resetAll}>Nova venda</button>
    </div>
  );

  /* ── CLIENT PICKER ────────────────────────────────────────────── */
  if (step === 'client') return (
    <div className="p-8 max-w-2xl mx-auto">
      <StepHeader step={1} total={4} title="Identificar cliente" onCancel={() => setCancelModal(true)} />
      <ClientPicker
        barbershopId={barbershop?.id ?? ''}
        onSelect={c => { setVendaState({ ...vendaState, client: c }); setStep('barber'); }}
        onSkip={() => { setVendaState({ ...vendaState, client: null }); setStep('barber'); }}
      />
      <CancelModal open={cancelModal} onClose={() => setCancelModal(false)} onConfirm={resetAll} />
    </div>
  );

  /* ── BARBER PICKER ────────────────────────────────────────────── */
  if (step === 'barber') return (
    <div className="p-8 max-w-2xl mx-auto">
      <StepHeader step={2} total={4} title="Quem realizou o atendimento?" onCancel={() => setCancelModal(true)} />
      <div className="grid grid-cols-2 gap-3 max-w-md">
        {(barbers ?? []).map(b => (
          <button key={b.id} onClick={() => { setVendaState({ ...vendaState, barberId: b.id }); setStep('venda'); }}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-ink-800 hover:bg-ink-800/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center text-lg font-bold">
              {b.nome_exibicao.charAt(0)}
            </div>
            <span className="font-medium">{b.nome_exibicao}</span>
          </button>
        ))}
      </div>
      <button className="btn-ghost mt-6" onClick={() => setStep('client')}>Voltar</button>
      <CancelModal open={cancelModal} onClose={() => setCancelModal(false)} onConfirm={resetAll} />
    </div>
  );

  /* ── VENDA (cart + catalog) ─────────────────────────────────────  */
  if (step === 'venda') {
    const filtSvc  = (services ?? []).filter(s => s.nome.toLowerCase().includes(svcSearch.toLowerCase()));
    const filtProd = (products ?? []).filter(p => p.nome.toLowerCase().includes(prodSearch.toLowerCase()));
    const currentBarber = barbers?.find(b => b.id === vendaState.barberId);

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <StepHeader step={3} total={4}
          title={vendaState.client ? `Venda — ${vendaState.client.nome}` : 'Venda — balcão'}
          onCancel={() => setCancelModal(true)} />
        
        <div className="flex flex-wrap items-center gap-2 mb-6 px-4 py-2 bg-ink-900/50 rounded-lg border border-ink-800 w-fit">
          <div className="flex items-center gap-2 pr-2 border-r border-ink-800">
            <User size={14} className="text-ink-500" />
            <span className="text-xs text-ink-300">Atendimento por: <span className="text-ink-50 font-medium">{currentBarber?.nome_exibicao}</span></span>
            <button onClick={() => setStep('barber')} className="text-[10px] text-ink-500 hover:text-ink-300 underline ml-2">trocar</button>
          </div>
          {vendaState.client && (
            <div className="flex items-center gap-2 pl-1">
              {(() => {
                const meta = barbershop?.fidelidade_meta ?? 10;
                const count = vendaState.client.fidelidade_contagem ?? 0;
                const isProximoGratis = count >= (meta - 1);
                return (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${isProximoGratis ? 'bg-emerald-400/20 text-emerald-400 ring-1 ring-emerald-400/30 animate-pulse' : 'bg-ink-800 text-ink-400'}`}>
                    <Star size={10} fill={isProximoGratis ? 'currentColor' : 'none'} />
                    {isProximoGratis ? 'PRÓXIMO É GRÁTIS!' : `Fidelidade: ${count}/${meta}`}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Catalog */}
          <div className="lg:col-span-2 space-y-4">
            {/* Services */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <Scissors size={15} className="text-muted" />
                <span className="font-medium text-sm">Serviços</span>
                <div className="ml-auto flex items-center gap-2 flex-1 max-w-48">
                  <Search size={13} className="text-muted shrink-0" />
                  <input className="bg-transparent text-sm focus:outline-none w-full"
                    placeholder="Buscar…" value={svcSearch} onChange={e => setSvcSearch(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
                {filtSvc.map(s => {
                  const inCart = cart.find(i => i.id === s.id && i.tipo === 'servico');
                  return (
                    <button key={s.id} onClick={() => addSvc(s)}
                      className={`text-left p-3 rounded-lg border transition-all hover:scale-[1.01] active:scale-[0.99] ${inCart ? 'ring-1' : ''}`}
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--bg-hover)',
                        ...(inCart ? { '--tw-ring-color': 'var(--text)' } as any : {}),
                      }}>
                      <div className="text-sm font-medium truncate">{s.nome}</div>
                      <div className="text-xs text-muted mt-0.5">{formatBRL(Number(s.valor))}</div>
                      {inCart && <div className="text-[10px] text-emerald-400 mt-1">× {inCart.qtd} no carrinho</div>}
                    </button>
                  );
                })}
                {filtSvc.length === 0 && <div className="col-span-3 py-6 text-center text-muted text-sm">Nenhum serviço encontrado</div>}
              </div>
            </div>

            {/* Products */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                <Package size={15} className="text-muted" />
                <span className="font-medium text-sm">Produtos</span>
                <div className="ml-auto flex items-center gap-2 flex-1 max-w-48">
                  <Search size={13} className="text-muted shrink-0" />
                  <input className="bg-transparent text-sm focus:outline-none w-full"
                    placeholder="Buscar…" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
                {filtProd.map(p => {
                  const inCart = cart.find(i => i.id === p.id && i.tipo === 'produto');
                  const sem = p.estoque <= 0;
                  return (
                    <button key={p.id} onClick={() => addProd(p)} disabled={sem}
                      className={`text-left p-3 rounded-lg border transition-all disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99] ${inCart ? 'ring-1' : ''}`}
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--bg-hover)',
                        ...(inCart ? { '--tw-ring-color': 'var(--text)' } as any : {}),
                      }}>
                      {p.foto_url && <img src={p.foto_url} alt={p.nome} className="w-full h-20 object-cover rounded-md mb-2" />}
                      <div className="text-sm font-medium truncate">{p.nome}</div>
                      <div className="text-xs text-muted mt-0.5">{formatBRL(Number(p.preco))}</div>
                      <div className={`text-[10px] mt-0.5 ${p.estoque <= p.estoque_min ? 'text-amber-400' : 'text-muted'}`}>
                        {sem ? 'Sem estoque' : `${p.estoque} disponível`}
                      </div>
                      {inCart && <div className="text-[10px] text-emerald-400 mt-1">× {inCart.qtd} no carrinho</div>}
                    </button>
                  );
                })}
                {filtProd.length === 0 && <div className="col-span-3 py-6 text-center text-muted text-sm">Nenhum produto encontrado</div>}
              </div>
            </div>
          </div>

          {/* Cart sidebar */}
          <div className="card p-4 space-y-3 h-fit lg:sticky lg:top-4">
            <div className="flex items-center gap-2 font-medium">
              <ShoppingCart size={16} />
              <span>Carrinho</span>
              {cart.length > 0 && (
                <span className="ml-auto text-xs text-muted">{cart.reduce((s, i) => s + i.qtd, 0)} item(ns)</span>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Selecione serviços ou produtos</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {cart.map(item => (
                  <div key={`${item.tipo}-${item.id}`} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{item.nome}</div>
                      <div className="text-xs text-muted">{formatBRL(item.preco)}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => changeQtd(item.id, item.tipo, -1)} className="btn-ghost p-1"><Minus size={11} /></button>
                      <span className="text-sm w-4 text-center">{item.qtd}</span>
                      <button onClick={() => changeQtd(item.id, item.tipo, 1)} className="btn-ghost p-1"><Plus size={11} /></button>
                      <button onClick={() => removeItem(item.id, item.tipo)} className="btn-ghost p-1 text-red-400"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <>
                <hr style={{ borderColor: 'var(--border)' }} />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted">
                    <span>Desconto</span>
                    <input className="input w-24 text-right text-sm py-1" type="number" step="0.01" min={0}
                      value={desconto || ''} placeholder="0,00"
                      onChange={e => setDesconto(+e.target.value)} />
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span>Total</span><span>{formatBRL(total)}</span>
                  </div>
                </div>
                <button className="btn-primary w-full gap-1.5" onClick={() => setStep('pagamento')}>
                  Ir para pagamento <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        <CancelModal open={cancelModal} onClose={() => setCancelModal(false)} onConfirm={resetAll} />
      </div>
    );
  }

  const { data: pixMethod } = useQuery({
    queryKey: ['pix-method', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('payment_methods').select('*')
        .eq('barbershop_id', barbershop!.id).eq('tipo', 'pix').eq('ativo', true).maybeSingle();
      return data;
    }
  });

  /* ── PAGAMENTO ────────────────────────────────────────────────── */
  if (step === 'pagamento') return (
    <div className="p-8 max-w-xl mx-auto">
      <StepHeader step={3} total={3} title="Forma de pagamento" onCancel={() => setCancelModal(true)} />
      <PaymentStep
        total={total}
        pixMethod={pixMethod}
        onBack={() => setStep('venda')}
        onConfirm={finalize}
      />
      <CancelModal open={cancelModal} onClose={() => setCancelModal(false)} onConfirm={resetAll} />
    </div>
  );

  return null;
}

import { maskPhone, isValidPhone } from '../lib/utils';

/* ─── ClientPicker ───────────────────────────────────────────────── */
function ClientPicker({ barbershopId, onSelect, onSkip }: {
  barbershopId: string; onSelect: (c: Client) => void; onSkip: () => void;
}) {
  const [search, setSearch] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTel, setNewTel] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients-pdv', barbershopId, search],
    enabled: !!barbershopId && search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*')
        .eq('barbershop_id', barbershopId)
        .ilike('nome', `%${search}%`)
        .order('nome').limit(8);
      return (data ?? []) as Client[];
    },
  });

  const createClient = async () => {
    if (!newName.trim()) return;
    if (!isValidPhone(newTel)) {
      return toast.error('O telefone deve ter exatamente 11 dígitos: (DD) 9 XXXX-XXXX');
    }
    setSaving(true);
    const { data, error } = await supabase.from('clients').insert({
      barbershop_id: barbershopId,
      nome: newName.trim(),
      telefone: newTel.replace(/\D/g, ''),
    }).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Cliente cadastrado');
    onSelect(data as Client);
  };

  if (createMode) return (
    <div className="card p-6 space-y-4 max-w-md">
      <div className="flex items-center gap-3 mb-2">
        <UserPlus size={18} className="text-muted" />
        <span className="font-medium">Cadastrar cliente</span>
      </div>
      <div>
        <label className="label">Nome *</label>
        <input className="input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Nome completo" />
      </div>
      <div>
        <label className="label">Telefone (Celular) *</label>
        <input 
          className="input" 
          value={newTel} 
          onChange={e => setNewTel(maskPhone(e.target.value))} 
          placeholder="(85) 99999-9999" 
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button className="btn-outline flex-1" onClick={() => setCreateMode(false)}>Voltar</button>
        <button className="btn-primary flex-1" disabled={!newName.trim() || saving}
          onClick={createClient}>{saving ? 'Salvando…' : 'Cadastrar e selecionar'}</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-md">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" autoFocus placeholder="Buscar cliente pelo nome…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"><X size={14} /></button>}
      </div>

      {search.length >= 2 && (
        <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {(!clients || clients.length === 0) ? (
            <div className="p-4 text-center text-sm text-muted">Nenhum cliente encontrado</div>
          ) : (
            clients.map(c => (
              <button key={c.id} onClick={() => onSelect(c)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hover-soft transition-colors text-left">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'var(--bg-hover)' }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{c.nome}</div>
                  {c.telefone && <div className="text-xs text-muted">{c.telefone}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <button className="btn-outline gap-2" onClick={() => setCreateMode(true)}>
          <UserPlus size={15} /> Cadastrar novo cliente
        </button>
        <button className="btn-ghost gap-2 text-muted" onClick={onSkip}>
          <User size={15} /> Continuar sem identificar cliente
        </button>
      </div>
    </div>
  );
}

/* ─── PaymentStep ────────────────────────────────────────────────── */
function PaymentStep({ total, pixMethod, onBack, onConfirm }: {
  total: number; pixMethod: any;
  onBack: () => void;
  onConfirm: (forma: PayForma, subForma?: 'credito' | 'debito', pagoValor?: number) => void;
}) {
  const [forma, setForma] = useState<'dinheiro' | 'pix' | 'cartao' | null>(null);
  const [subForma, setSubForma] = useState<'credito' | 'debito' | null>(null);
  const [pagou, setPagou] = useState(total);
  const [pixOk, setPixOk] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const troco = forma === 'dinheiro' ? Math.max(0, pagou - total) : 0;

  const canConfirm = () => {
    if (!forma) return false;
    if (forma === 'pix') return pixOk;
    if (forma === 'cartao') return !!subForma;
    return true;
  };

  const confirm = () => {
    if (!forma) return;
    if (forma === 'dinheiro') onConfirm('dinheiro', undefined, pagou);
    else if (forma === 'pix') onConfirm('pix');
    else if (forma === 'cartao' && subForma) onConfirm(subForma, subForma);
  };

  return (
    <div className="space-y-5">
      <div className="card p-4 flex justify-between items-center">
        <span className="text-muted text-sm">Total a cobrar</span>
        <span className="text-3xl font-semibold">{formatBRL(total)}</span>
      </div>

      {/* Forma selector */}
      <div>
        <label className="label mb-3">Selecione a forma de pagamento</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'dinheiro' as const, label: 'Dinheiro', icon: Banknote },
            { key: 'pix'      as const, label: 'PIX',      icon: Smartphone },
            { key: 'cartao'   as const, label: 'Cartão',   icon: CreditCard },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setForma(key); setSubForma(null); setPixOk(false); }}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border transition-all ${forma === key ? 'font-medium' : 'border-transparent hover:bg-hover-soft'}`}
              style={forma === key ? { borderColor: 'var(--text)', background: 'var(--bg-hover)' } : { borderColor: 'var(--border)' }}>
              <Icon size={24} />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dinheiro */}
      {forma === 'dinheiro' && (
        <div className="space-y-3">
          <div>
            <label className="label">Cliente pagou (R$)</label>
            <input className="input text-2xl font-semibold text-center py-4" type="number" step="0.01" min={total}
              value={pagou || ''} onChange={e => setPagou(+e.target.value)} autoFocus />
          </div>
          {troco > 0 && (
            <div className="flex justify-between items-center p-4 rounded-xl font-semibold text-lg"
              style={{ background: 'rgb(6 78 59 / 0.2)' }}>
              <span>Troco</span>
              <span className="text-emerald-400">{formatBRL(troco)}</span>
            </div>
          )}
        </div>
      )}

      {/* PIX */}
      {forma === 'pix' && (
        <div className="space-y-3">
          {pixMethod?.pix_key && (
            <div className="p-4 rounded-xl border border-border bg-ink-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted uppercase font-bold tracking-widest">Chave PIX</span>
                <button onClick={() => { navigator.clipboard.writeText(pixMethod.pix_key); toast.success('Copiada!'); }}
                  className="text-ink-400 hover:text-ink-50 flex items-center gap-1 text-[10px] uppercase font-bold">
                  <Copy size={12} /> Copiar
                </button>
              </div>
              <div className="text-lg font-mono text-center break-all bg-black/20 p-2 rounded border border-ink-800">
                {pixMethod.pix_key}
              </div>
              
              {pixMethod.qr_code_url && (
                <button 
                  onClick={() => setShowQR(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 p-3 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                >
                  <Smartphone size={18} /> Abrir QR Code para Pagamento
                </button>
              )}
            </div>
          )}

          {!pixMethod?.pix_key && (
            <div className="p-4 rounded-xl border border-dashed border-ink-800 text-center text-xs text-muted">
              Nenhuma chave PIX configurada nas Formas de Pagamento.
            </div>
          )}

          <label className="flex items-center gap-3 p-4 rounded-xl cursor-pointer hover:bg-hover-soft transition-colors" style={{ background: 'var(--bg-hover)' }}>
            <input type="checkbox" checked={pixOk} onChange={e => setPixOk(e.target.checked)} className="w-4 h-4 rounded border-border bg-ink-950 text-emerald-500 focus:ring-emerald-500" />
            <span className="text-sm font-medium">Confirmo que recebi o PIX de {formatBRL(total)}</span>
          </label>

          <Modal open={showQR} onClose={() => setShowQR(false)} title="QR Code PIX">
            <div className="flex flex-col items-center gap-6 p-4">
              <div className="bg-white p-4 rounded-2xl">
                <img src={pixMethod?.qr_code_url} alt="QR Code PIX" className="w-64 h-64 object-contain" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{formatBRL(total)}</p>
                <p className="text-xs text-muted mt-1 uppercase tracking-widest">{pixMethod?.pix_key}</p>
              </div>
              <button className="btn-primary w-full" onClick={() => setShowQR(false)}>Fechar</button>
            </div>
          </Modal>
        </div>
      )}

      {/* Cartão — sub-forma */}
      {forma === 'cartao' && (
        <div>
          <label className="label mb-3">Tipo de cartão</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'credito' as const, label: 'Crédito' },
              { key: 'debito'  as const, label: 'Débito' },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setSubForma(key)}
                className={`py-4 rounded-xl border text-sm font-medium transition-all ${subForma === key ? '' : 'border-transparent hover:bg-hover-soft text-muted'}`}
                style={subForma === key ? { borderColor: 'var(--text)', background: 'var(--bg-hover)' } : { borderColor: 'var(--border)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button className="btn-outline flex-1" onClick={onBack}>Voltar</button>
        <button className="btn-primary flex-1" onClick={confirm} disabled={!canConfirm()}>
          Confirmar venda
        </button>
      </div>
    </div>
  );
}

/* ─── helpers ────────────────────────────────────────────────────── */
function StepHeader({ step, total, title, onCancel }: {
  step: number; total: number; title: string; onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="text-xs text-muted mb-0.5">Passo {step} de {total}</div>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <button onClick={onCancel} className="btn-ghost gap-1.5 text-sm text-muted">
        <X size={14} /> Cancelar
      </button>
    </div>
  );
}

function CancelModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Cancelar venda?">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm">Os itens do carrinho serão descartados.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline flex-1" onClick={onClose}>Continuar venda</button>
          <button className="flex-1 btn inline-flex items-center justify-center"
            style={{ background: 'rgb(220 38 38)', color: 'white' }} onClick={onConfirm}>
            Cancelar venda
          </button>
        </div>
      </div>
    </Modal>
  );
}
