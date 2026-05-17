import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { formatBRL } from '../lib/utils';
import {
  startOfDay, endOfDay, subDays, format, isPast, isToday, parseISO,
  addDays, setDate, setDay, nextDay, startOfMonth, endOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, TrendingDown, Wallet, Users as Users2, BarChart2, 
  CreditCard, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, 
  Clock, Camera, Copy, Smartphone 
} from 'lucide-react';
import { toast } from 'sonner';
import type { CashMovement } from '../types/db';

type Tab = 'caixa' | 'comissoes' | 'relatorios' | 'pagar' | 'receber' | 'formas';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'caixa',    label: 'Caixa do dia',        icon: Wallet },
  { key: 'pagar',    label: 'Contas a Pagar',       icon: TrendingDown },
  { key: 'receber',  label: 'Contas a Receber',     icon: TrendingUp },
  { key: 'formas',   label: 'Formas de Pagamento',  icon: CreditCard },
  { key: 'comissoes',label: 'Relatório Comissões', icon: Users2 },
  { key: 'relatorios',label: 'Relatórios',           icon: BarChart2 },
];

function getVencimentoComissao(frequencia: string, dia: string): string {
  const hoje = new Date();
  if (frequencia === 'diario') return hoje.toISOString().split('T')[0];
  
  if (frequencia === 'semanal') {
    const d = parseInt(dia);
    const venc = setDay(hoje, d);
    return (isPast(venc) && !isToday(venc) ? addDays(venc, 7) : venc).toISOString().split('T')[0];
  }

  if (frequencia === 'mensal') {
    const d = parseInt(dia);
    const venc = setDate(hoje, d);
    return (isPast(venc) && !isToday(venc) ? addDays(startOfMonth(addDays(hoje, 30)), d - 1) : venc).toISOString().split('T')[0];
  }

  return hoje.toISOString().split('T')[0];
}

export default function Finance() {
// ... rest of Finance function ...
  const [tab, setTab] = useState<Tab>('caixa');
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Financeiro" />
      <div className="flex gap-1 border-b mb-6 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm -mb-px border-b-2 whitespace-nowrap transition-colors
              ${tab === key ? 'border-current font-medium' : 'border-transparent text-muted hover:text-current'}`}
            style={tab === key ? { borderColor: 'var(--text)' } : {}}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {tab === 'caixa'     && <Caixa />}
      {tab === 'pagar'     && <ContasPagar />}
      {tab === 'receber'   && <ContasReceber />}
      {tab === 'formas'    && <FormasPagamento />}
      {tab === 'comissoes' && <Comissoes />}
      {tab === 'relatorios'&& <Relatorios />}
    </div>
  );
}

/* ─── Caixa do dia ──────────────────────────────────────────────── */
function Caixa() {
  const { barbershop } = useAuth();
  const [orderId, setOrderId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['caixa', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const start = startOfDay(new Date()).toISOString();
      const end   = endOfDay(new Date()).toISOString();
      const { data } = await supabase.from('cash_movements').select('*')
        .eq('barbershop_id', barbershop!.id).gte('data', start).lte('data', end).order('data', { ascending: false });
      return (data ?? []) as CashMovement[];
    },
  });
  const entradas = (data ?? []).filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const saidas   = (data ?? []).filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Kpi label="Entradas" value={formatBRL(entradas)} color="text-emerald-400" />
        <Kpi label="Saídas"   value={formatBRL(saidas)}   color="text-red-400" />
        <Kpi label="Saldo"    value={formatBRL(entradas - saidas)} />
      </div>
      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {(!data || data.length === 0) && <div className="p-8 text-center text-muted text-sm">Nenhum movimento hoje</div>}
        {(data ?? []).map((m) => (
          <button key={m.id} 
            onClick={() => m.ref_order_id && setOrderId(m.ref_order_id)}
            className={`w-full flex items-center justify-between p-4 hover:bg-hover-soft transition-colors text-left ${m.ref_order_id ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div>
              <div className="text-sm font-medium">{m.descricao || m.categoria}</div>
              <div className="text-[10px] text-muted uppercase tracking-wider">{format(new Date(m.data), 'HH:mm')} {m.ref_order_id && '· Ver detalhes'}</div>
            </div>
            <div className={m.tipo === 'entrada' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
              {m.tipo === 'entrada' ? '+' : '-'}{formatBRL(Number(m.valor))}
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!orderId} onClose={() => setOrderId(null)} title="Detalhes da Venda">
        {orderId && <OrderDetails id={orderId} />}
      </Modal>
    </div>
  );
}

