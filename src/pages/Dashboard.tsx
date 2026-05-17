import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import PageHeader from '../components/PageHeader';
import { formatBRL } from '../lib/utils';
import { useState } from 'react';
import {
  startOfDay, endOfDay, subDays, subMonths,
  format, startOfMonth, endOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, Calendar, DollarSign, Award,
  ArrowDownCircle, Receipt, Users, Store, ShoppingCart, Package, Wallet
} from 'lucide-react';

type Period = '7d' | '30d' | '12m';

export default function Dashboard() {
  const { barbershop } = useAuth();
  const { summary: cashSummary, session } = useCash();
  const navigate = useNavigate();
  const bid = barbershop?.id;
  const [period, setPeriod] = useState<Period>('7d');

  const quickActions = [
    { label: 'Caixa',      icon: Store,        to: '/caixa',     color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'PDV',        icon: ShoppingCart, to: '/pdv',       color: 'bg-amber-500/10 text-amber-500' },
    { label: 'Agenda',     icon: Calendar,     to: '/agenda',    color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Clientes',   icon: Users,        to: '/clientes',  color: 'bg-purple-500/10 text-purple-500' },
    { label: 'Catálogo',   icon: Package,      to: '/catalogo',  color: 'bg-pink-500/10 text-pink-500' },
    { label: 'Financeiro', icon: Wallet,       to: '/financeiro',color: 'bg-orange-500/10 text-orange-500' },
  ];

  // Today KPIs
  const { data: today } = useQuery({
    queryKey: ['dashboard-today', bid],
    enabled: !!bid,
    queryFn: async () => {
      const start = startOfDay(new Date()).toISOString();
      const end   = endOfDay(new Date()).toISOString();
      const [{ data: orders }, { data: appts }] = await Promise.all([
        supabase.from('orders').select('total,desconto,status')
          .eq('barbershop_id', bid!).gte('fechada_em', start).lte('fechada_em', end).eq('status', 'fechada'),
        supabase.from('appointments').select('status')
          .eq('barbershop_id', bid!).gte('data_hora', start).lte('data_hora', end),
      ]);
      const faturamento = (orders ?? []).reduce((s, o: any) => s + Number(o.total) - Number(o.desconto ?? 0), 0);
      const ticket = orders?.length ? faturamento / orders.length : 0;
      return { faturamento, ticket, total_orders: orders?.length ?? 0, appts: appts ?? [] };
    },
  });

  // Chart data by period
  const { data: chart } = useQuery({
    queryKey: ['dashboard-chart', bid, period],
    enabled: !!bid,
    queryFn: async () => {
      if (period === '7d') {
        const start = subDays(startOfDay(new Date()), 6).toISOString();
        const { data } = await supabase.from('orders')
          .select('fechada_em,total,desconto')
          .eq('barbershop_id', bid!).eq('status', 'fechada').gte('fechada_em', start);
        const map = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
          const d = format(subDays(new Date(), i), 'EEE', { locale: ptBR });
          map.set(d, 0);
        }
        (data ?? []).forEach((o: any) => {
          if (!o.fechada_em) return;
          const d = format(new Date(o.fechada_em), 'EEE', { locale: ptBR });
          map.set(d, (map.get(d) ?? 0) + Number(o.total) - Number(o.desconto ?? 0));
        });
        return Array.from(map.entries()).map(([d, v]) => ({ d, v }));
      }

      if (period === '30d') {
        const start = subDays(startOfDay(new Date()), 29).toISOString();
        const { data } = await supabase.from('orders')
          .select('fechada_em,total,desconto')
          .eq('barbershop_id', bid!).eq('status', 'fechada').gte('fechada_em', start);
        const map = new Map<string, number>();
        for (let i = 29; i >= 0; i--) {
          const d = format(subDays(new Date(), i), 'dd/MM');
          map.set(d, 0);
        }
        (data ?? []).forEach((o: any) => {
          if (!o.fechada_em) return;
          const d = format(new Date(o.fechada_em), 'dd/MM');
          map.set(d, (map.get(d) ?? 0) + Number(o.total) - Number(o.desconto ?? 0));
        });
        return Array.from(map.entries()).map(([d, v], i) => ({
          d: i % 5 === 0 || i === 29 ? d : '',
          v,
        }));
      }

      // 12m
      const start = startOfMonth(subMonths(new Date(), 11)).toISOString();
      const { data } = await supabase.from('orders')
        .select('fechada_em,total,desconto')
        .eq('barbershop_id', bid!).eq('status', 'fechada').gte('fechada_em', start);
      const map = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const d = format(subMonths(new Date(), i), 'MMM', { locale: ptBR });
        map.set(d, 0);
      }
      (data ?? []).forEach((o: any) => {
        if (!o.fechada_em) return;
        const d = format(new Date(o.fechada_em), 'MMM', { locale: ptBR });
        map.set(d, (map.get(d) ?? 0) + Number(o.total) - Number(o.desconto ?? 0));
      });
      return Array.from(map.entries()).map(([d, v]) => ({ d, v }));
    },
  });

  // Period totals for comparison
  const { data: periodStats } = useQuery({
    queryKey: ['dashboard-period-stats', bid, period],
    enabled: !!bid,
    queryFn: async () => {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 365;
      const curStart = subDays(startOfDay(new Date()), days - 1).toISOString();
      const prevStart = subDays(startOfDay(new Date()), days * 2 - 1).toISOString();
      const prevEnd   = subDays(endOfDay(new Date()), days).toISOString();

      const [{ data: cur }, { data: prev }] = await Promise.all([
        supabase.from('orders').select('total,desconto')
          .eq('barbershop_id', bid!).eq('status', 'fechada').gte('fechada_em', curStart),
        supabase.from('orders').select('total,desconto')
          .eq('barbershop_id', bid!).eq('status', 'fechada')
          .gte('fechada_em', prevStart).lte('fechada_em', prevEnd),
      ]);
      const curTotal  = (cur ?? []).reduce((s, o: any) => s + Number(o.total) - Number(o.desconto ?? 0), 0);
      const prevTotal = (prev ?? []).reduce((s, o: any) => s + Number(o.total) - Number(o.desconto ?? 0), 0);
      const pct = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : null;
      return { curTotal, pct };
    },
  });

  const { data: topBarbers } = useQuery({
    queryKey: ['top-barbers', bid],
    enabled: !!bid,
    queryFn: async () => {
      const start = subDays(new Date(), 30).toISOString();
      const { data: orders } = await supabase.from('orders')
        .select('barber_id,total,desconto,barbers(nome_exibicao)')
        .eq('barbershop_id', bid!).eq('status', 'fechada').gte('fechada_em', start);
      const map = new Map<string, { nome: string; total: number }>();
      (orders ?? []).forEach((o: any) => {
        const key = o.barber_id;
        const nome = o.barbers?.nome_exibicao ?? '—';
        const cur = map.get(key) ?? { nome, total: 0 };
        cur.total += Number(o.total) - Number(o.desconto ?? 0);
        map.set(key, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    },
  });

  const max = Math.max(1, ...(chart ?? []).map(c => c.v));
  const totalAtendimentos = today?.total_orders ?? cashSummary?.total_atendimentos ?? 0;
  const ticketMedio = today?.ticket ?? cashSummary?.ticket_medio ?? 0;
  const faturamento = today?.faturamento ?? cashSummary?.total_entradas ?? 0;
  const sangrias = cashSummary?.total_sangrias ?? 0;

  const periodLabel = period === '7d' ? 'últimos 7 dias' : period === '30d' ? 'últimos 30 dias' : 'últimos 12 meses';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi icon={DollarSign} label="Faturamento hoje" value={formatBRL(faturamento)} color="text-emerald-400" />
        <Kpi
          icon={Receipt}
          label="Atendimentos hoje"
          value={String(totalAtendimentos)}
          sub={`${today?.appts.filter((a: any) => a.status === 'finalizado').length ?? 0} finalizados`}
        />
        <Kpi icon={Users} label="Ticket médio" value={formatBRL(ticketMedio)} />
        <Kpi icon={ArrowDownCircle} label="Sangrias hoje" value={formatBRL(sangrias)} color={sangrias > 0 ? 'text-red-400' : undefined} />
      </div>

      {/* Charts + rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-medium capitalize">Faturamento — {periodLabel}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted">
                  {formatBRL(periodStats?.curTotal ?? 0)} total
                </span>
                {periodStats?.pct != null && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${periodStats.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {periodStats.pct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(periodStats.pct).toFixed(1)}% vs anterior
                  </span>
                )}
              </div>
            </div>
            {/* Period switcher */}
            <div className="flex gap-1 bg-ink-900 rounded-lg p-1">
              {(['7d', '30d', '12m'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    period === p ? 'bg-ink-700 text-ink-50' : 'text-muted hover:text-ink-300'
                  }`}
                >
                  {p === '7d' ? '7D' : p === '30d' ? '30D' : '12M'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-1 h-44 overflow-hidden">
            {(chart ?? []).map((c, i) => {
              const isLast = i === (chart?.length ?? 0) - 1;
              const pct = (c.v / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                  <div className="w-full flex flex-col justify-end" style={{ height: '140px' }}>
                    {c.v > 0 && (
                      <div className="text-[9px] text-muted text-center mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {formatBRL(c.v)}
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t transition-all ${isLast ? 'opacity-100' : 'opacity-50'} hover:opacity-100`}
                      style={{
                        height: `${Math.max(pct, c.v > 0 ? 4 : 0)}%`,
                        background: isLast ? 'var(--text)' : 'var(--bg-hover)',
                        minHeight: c.v > 0 ? '4px' : '2px',
                      }}
                    />
                  </div>
                  {c.d && (
                    <div className={`text-[10px] truncate w-full text-center ${isLast ? 'font-medium' : 'text-muted'} capitalize`}>
                      {c.d}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top barbers */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Top barbeiros — 30d</h3>
            <Award size={14} className="text-muted" />
          </div>
          <div className="space-y-4">
            {(topBarbers ?? []).map((b, i) => {
              const topTotal = topBarbers?.[0]?.total ?? 1;
              const pct = (b.total / topTotal) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted w-3">{i + 1}</span>
                      <span className="text-sm truncate max-w-[120px]">{b.nome}</span>
                    </div>
                    <span className="text-xs font-medium shrink-0">{formatBRL(b.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--text)' }} />
                  </div>
                </div>
              );
            })}
            {(!topBarbers || topBarbers.length === 0) && (
              <p className="text-sm text-muted text-center py-4">Sem dados no período</p>
            )}
          </div>
        </div>
      </div>

      {/* Cash session info if open */}
      {session && (
        <div className="mt-4">
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-muted uppercase tracking-wide mb-1">Saldo estimado no caixa agora</div>
                <div className="text-3xl font-semibold text-emerald-400">
                  {formatBRL(cashSummary?.saldo_estimado ?? 0)}
                </div>
              </div>
              <div className="flex gap-6 text-sm flex-wrap">
                {[
                  { label: 'PIX',      value: cashSummary?.total_pix ?? 0 },
                  { label: 'Dinheiro', value: cashSummary?.total_dinheiro ?? 0 },
                  { label: 'Débito',   value: cashSummary?.total_debito ?? 0 },
                  { label: 'Crédito',  value: cashSummary?.total_credito ?? 0 },
                ].filter(x => x.value > 0).map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-xs text-muted">{label}</div>
                    <div className="font-medium">{formatBRL(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Access */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-4 ml-1">Acesso Rápido</h3>
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.to}
              onClick={() => navigate(action.to)}
              className="card p-4 flex flex-col items-center justify-center gap-3 hover:bg-hover-soft transition-all group border-transparent hover:border-border"
            >
              <div className={`p-3 rounded-xl ${action.color} group-hover:scale-110 transition-transform`}>
                <action.icon size={24} />
              </div>
              <span className="text-xs font-bold uppercase tracking-tighter text-ink-300">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
        <Icon size={15} className="text-muted" />
      </div>
      <div className={`text-xl md:text-2xl font-semibold truncate ${color ?? ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
