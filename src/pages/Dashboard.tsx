import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import PageHeader from '../components/PageHeader';
import { formatBRL } from '../lib/utils';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, Calendar, DollarSign, Award,
  ArrowDownCircle, Receipt, Users,
} from 'lucide-react';

export default function Dashboard() {
  const { barbershop } = useAuth();
  const { summary: cashSummary, session } = useCash();
  const bid = barbershop?.id;

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

  const { data: chart } = useQuery({
    queryKey: ['dashboard-chart', bid],
    enabled: !!bid,
    queryFn: async () => {
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        subtitle={format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={DollarSign}
          label="Faturamento hoje"
          value={formatBRL(faturamento)}
          color="text-emerald-400"
        />
        <Kpi
          icon={Receipt}
          label="Atendimentos hoje"
          value={String(totalAtendimentos)}
          sub={`${today?.appts.filter((a: any) => a.status === 'finalizado').length ?? 0} finalizados`}
        />
        <Kpi
          icon={Users}
          label="Ticket médio"
          value={formatBRL(ticketMedio)}
        />
        <Kpi
          icon={ArrowDownCircle}
          label="Sangrias hoje"
          value={formatBRL(sangrias)}
          color={sangrias > 0 ? 'text-red-400' : undefined}
        />
      </div>

      {/* Charts + rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium">Faturamento — últimos 7 dias</h3>
            <span className="text-xs text-muted">
              {formatBRL((chart ?? []).reduce((s, c) => s + c.v, 0))} total
            </span>
          </div>
          <div className="flex items-end gap-2 h-44">
            {(chart ?? []).map((c, i) => {
              const isToday = i === (chart?.length ?? 0) - 1;
              const pct = (c.v / max) * 100;
              return (
                <div key={c.d} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex flex-col justify-end" style={{ height: '152px' }}>
                    {c.v > 0 && (
                      <div className="text-[10px] text-muted text-center mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatBRL(c.v)}
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-md transition-all ${isToday ? 'opacity-100' : 'opacity-60'} hover:opacity-100`}
                      style={{
                        height: `${Math.max(pct, c.v > 0 ? 4 : 0)}%`,
                        background: isToday ? 'var(--text)' : 'var(--bg-hover)',
                        minHeight: c.v > 0 ? '6px' : '2px',
                      }}
                    />
                  </div>
                  <div className={`text-[11px] ${isToday ? 'font-medium' : 'text-muted'} capitalize`}>{c.d}</div>
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
                      <span className="text-sm">{b.nome}</span>
                    </div>
                    <span className="text-xs font-medium">{formatBRL(b.total)}</span>
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
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5 md:col-span-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-muted uppercase tracking-wide mb-1">Saldo estimado no caixa agora</div>
                <div className="text-3xl font-semibold text-emerald-400">
                  {formatBRL(cashSummary?.saldo_estimado ?? 0)}
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                {[
                  { label: 'PIX',     value: cashSummary?.total_pix ?? 0 },
                  { label: 'Dinheiro',value: cashSummary?.total_dinheiro ?? 0 },
                  { label: 'Débito',  value: cashSummary?.total_debito ?? 0 },
                  { label: 'Crédito', value: cashSummary?.total_credito ?? 0 },
                ].map(({ label, value }) => (
                  value > 0 ? (
                    <div key={label} className="text-center">
                      <div className="text-xs text-muted">{label}</div>
                      <div className="font-medium">{formatBRL(value)}</div>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
        <Icon size={15} className="text-muted" />
      </div>
      <div className={`text-2xl font-semibold truncate ${color ?? ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