function OrderDetails({ id }: { id: string }) {
  const { data: order, isLoading } = useQuery({
    queryKey: ['order-details', id],
    queryFn: async () => {
      const { data: o } = await supabase.from('orders').select('*, barbers(nome_exibicao), clients(nome)')
        .eq('id', id).single();
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id);
      return { ...o, items: items ?? [] };
    }
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando detalhes...</div>;
  if (!order) return <div className="p-8 text-center">Pedido não encontrado</div>;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-0">
      <div className="flex justify-between items-start border-b border-border pb-4">
        <div>
          <h3 className="font-bold text-lg">Comanda #{order.id.slice(0,8)}</h3>
          <p className="text-xs text-muted">{format(new Date(order.fechada_em), "dd/MM/yyyy 'às' HH:mm")}</p>
        </div>
        <div className="text-right">
          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-1 rounded uppercase">Pago</span>
          <p className="text-xs text-muted mt-1 uppercase tracking-tighter">{order.forma_pagamento}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">Itens</div>
        {order.items.map((it: any) => (
          <div key={it.id} className="flex justify-between text-sm">
            <span>{it.qtd}x {it.descricao}</span>
            <span className="font-medium">{formatBRL(Number(it.valor_total))}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-4 border-t border-border">
        <div className="flex justify-between text-sm text-muted">
          <span>Subtotal</span>
          <span>{formatBRL(Number(order.total))}</span>
        </div>
        {Number(order.desconto) > 0 && (
          <div className="flex justify-between text-sm text-red-400">
            <span>Desconto</span>
            <span>-{formatBRL(Number(order.desconto))}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg pt-2">
          <span>Total</span>
          <span>{formatBRL(Number(order.total) - Number(order.desconto))}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs text-muted">
        <div>
          <div className="font-bold uppercase mb-1">Profissional</div>
          <div>{order.barbers?.nome_exibicao}</div>
        </div>
        <div>
          <div className="font-bold uppercase mb-1">Cliente</div>
          <div>{order.clients?.nome || 'Consumidor Final'}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-4 print:hidden">
        <button onClick={handlePrint} className="btn-outline flex-1 gap-2">
          <CreditCard size={16} /> Re-imprimir Recibo
        </button>
      </div>
    </div>
  );
}

/* ─── Contas a Pagar ────────────────────────────────────────────── */
const CAT_PAGAR = ['aluguel','folha','fornecedores','energia','agua','internet','equipamentos','marketing','outros'];
const CAT_RECEBER = ['servico','produto','assinatura','pacote','cashback','outros'];

const DISABLED_CATS = ['assinatura', 'cashback'];

function ContasPagar() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<any | 'new' | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'pago' | 'vencido'>('todos');

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['contas_pagar_full', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      // 1. Fetch regular accounts payable
      const { data: contas } = await supabase.from('contas_pagar').select('*')
        .eq('barbershop_id', barbershop!.id).order('vencimento');
      
      // 2. Fetch all time commissions (or last 90 days for performance)
      const start = subDays(new Date(), 90).toISOString();
      const { data: orders } = await supabase.from('orders').select('id,barber_id,barbers(nome_exibicao)')
        .eq('barbershop_id', barbershop!.id).eq('status', 'fechada').gte('fechada_em', start);
      
      const { data: items } = await supabase.from('order_items').select('order_id,comissao_valor')
        .in('order_id', (orders ?? []).map((o: any) => o.id));

      const { data: payments } = await supabase.from('barber_payments')
        .select('*').eq('barbershop_id', barbershop!.id).gte('pago_em', start);

      // 3. Summarize commissions per barber
      const bMap = new Map<string, { nome: string; total: number; pago: number; lastPayment: string | null }>();
      (orders ?? []).forEach((o: any) => {
        const cur = bMap.get(o.barber_id) ?? { nome: o.barbers?.nome_exibicao ?? '—', total: 0, pago: 0, lastPayment: null };
        const ordItems = (items ?? []).filter((i: any) => i.order_id === o.id);
        cur.total += ordItems.reduce((s: number, i: any) => s + Number(i.comissao_valor), 0);
        bMap.set(o.barber_id, cur);
      });

      const paymentRows: any[] = [];
      (payments ?? []).forEach((p: any) => {
        const cur = bMap.get(p.barber_id);
        if (cur) {
          cur.pago += Number(p.valor);
          bMap.set(p.barber_id, cur);
        }
        // Create virtual "paid" row for each payment
        paymentRows.push({
          id: `pay-${p.id}`,
          descricao: `Pagamento Comissão: ${cur?.nome || 'Barbeiro'}`,
          categoria: 'comissao',
          valor: p.valor,
          vencimento: p.pago_em.split('T')[0],
          status: 'pago',
          is_virtual: true
        });
      });

      // 4. Create virtual "pending" rows for current balance
      const commissionDueRows: any[] = [];
      const venc = getVencimentoComissao(barbershop?.comissao_frequencia || 'semanal', barbershop?.comissao_dia_pagamento || '6');
      
      bMap.forEach((data, bid) => {
        const saldo = data.total - data.pago;
        if (saldo > 0.01) {
          commissionDueRows.push({
            id: `due-${bid}`,
            barber_id: bid,
            descricao: `Comissão: ${data.nome}`,
            categoria: 'comissao',
            valor: saldo,
            vencimento: venc,
            status: 'pendente',
            is_virtual: true
          });
        }
      });

      return [...(contas ?? []), ...paymentRows, ...commissionDueRows];
    },
  });

  const contas = (rawData ?? []).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const visivel = contas.filter((c: any) => filtro === 'todos' || c.status === filtro);
  const totPendente = contas.filter((c: any) => c.status === 'pendente').reduce((s: number, c: any) => s + Number(c.valor), 0);
  const totPago = contas.filter((c: any) => c.status === 'pago').reduce((s: number, c: any) => s + Number(c.valor), 0);

  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('contas_pagar').insert(payload)
      : await supabase.from('contas_pagar').update(payload).eq('id', modal.id);
    if (error) return toast.error(error.message);
    toast.success('Salvo');
    qc.invalidateQueries({ queryKey: ['contas_pagar_full'] });
    setModal(null);
  };

  const marcarPago = async (c: any) => {
    if (c.id.startsWith('due-')) {
      // It's a commission payment
      setModal({ type: 'commission_pay', barber_id: c.barber_id, nome: c.descricao.replace('Comissão: ', ''), valor: c.valor });
      return;
    }
    await supabase.from('contas_pagar').update({ status: 'pago', pago_em: new Date().toISOString().slice(0, 10) }).eq('id', c.id);
    qc.invalidateQueries({ queryKey: ['contas_pagar_full'] });
    toast.success('Marcado como pago');
  };

  const handlePayCommission = async (form: any) => {
    const { error } = await supabase.from('barber_payments').insert({
      ...form,
      barbershop_id: barbershop?.id,
      barber_id: modal.barber_id,
    });
    if (error) return toast.error(error.message);
    toast.success('Pagamento registrado');
    qc.invalidateQueries({ queryKey: ['contas_pagar_full'] });
    setModal(null);
  };

  const remove = async (id: string) => {
    if (id.startsWith('due-') || id.startsWith('pay-')) return toast.error('Contas automáticas não podem ser excluídas por aqui.');
    if (!confirm('Excluir esta conta permanentemente?')) return;
    
    toast.promise(supabase.from('contas_pagar').delete().eq('id', id), {
      loading: 'Excluindo...',
      success: () => {
        qc.invalidateQueries({ queryKey: ['contas_pagar_full'] });
        return 'Conta excluída';
      },
      error: 'Erro ao excluir'
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Kpi label="A pagar (pendente)" value={formatBRL(totPendente)} color="text-red-400" />
        <Kpi label="Pago no período"    value={formatBRL(totPago)} color="text-emerald-400" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(['todos','pendente','pago','vencido'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-md text-xs capitalize transition-colors ${filtro === f ? 'font-medium' : 'text-muted'}`}
              style={filtro === f ? { background: 'var(--bg-hover)' } : {}}>
              {f}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={14} /> Nova conta</button>
      </div>
      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading && <Skeleton />}
        {!isLoading && visivel.length === 0 && <Empty text="Nenhuma conta encontrada" />}
        {visivel.map((c: any) => {
          const venc = parseISO(c.vencimento);
          const atrasada = c.status === 'pendente' && isPast(venc) && !isToday(venc);
          return (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-hover-soft transition-colors ${c.is_virtual ? 'bg-ink-900/30' : ''}`}>
              <StatusIcon status={atrasada ? 'vencido' : c.status} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {c.descricao}
                  {c.is_virtual && <span className="text-[8px] bg-ink-800 text-ink-400 px-1 rounded uppercase font-bold tracking-widest border border-ink-700">Auto</span>}
                </div>
                <div className="text-xs text-muted flex gap-2 mt-0.5">
                  <span className="capitalize">{c.categoria}</span>
                  <span>·</span>
                  <span className={atrasada ? 'text-red-400' : ''}>
                    {c.status === 'pago' ? 'Pago em ' : (atrasada ? 'Venceu em ' : 'Vence em ')}
                    {format(venc, 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
              <span className="font-semibold text-sm shrink-0">{formatBRL(Number(c.valor))}</span>
              <div className="flex gap-1 shrink-0">
                {c.status === 'pendente' && (
                  <button onClick={() => marcarPago(c)} className="btn-ghost px-2 py-1.5 text-xs text-emerald-400 gap-1">
                    <CheckCircle2 size={13} /> {c.id.startsWith('due-') ? 'Pagar' : 'Pagar'}
                  </button>
                )}
                {!c.is_virtual && <button onClick={() => setModal(c)} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>}
                {!c.is_virtual && <button onClick={() => remove(c.id)} className="btn-ghost px-2 py-1.5 text-red-400"><Trash2 size={13} /></button>}
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nova conta a pagar' : (modal?.type === 'commission_pay' ? `Pagar Comissão — ${modal.nome}` : 'Editar conta')}>
        {modal === 'new' || (modal && !modal.type) ? (
          <ContaForm initial={modal === 'new' ? null : modal} categorias={CAT_PAGAR} onSave={save} tipo="pagar" />
        ) : modal?.type === 'commission_pay' ? (
          <BarberPayForm saldo={modal.valor} onSave={handlePayCommission} />
        ) : null}
      </Modal>
    </>
  );
}

/* ─── Contas a Receber ──────────────────────────────────────────── */
function ContasReceber() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<any | 'new' | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendente' | 'recebido' | 'vencido'>('todos');

  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas_receber', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('contas_receber').select('*')
        .eq('barbershop_id', barbershop!.id).order('vencimento');
      return data ?? [];
    },
  });

  const visivel = (contas ?? []).filter((c: any) => filtro === 'todos' || c.status === filtro);
  const totPendente = (contas ?? []).filter((c: any) => c.status === 'pendente').reduce((s: number, c: any) => s + Number(c.valor), 0);
  const totRecebido = (contas ?? []).filter((c: any) => c.status === 'recebido').reduce((s: number, c: any) => s + Number(c.valor), 0);

  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('contas_receber').insert(payload)
      : await supabase.from('contas_receber').update(payload).eq('id', modal.id);
    if (error) return toast.error(error.message);
    toast.success('Salvo');
    qc.invalidateQueries({ queryKey: ['contas_receber'] });
    setModal(null);
  };

  const marcarRecebido = async (c: any) => {
    await supabase.from('contas_receber').update({ status: 'recebido', recebido_em: new Date().toISOString().slice(0, 10) }).eq('id', c.id);
    qc.invalidateQueries({ queryKey: ['contas_receber'] });
    toast.success('Marcado como recebido');
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta conta permanentemente?')) return;
    
    toast.promise(supabase.from('contas_receber').delete().eq('id', id), {
      loading: 'Excluindo...',
      success: () => {
        qc.invalidateQueries({ queryKey: ['contas_receber'] });
        return 'Conta excluída';
      },
      error: 'Erro ao excluir'
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Kpi label="A receber (pendente)" value={formatBRL(totPendente)} color="text-amber-400" />
        <Kpi label="Recebido no período"  value={formatBRL(totRecebido)} color="text-emerald-400" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(['todos','pendente','recebido','vencido'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-md text-xs capitalize transition-colors ${filtro === f ? 'font-medium' : 'text-muted'}`}
              style={filtro === f ? { background: 'var(--bg-hover)' } : {}}>
              {f}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={14} /> Nova conta</button>
      </div>
      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading && <Skeleton />}
        {!isLoading && visivel.length === 0 && <Empty text="Nenhuma conta encontrada" />}
        {visivel.map((c: any) => {
          const venc = parseISO(c.vencimento);
          const atrasada = c.status === 'pendente' && isPast(venc) && !isToday(venc);
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-hover-soft transition-colors">
              <StatusIcon status={atrasada ? 'vencido' : c.status} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{c.descricao}</div>
                <div className="text-xs text-muted flex gap-2 mt-0.5">
                  <span className="capitalize">{c.categoria}</span>
                  <span>·</span>
                  <span className={atrasada ? 'text-red-400' : ''}>
                    {atrasada ? 'Venceu em ' : 'Vence em '}
                    {format(venc, 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
              <span className="font-semibold text-sm shrink-0 text-emerald-400">{formatBRL(Number(c.valor))}</span>
              <div className="flex gap-1 shrink-0">
                {c.status === 'pendente' && (
                  <button onClick={() => marcarRecebido(c)} className="btn-ghost px-2 py-1.5 text-xs text-emerald-400 gap-1">
                    <CheckCircle2 size={13} /> Receber
                  </button>
                )}
                <button onClick={() => setModal(c)} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>
                <button onClick={() => remove(c.id)} className="btn-ghost px-2 py-1.5 text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nova conta a receber' : 'Editar conta'}>
        {modal !== null && <ContaForm initial={modal === 'new' ? null : modal} categorias={CAT_RECEBER} onSave={save} tipo="receber" />}
      </Modal>
    </>
  );
}

/* ─── Conta form (shared) ──────────────────────────────────────── */
function ContaForm({ initial, categorias, onSave, tipo }: {
  initial: any; categorias: string[]; onSave: (v: any) => void; tipo: 'pagar' | 'receber';
}) {
  const [form, setForm] = useState({
    descricao: initial?.descricao ?? '',
    categoria: initial?.categoria ?? categorias[0],
    valor: Number(initial?.valor ?? 0),
    vencimento: initial?.vencimento ?? new Date().toISOString().slice(0, 10),
    observacoes: initial?.observacoes ?? '',
    recorrente: initial?.recorrente ?? false,
    recorrencia: initial?.recorrencia ?? 'mensal',
    status: initial?.status ?? 'pendente',
  });
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input className="input" value={form.descricao} onChange={e => f('descricao', e.target.value)} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={form.categoria} onChange={e => f('categoria', e.target.value)}>
            {categorias.map(c => {
              const disabled = DISABLED_CATS.includes(c);
              return (
                <option key={c} value={c} disabled={disabled} className="capitalize">
                  {c} {disabled ? '(Em desenvolvimento)' : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="label">Valor (R$)</label>
          <input className="input" type="number" step="0.01" min={0} value={form.valor}
            onChange={e => f('valor', +e.target.value)} required />
        </div>
        <div>
          <label className="label">Vencimento</label>
          <input className="input" type="date" value={form.vencimento} onChange={e => f('vencimento', e.target.value)} required />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => f('status', e.target.value)}>
            <option value="pendente">Pendente</option>
            <option value={tipo === 'pagar' ? 'pago' : 'recebido'}>{tipo === 'pagar' ? 'Pago' : 'Recebido'}</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input type="checkbox" checked={form.recorrente} onChange={e => f('recorrente', e.target.checked)} />
        Conta recorrente
      </label>
      {form.recorrente && (
        <div>
          <label className="label">Recorrência</label>
          <select className="input" value={form.recorrencia} onChange={e => f('recorrencia', e.target.value)}>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
        </div>
      )}
      <div>
        <label className="label">Observações</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
      </div>
      <button className="btn-primary w-full">Salvar</button>
    </form>
  );
}

/* ─── Formas de Pagamento ──────────────────────────────────────── */
function FormasPagamento() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<any | 'new' | null>(null);

  const { data: methods, isLoading } = useQuery({
    queryKey: ['payment_methods', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('payment_methods').select('*')
        .eq('barbershop_id', barbershop!.id).order('is_default', { ascending: false });
      return data ?? [];
    },
  });

  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('payment_methods').insert(payload)
      : await supabase.from('payment_methods').update(payload).eq('id', modal.id);
    if (error) return toast.error(error.message);
    toast.success('Forma de pagamento salva');
    qc.invalidateQueries({ queryKey: ['payment_methods'] });
    setModal(null);
  };

  const toggle = async (m: any) => {
    await supabase.from('payment_methods').update({ ativo: !m.ativo }).eq('id', m.id);
    qc.invalidateQueries({ queryKey: ['payment_methods'] });
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir?')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['payment_methods'] });
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={14} /> Nova forma</button>
      </div>

      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading && <Skeleton />}
        {(methods ?? []).map((m: any) => (
          <div key={m.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-hover-soft transition-colors ${!m.ativo ? 'opacity-50' : ''}`}>
            <CreditCard size={16} className="text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                {m.nome}
                {m.is_default && <span className="text-[8px] bg-ink-800 text-ink-400 px-1 rounded uppercase font-bold tracking-widest border border-ink-700">Padrão</span>}
              </div>
              <div className="text-xs text-muted">
                {m.taxa_percentual > 0 && `Taxa ${m.taxa_percentual}% · `}
                {m.prazo_liquidacao_dias}d liquidação
                {m.tipo === 'pix' && m.pix_key && ` · Chave: ${m.pix_key}`}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => toggle(m)} className="btn-ghost px-2 py-1.5 text-xs">
                {m.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => setModal(m)} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>
              {!m.is_default && <button onClick={() => remove(m.id)} className="btn-ghost px-2 py-1.5 text-red-400"><Trash2 size={13} /></button>}
            </div>
          </div>
        ))}
        {!isLoading && (methods ?? []).length === 0 && (
          <Empty text="Nenhuma forma de pagamento cadastrada" />
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nova forma de pagamento' : `Editar ${modal?.nome}`}>
        {modal !== null && <PaymentMethodForm initial={modal === 'new' ? null : modal} onSave={save} />}
      </Modal>
    </>
  );
}

function PaymentMethodForm({ initial, onSave }: { initial: any; onSave: (v: any) => void }) {
  const { barbershop } = useAuth();
  const [form, setForm] = useState({
    nome: initial?.nome ?? '',
    tipo: initial?.tipo ?? 'outro',
    taxa_percentual: Number(initial?.taxa_percentual ?? 0),
    prazo_liquidacao_dias: Number(initial?.prazo_liquidacao_dias ?? 0),
    ativo: initial?.ativo ?? true,
    pix_key: initial?.pix_key ?? '',
    qr_code_url: initial?.qr_code_url ?? '',
  });
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const uploadQR = async (file: File) => {
    if (!barbershop || !initial?.id) return toast.error('Salve a forma de pagamento antes de enviar o QR Code');
    const ext = file.name.split('.').pop();
    const path = `qrcodes/${barbershop.id}/${initial.id}.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage.from('general').upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from('general').getPublicUrl(path);
    f('qr_code_url', data.publicUrl);
    setUploading(false);
    toast.success('QR Code carregado');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="label">Nome</label>
        <input 
          className="input" 
          value={form.nome} 
          onChange={e => f('nome', e.target.value)} 
          required 
          disabled={initial?.is_default}
          placeholder="Ex: PicPay, Vale Alimentação" 
        />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select 
          className="input" 
          value={form.tipo} 
          onChange={e => f('tipo', e.target.value)}
          disabled={initial?.is_default}
        >
          <option value="pix">PIX</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="outro">Outro</option>
        </select>
      </div>

      {form.tipo === 'pix' && (
        <div className="space-y-4 p-4 bg-ink-900/50 rounded-lg border border-border">
          <div>
            <label className="label">Chave PIX (E-mail, CPF, CNPJ ou Aleatória)</label>
            <input className="input" value={form.pix_key} onChange={e => f('pix_key', e.target.value)} placeholder="Sua chave PIX" />
          </div>
          <div>
            <label className="label">QR Code (Imagem)</label>
            <div 
              className="w-full h-32 border-2 border-dashed border-ink-800 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-ink-800 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              {form.qr_code_url ? (
                <img src={form.qr_code_url} alt="QR Code" className="h-full object-contain" />
              ) : (
                <>
                  <Camera size={24} className="text-ink-600" />
                  <span className="text-[10px] text-ink-500 uppercase font-bold">Clique para carregar QR Code</span>
                </>
              )}
              {uploading && <div className="absolute inset-0 bg-ink-950/50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-ink-50/30 border-t-ink-50 rounded-full animate-spin" /></div>}
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadQR(e.target.files[0])} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Taxa da adquirente (%)</label>
          <input className="input" type="number" step="0.01" min={0} value={form.taxa_percentual}
            onChange={e => f('taxa_percentual', +e.target.value)} />
        </div>
        <div>
          <label className="label">Prazo de liquidação (dias)</label>
          <input className="input" type="number" min={0} value={form.prazo_liquidacao_dias}
            onChange={e => f('prazo_liquidacao_dias', +e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input type="checkbox" checked={form.ativo} onChange={e => f('ativo', e.target.checked)} /> Ativo
      </label>
      <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={uploading}>
        {uploading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Salvar'}
      </button>
    </form>
  );
}

/* ─── Comissões ─────────────────────────────────────────────────── */
function Comissoes() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [payModal, setPayModal] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ['commissions', barbershop?.id, days],
    enabled: !!barbershop,
    queryFn: async () => {
      const start = subDays(new Date(), days).toISOString();
      const { data: orders } = await supabase.from('orders').select('id,barber_id,barbers(nome_exibicao)')
        .eq('barbershop_id', barbershop!.id).eq('status', 'fechada').gte('fechada_em', start);
      
      const { data: payments } = await supabase.from('barber_payments')
        .select('barber_id, valor')
        .eq('barbershop_id', barbershop!.id).gte('pago_em', start);

      if (!orders?.length) return [];
      const { data: items } = await supabase.from('order_items').select('order_id,comissao_valor')
        .in('order_id', orders.map((o: any) => o.id));
      
      const sum = new Map<string, { id: string; nome: string; total: number; pago: number }>();
      orders.forEach((o: any) => {
        const cur = sum.get(o.barber_id) ?? { id: o.barber_id, nome: o.barbers?.nome_exibicao ?? '—', total: 0, pago: 0 };
        const ordItems = (items ?? []).filter((i: any) => i.order_id === o.id);
        cur.total += ordItems.reduce((s: number, i: any) => s + Number(i.comissao_valor), 0);
        sum.set(o.barber_id, cur);
      });

      payments?.forEach((p: any) => {
        if (sum.has(p.barber_id)) {
          const cur = sum.get(p.barber_id)!;
          cur.pago += Number(p.valor);
          sum.set(p.barber_id, cur);
        }
      });

      return Array.from(sum.values());
    },
  });

  const handlePay = async (form: any) => {
    const { error } = await supabase.from('barber_payments').insert({
      ...form,
      barbershop_id: barbershop?.id,
      barber_id: payModal.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Pagamento registrado');
    qc.invalidateQueries({ queryKey: ['commissions'] });
    setPayModal(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <select className="input w-auto" value={days} onChange={e => setDays(+e.target.value)}>
          <option value={7}>Últimos 7 dias</option>
          <option value={15}>Últimos 15 dias</option>
          <option value={30}>Últimos 30 dias</option>
        </select>
        <div className="text-[10px] text-muted uppercase font-bold">Comissões Acumuladas</div>
      </div>
      
      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {(!data || data.length === 0) && <Empty text="Sem dados no período" />}
        {(data ?? []).map((b, i) => {
          const saldo = b.total - b.pago;
          return (
            <div key={i} className="flex items-center justify-between p-4 hover:bg-hover-soft transition-colors">
              <div className="flex-1">
                <div className="text-sm font-bold text-ink-50">{b.nome}</div>
                <div className="text-[10px] text-muted uppercase mt-0.5">
                  Total: {formatBRL(b.total)} · Pago: {formatBRL(b.pago)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`text-sm font-bold ${saldo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatBRL(saldo)}
                </div>
                {saldo > 0 && (
                  <button 
                    onClick={() => setPayModal(b)}
                    className="btn-ghost px-3 py-1.5 text-xs text-ink-50 border border-ink-800 hover:bg-ink-800"
                  >
                    Pagar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Pagar Comissão — ${payModal?.nome}`}>
        {payModal && <BarberPayForm saldo={payModal.total - payModal.pago} onSave={handlePay} />}
      </Modal>
    </div>
  );
}

function BarberPayForm({ saldo, onSave }: { saldo: number; onSave: (v: any) => void }) {
  const [form, setForm] = useState({
    valor: saldo,
    metodo: 'pix',
    observacoes: '',
    comprovante_url: ''
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="p-3 bg-ink-900 border border-border rounded-lg mb-2">
        <div className="text-[10px] text-muted uppercase font-bold">Saldo Pendente</div>
        <div className="text-xl font-bold text-amber-400">{formatBRL(saldo)}</div>
      </div>

      <div>
        <label className="label">Valor a Pagar (R$)</label>
        <input className="input" type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: +e.target.value})} required />
      </div>

      <div>
        <label className="label">Forma de Pagamento</label>
        <select className="input" value={form.metodo} onChange={e => setForm({...form, metodo: e.target.value})}>
          <option value="pix">PIX</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="transferencia">Transferência</option>
        </select>
      </div>

      <div>
        <label className="label">Observações / Link do Comprovante</label>
        <textarea className="input" rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} placeholder={form.metodo === 'pix' ? 'Cole o link do comprovante ou ID da transação' : 'Ex: Pago em mãos'} />
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
        {loading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Confirmar Pagamento'}
      </button>
    </form>
  );
}

/* ─── Relatórios ────────────────────────────────────────────────── */
function Relatorios() {
  const { barbershop } = useAuth();
  const [days, setDays] = useState(30);
  const { data } = useQuery({
    queryKey: ['report', barbershop?.id, days],
    enabled: !!barbershop,
    queryFn: async () => {
      const start = subDays(new Date(), days).toISOString();
      const { data } = await supabase.from('orders')
        .select('id,total,desconto,forma_pagamento,fechada_em,barbers(nome_exibicao)')
        .eq('barbershop_id', barbershop!.id).eq('status', 'fechada').gte('fechada_em', start).order('fechada_em', { ascending: false });
      return data ?? [];
    },
  });
  const total = (data ?? []).reduce((s, o: any) => s + Number(o.total) - Number(o.desconto ?? 0), 0);

  const exportCsv = () => {
    const rows = [['Data', 'Barbeiro', 'Total', 'Desconto', 'Pagamento']];
    (data ?? []).forEach((o: any) => rows.push([
      format(new Date(o.fechada_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      o.barbers?.nome_exibicao ?? '', String(o.total), String(o.desconto), o.forma_pagamento,
    ]));
    const csv = rows.map(r => r.join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `relatorio-${days}d.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select className="input w-auto" value={days} onChange={e => setDays(+e.target.value)}>
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
        </select>
        <button className="btn-outline" onClick={exportCsv}>Exportar CSV</button>
      </div>
      <div className="card p-6 mb-4">
        <div className="text-xs text-muted uppercase tracking-wide">Faturamento no período</div>
        <div className="text-3xl font-semibold mt-1">{formatBRL(total)}</div>
      </div>
      <div className="card divide-y max-h-96 overflow-auto" style={{ borderColor: 'var(--border)' }}>
        {(data ?? []).map((o: any) => (
          <div key={o.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{o.barbers?.nome_exibicao}</div>
              <div className="text-xs text-muted">{format(new Date(o.fechada_em), 'dd/MM HH:mm')} · {o.forma_pagamento}</div>
            </div>
            <div>{formatBRL(Number(o.total) - Number(o.desconto ?? 0))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── shared helpers ────────────────────────────────────────────── */
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-2 ${color ?? ''}`}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'pago' || status === 'recebido')
    return <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />;
  if (status === 'vencido')
    return <AlertCircle size={16} className="text-red-400 shrink-0" />;
  return <Clock size={16} className="text-amber-400 shrink-0" />;
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-muted text-sm">{text}</div>;
}

function Skeleton() {
  return (
    <>{[...Array(3)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
        <div className="w-4 h-4 rounded-full shrink-0" style={{ background: 'var(--bg-hover)' }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-hover)' }} />
          <div className="h-2.5 rounded w-1/5" style={{ background: 'var(--bg-hover)' }} />
        </div>
        <div className="h-4 w-20 rounded" style={{ background: 'var(--bg-hover)' }} />
      </div>
    ))}</>
  );
}
