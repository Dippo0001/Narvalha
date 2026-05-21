import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import Modal from '../components/Modal';
import { formatBRL } from '../lib/utils';
import { toast } from 'sonner';
import {
  Trash2, Search, X, Check, Copy, MessageCircle,
  Scissors, Package, Banknote, Smartphone, CreditCard, Shuffle, AlertTriangle, Star,
} from 'lucide-react';
import type { OrderItem, Service, Product, CardBrand } from '../types/db';

const STORAGE_KEY = (id: string) => `pos_draft_${id}`;
type Forma = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'misto';

export default function POS() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { barbershop, member } = useAuth();
  const { session: cashSession } = useCash();

  const [desconto, setDesconto] = useState(0);
  const [gorjeta, setGorjeta] = useState(0);
  const [payModal, setPayModal] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [postModal, setPostModal] = useState<{ total: number; telefone: string } | null>(null);
  const [svcSearch, setSvcSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [addingSvc, setAddingSvc] = useState(false);
  const [addingProd, setAddingProd] = useState(false);

  const { data: order } = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('orders')
        .select('*, clients(nome,telefone,tags,aniversario,observacoes), barbers(nome_exibicao,comissao_padrao)')
        .eq('id', id!).maybeSingle();
      return data as any;
    },
  });

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ['order-items', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', id!).order('created_at');
      return (data ?? []) as OrderItem[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ['svc-pos', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return (data ?? []) as Service[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['prod-pos', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return (data ?? []) as Product[];
    },
  });

  const { data: cardBrands } = useQuery({
    queryKey: ['card-brands-pos', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('card_brands').select('*').eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return (data ?? []) as CardBrand[];
    },
  });

  // Restore draft from localStorage
  useEffect(() => {
    if (!id) return;
    const draft = localStorage.getItem(STORAGE_KEY(id));
    if (draft) {
      try {
        const { desconto: d, gorjeta: g } = JSON.parse(draft);
        if (d) setDesconto(d);
        if (g) setGorjeta(g);
      } catch { /* ignore */ }
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    localStorage.setItem(STORAGE_KEY(id), JSON.stringify({ desconto, gorjeta }));
  }, [id, desconto, gorjeta]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); setPayModal(true); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); setAddingSvc(v => !v); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); setAddingProd(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const subtotal = useMemo(() => (items ?? []).reduce((s, i) => s + Number(i.valor_total), 0), [items]);
  const total = Math.max(0, subtotal - desconto + gorjeta);

  const updateOrderTotals = async (sub: number) => {
    await supabase.from('orders').update({ total: sub, desconto }).eq('id', id!);
  };

  const addService = async (s: Service) => {
    await supabase.from('order_items').insert({
      order_id: id, tipo: 'servico', ref_id: s.id, descricao: s.nome,
      qtd: 1, valor_unit: s.valor, valor_total: s.valor,
      comissao_percentual: 0, comissao_valor: 0,
    });
    refetchItems();
    updateOrderTotals(subtotal + Number(s.valor));
    setAddingSvc(false);
    setSvcSearch('');
  };

  const addProduct = async (p: Product) => {
    if (p.estoque <= 0) return toast.error('Sem estoque');
    await supabase.from('order_items').insert({
      order_id: id, tipo: 'produto', ref_id: p.id, descricao: p.nome,
      qtd: 1, valor_unit: p.preco, valor_total: p.preco,
      comissao_percentual: p.comissao_percentual, comissao_valor: 0,
    });
    refetchItems();
    updateOrderTotals(subtotal + Number(p.preco));
    setAddingProd(false);
    setProdSearch('');
  };

  const removeItem = async (item: OrderItem) => {
    await supabase.from('order_items').delete().eq('id', item.id);
    refetchItems();
    updateOrderTotals(subtotal - Number(item.valor_total));
  };

  const cancelOrder = async () => {
    await supabase.from('orders').update({ status: 'cancelada' }).eq('id', id!);
    localStorage.removeItem(STORAGE_KEY(id!));
    toast('Comanda cancelada');
    nav('/agenda');
  };

  const finalize = async (forma: Forma, mistoPayments?: { forma: string; valor: number }[], bandeiraTaxa?: number) => {
    if (!items?.length) return toast.error('Adicione itens à comanda');
    if (!order) return;
    if (!cashSession) return toast.error('Caixa fechado — abra o caixa antes de finalizar a venda');

    const barberId = order.barber_id;
    const comissaoPadrao = Number(order.barbers?.comissao_padrao ?? 50);
    // Card brand fee deduction: commission is applied on the net received amount
    const fatorLiquido = bandeiraTaxa ? 1 - bandeiraTaxa / 100 : 1;

    const svcIds = items.filter(i => i.tipo === 'servico').map(i => i.ref_id).filter(Boolean) as string[];
    const { data: overrides } = await supabase.from('service_commissions').select('*')
      .eq('barber_id', barberId)
      .in('service_id', svcIds.length ? svcIds : ['00000000-0000-0000-0000-000000000000']);

    for (const it of items) {
      let pct = it.comissao_percentual;
      if (it.tipo === 'servico') {
        const ov = (overrides ?? []).find((o: any) => o.service_id === it.ref_id);
        pct = Number(ov?.percentual ?? comissaoPadrao);
      }
      const valorLiquido = Number(it.valor_total) * fatorLiquido;
      const val = (valorLiquido * pct) / 100;
      await supabase.from('order_items').update({ comissao_percentual: pct, comissao_valor: val }).eq('id', it.id);
    }

    await supabase.from('orders').update({ total: subtotal, desconto, gorjeta }).eq('id', id!);

    const { error } = await supabase.rpc('close_order', {
      p_order_id: id,
      p_forma: forma === 'misto' ? (mistoPayments?.[0]?.forma ?? 'dinheiro') : forma,
      p_gorjeta: gorjeta,
      p_desconto: desconto,
    });
    if (error) return toast.error(error.message);

    // For misto: record second payment as separate cash movement
    if (forma === 'misto' && mistoPayments && mistoPayments.length === 2 && cashSession) {
      const second = mistoPayments[1];
      await supabase.from('cash_movements').insert({
        barbershop_id: barbershop!.id,
        cash_session_id: cashSession.id,
        tipo: 'entrada',
        categoria: 'venda',
        descricao: `Comanda #${id!.slice(0, 8)} (${second.forma})`,
        valor: second.valor,
        forma_pagamento: second.forma,
        ref_order_id: id,
        data: new Date().toISOString(),
        responsavel_id: member?.id ?? null,
      });
    }

    localStorage.removeItem(STORAGE_KEY(id!));
    qc.invalidateQueries({ queryKey: ['order', id] });
    toast.success(`Venda finalizada · ${formatBRL(total)}`);
    setPayModal(false);
    setPostModal({ total, telefone: order.clients?.telefone ?? '' });
  };

  if (!order) return <div className="p-8 text-muted text-sm">Carregando…</div>;
  if (order.status === 'fechada') return <OrderClosed order={order} total={total} />;

  const filteredSvc = (services ?? []).filter(s => s.nome.toLowerCase().includes(svcSearch.toLowerCase()));
  const filteredProd = (products ?? []).filter(p => p.nome.toLowerCase().includes(prodSearch.toLowerCase()));
  const comissaoTotal = (items ?? []).reduce((s, i) => s + Number(i.comissao_valor ?? 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Atendimento</h1>
          {order.clients && (
            <p className="text-sm text-muted">
              {order.clients.nome}{order.barbers ? ` · ${order.barbers.nome_exibicao}` : ''}
            </p>
          )}
        </div>
        <button onClick={() => setCancelConfirm(true)} className="btn-ghost text-red-400 gap-1.5 text-sm">
          <X size={14} /> Cancelar comanda
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Client card */}
        {order.clients && (
          <div className="card p-5 space-y-3 lg:col-span-1 h-fit">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'var(--bg-hover)' }}>
                {order.clients.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{order.clients.nome}</span>
                  {(() => {
                    const meta = barbershop?.fidelidade_meta ?? 10;
                    const count = order.clients.fidelidade_contagem ?? 0;
                    const isProximoGratis = count >= (meta - 1);
                    return (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${isProximoGratis ? 'bg-emerald-400/20 text-emerald-400 ring-1 ring-emerald-400/30 animate-pulse' : 'bg-ink-800 text-ink-400'}`}>
                        <Star size={7} fill={isProximoGratis ? 'currentColor' : 'none'} />
                        {isProximoGratis ? 'GRÁTIS' : `${count}/${meta}`}
                      </div>
                    );
                  })()}
                </div>
                <div className="text-xs text-muted">{order.clients.telefone || 'Sem telefone'}</div>
              </div>
            </div>
            {order.clients.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {order.clients.tags.map((t: string) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{t}</span>
                ))}
              </div>
            )}
            {order.clients.observacoes && (
              <p className="text-xs text-muted border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                {order.clients.observacoes}
              </p>
            )}
          </div>
        )}

        {/* Items */}
        <div className={`card p-5 ${order.clients ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">Itens da comanda</h3>
          {(!items || items.length === 0) && (
            <p className="text-sm text-muted py-6 text-center">Nenhum item. Adicione abaixo.</p>
          )}
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {(items ?? []).filter(i => i.tipo === 'servico').length > 0 && (
              <div className="pb-3">
                <div className="text-xs text-muted flex items-center gap-1.5 mb-2"><Scissors size={12} /> Serviços</div>
                {(items ?? []).filter(i => i.tipo === 'servico').map(it => (
                  <ItemRow key={it.id} item={it} onRemove={() => removeItem(it)} />
                ))}
              </div>
            )}
            {(items ?? []).filter(i => i.tipo === 'produto').length > 0 && (
              <div className="pt-3">
                <div className="text-xs text-muted flex items-center gap-1.5 mb-2"><Package size={12} /> Produtos</div>
                {(items ?? []).filter(i => i.tipo === 'produto').map(it => (
                  <ItemRow key={it.id} item={it} onRemove={() => removeItem(it)} />
                ))}
              </div>
            )}
          </div>

          {/* Add service */}
          <div className="mt-5 space-y-2">
            {!addingSvc ? (
              <button onClick={() => setAddingSvc(true)} className="btn-outline w-full gap-1.5">
                <Scissors size={14} /> Adicionar serviço
                <span className="text-muted text-xs ml-auto">Ctrl+S</span>
              </button>
            ) : (
              <SearchDropdown
                placeholder="Buscar serviço…"
                items={filteredSvc}
                search={svcSearch}
                onSearch={setSvcSearch}
                onClose={() => { setAddingSvc(false); setSvcSearch(''); }}
                renderItem={(s: Service) => (
                  <button key={s.id} onClick={() => addService(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-hover-soft transition-colors flex justify-between text-sm">
                    <span>{s.nome}</span>
                    <span className="text-muted">{formatBRL(Number(s.valor))}</span>
                  </button>
                )}
              />
            )}
            {!addingProd ? (
              <button onClick={() => setAddingProd(true)} className="btn-outline w-full gap-1.5">
                <Package size={14} /> Adicionar produto
                <span className="text-muted text-xs ml-auto">Ctrl+P</span>
              </button>
            ) : (
              <SearchDropdown
                placeholder="Buscar produto…"
                items={filteredProd}
                search={prodSearch}
                onSearch={setProdSearch}
                onClose={() => { setAddingProd(false); setProdSearch(''); }}
                renderItem={(p: Product) => (
                  <button key={p.id} onClick={() => addProduct(p)} disabled={p.estoque <= 0}
                    className="w-full text-left px-4 py-2.5 hover:bg-hover-soft transition-colors flex justify-between text-sm disabled:opacity-40">
                    <span>{p.nome}</span>
                    <span className="text-muted">{formatBRL(Number(p.preco))} · {p.estoque} un</span>
                  </button>
                )}
              />
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="card p-5 space-y-4 h-fit lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <h3 className="text-sm font-medium text-muted uppercase tracking-wide">Totais</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Desconto</span>
              <input className="input w-28 text-right text-sm py-1.5" type="number" step="0.01" min={0}
                value={desconto || ''} placeholder="0,00" onChange={e => setDesconto(+e.target.value)} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Gorjeta</span>
              <input className="input w-28 text-right text-sm py-1.5" type="number" step="0.01" min={0}
                value={gorjeta || ''} placeholder="0,00" onChange={e => setGorjeta(+e.target.value)} />
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>
            {comissaoTotal > 0 && (
              <div className="text-xs text-muted">
                Comissão ({order.barbers?.nome_exibicao}): {formatBRL(comissaoTotal)}
              </div>
            )}
          </div>
          <button onClick={() => setPayModal(true)} disabled={!items?.length} className="btn-primary w-full gap-2">
            Finalizar pagamento
            <span className="text-xs opacity-60">F9</span>
          </button>
        </div>
      </div>

      <Modal open={payModal} onClose={() => setPayModal(false)} title={`Finalizar · ${formatBRL(total)}`} wide>
        <PaymentModal total={total} pixKey={barbershop?.telefone ?? ''} brands={cardBrands ?? []} onConfirm={finalize} />
      </Modal>

      <Modal open={cancelConfirm} onClose={() => setCancelConfirm(false)} title="Cancelar comanda?">
        <div className="space-y-4">
          {items && items.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm">Esta comanda tem {items.length} item(ns). Cancelar vai descartá-los.</p>
            </div>
          )}
          <div className="flex gap-3">
            <button className="btn-outline flex-1" onClick={() => setCancelConfirm(false)}>Manter</button>
            <button className="flex-1 btn inline-flex items-center justify-center"
              style={{ background: 'rgb(220 38 38)', color: 'white' }}
              onClick={cancelOrder}>Cancelar comanda</button>
          </div>
        </div>
      </Modal>

      {postModal && (
        <Modal open onClose={() => { setPostModal(null); nav('/agenda'); }} title="Venda finalizada!">
          <div className="text-center space-y-5 py-2">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgb(6 78 59 / 0.4)' }}>
              <Check size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{formatBRL(postModal.total)}</p>
              <p className="text-muted text-sm mt-1">venda finalizada com sucesso</p>
            </div>
            {postModal.telefone && (
              <a href={`https://wa.me/${postModal.telefone.replace(/\D/g, '')}?text=${encodeURIComponent('Obrigado pelo atendimento! Foi um prazer. Até a próxima!')}`}
                target="_blank" rel="noreferrer"
                className="btn-outline w-full gap-2 flex items-center justify-center">
                <MessageCircle size={15} /> Enviar agradecimento pelo WhatsApp
              </a>
            )}
            <button className="btn-primary w-full" onClick={() => { setPostModal(null); nav('/agenda'); }}>
              Voltar para agenda
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── SearchDropdown ─────────────────────────────────────────────── */
function SearchDropdown({ placeholder, items, search, onSearch, onClose, renderItem }: {
  placeholder: string; items: any[]; search: string;
  onSearch: (v: string) => void; onClose: () => void; renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Search size={14} className="text-muted mr-2 shrink-0" />
        <input autoFocus className="flex-1 bg-transparent text-sm focus:outline-none"
          placeholder={placeholder} value={search} onChange={e => onSearch(e.target.value)} />
        <button onClick={onClose} className="text-muted hover:text-current"><X size={14} /></button>
      </div>
      <div className="max-h-48 overflow-y-auto">{items.map(renderItem)}</div>
    </div>
  );
}

/* ─── Payment modal ──────────────────────────────────────────────── */
function PaymentModal({ total, pixKey, brands, onConfirm }: {
  total: number; pixKey: string; brands: CardBrand[];
  onConfirm: (forma: Forma, extra?: { forma: string; valor: number }[], bandeiraTaxa?: number) => void;
}) {
  const [forma, setForma] = useState<Forma>('pix');
  const [pagou, setPagou] = useState(total);
  const [pixOk, setPixOk] = useState(false);
  const [m1Forma, setM1Forma] = useState('debito');
  const [m1Valor, setM1Valor] = useState(0);
  const [m2Forma, setM2Forma] = useState('dinheiro');
  const [selectedBrand, setSelectedBrand] = useState<CardBrand | null>(null);

  const isCard = forma === 'debito' || forma === 'credito';
  const troco = forma === 'dinheiro' ? Math.max(0, pagou - total) : 0;
  const m2Valor = Math.max(0, total - m1Valor);
  const taxaCartao = selectedBrand?.percentual ?? 0;
  const valorLiquido = isCard && taxaCartao > 0 ? total * (1 - taxaCartao / 100) : null;

  const filteredBrands = brands.filter(b => {
    if (forma === 'debito') return b.tipo === 'debito';
    if (forma === 'credito') return b.tipo === 'credito_avista';
    return false;
  });

  // Reset brand when forma changes to non-card
  const handleForma = (f: Forma) => {
    setForma(f);
    if (f !== 'debito' && f !== 'credito') setSelectedBrand(null);
    else setSelectedBrand(null);
  };

  const canConfirm = () => {
    if (forma === 'pix') return pixOk;
    if (forma === 'misto') return m1Valor > 0 && m1Valor < total;
    return true;
  };

  const confirm = () => {
    if (forma === 'misto') {
      onConfirm('misto', [{ forma: m1Forma, valor: m1Valor }, { forma: m2Forma, valor: m2Valor }]);
    } else {
      onConfirm(forma, undefined, isCard && selectedBrand ? selectedBrand.percentual : undefined);
    }
  };

  const FORMAS: { key: Forma; label: string; icon: any }[] = [
    { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
    { key: 'pix',      label: 'PIX',      icon: Smartphone },
    { key: 'debito',   label: 'Débito',   icon: CreditCard },
    { key: 'credito',  label: 'Crédito',  icon: CreditCard },
    { key: 'misto',    label: 'Misto',    icon: Shuffle },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2">
        {FORMAS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => handleForma(key)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm ${forma === key ? 'font-medium' : 'border-transparent text-muted hover:bg-hover-soft'}`}
            style={forma === key ? { borderColor: 'var(--text)', background: 'var(--bg-hover)' } : {}}>
            <Icon size={20} />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {forma === 'dinheiro' && (
        <div className="space-y-3">
          <div>
            <label className="label">Cliente pagou (R$)</label>
            <input className="input text-xl text-center font-semibold py-3" type="number" step="0.01" min={total}
              value={pagou || ''} onChange={e => setPagou(+e.target.value)} autoFocus />
          </div>
          {troco > 0 && (
            <div className="flex justify-between p-3 rounded-lg font-semibold" style={{ background: 'var(--bg-hover)' }}>
              <span>Troco</span><span className="text-emerald-400">{formatBRL(troco)}</span>
            </div>
          )}
        </div>
      )}

      {forma === 'pix' && (
        <div className="space-y-3">
          {pixKey && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
              <div className="text-xs text-muted mb-1">Chave PIX da barbearia</div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{pixKey}</span>
                <button onClick={() => { navigator.clipboard.writeText(pixKey); toast.success('Copiado'); }}
                  className="btn-ghost p-1.5"><Copy size={13} /></button>
              </div>
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
            <input type="checkbox" checked={pixOk} onChange={e => setPixOk(e.target.checked)} />
            <span className="text-sm">Confirmo que recebi o PIX de {formatBRL(total)}</span>
          </label>
        </div>
      )}

      {isCard && brands.length > 0 && (
        <div>
          <label className="label">Bandeira do cartão (opcional)</label>
          <div className="flex flex-wrap gap-2">
            {brands.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBrand(selectedBrand?.id === b.id ? null : b)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${selectedBrand?.id === b.id ? 'font-medium' : 'border-transparent text-muted hover:bg-hover-soft'}`}
                style={selectedBrand?.id === b.id ? { borderColor: 'var(--text)', background: 'var(--bg-hover)' } : {}}
              >
                {b.nome} <span className="text-muted text-xs">({b.percentual}%)</span>
              </button>
            ))}
          </div>
          {valorLiquido !== null && (
            <p className="text-xs text-amber-400 mt-2">
              Taxa {taxaCartao}% → líquido {formatBRL(valorLiquido)} · comissão calculada sobre valor líquido
            </p>
          )}
        </div>
      )}

      {forma === 'misto' && (
        <div className="space-y-3">
          <p className="text-sm text-center text-muted">Total: <strong>{formatBRL(total)}</strong></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Forma 1</label>
              <select className="input" value={m1Forma} onChange={e => setM1Forma(e.target.value)}>
                {(['debito','credito','pix','dinheiro'] as const).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" step="0.01" min={0.01} max={total - 0.01}
                value={m1Valor || ''} onChange={e => setM1Valor(+e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Forma 2</label>
              <select className="input" value={m2Forma} onChange={e => setM2Forma(e.target.value)}>
                {(['dinheiro','pix','debito','credito'] as const).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" value={formatBRL(m2Valor)} disabled />
            </div>
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={confirm} disabled={!canConfirm()}>
        Confirmar venda · {formatBRL(total)}
      </button>
    </div>
  );
}

/* ─── Item row ──────────────────────────────────────────────────── */
function ItemRow({ item, onRemove }: { item: OrderItem; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm">{item.descricao}</div>
        {Number(item.comissao_valor) > 0 && (
          <div className="text-xs text-muted">
            Comissão: {item.comissao_percentual}% = {formatBRL(Number(item.comissao_valor))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-medium">{formatBRL(Number(item.valor_total))}</span>
        <button onClick={onRemove} className="btn-ghost p-1 text-muted hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Closed ────────────────────────────────────────────────────── */
function OrderClosed({ order, total }: { order: any; total: number }) {
  const nav = useNavigate();
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="card p-8 text-center space-y-4">
        <Check size={36} className="mx-auto text-emerald-400" />
        <div>
          <p className="text-xl font-semibold">Comanda fechada</p>
          <p className="text-muted text-sm mt-1">{order.clients?.nome} · {formatBRL(total)}</p>
        </div>
        <button className="btn-primary" onClick={() => nav('/agenda')}>Voltar para agenda</button>
      </div>
    </div>
  );
}
