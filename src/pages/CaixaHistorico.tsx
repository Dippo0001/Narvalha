import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import Modal from '../components/Modal';
import { formatBRL } from '../lib/utils';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2, AlertCircle, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Receipt, Banknote, Smartphone, CreditCard, ChevronLeft,
} from 'lucide-react';

export default function CaixaHistorico() {
  const { barbershop } = useAuth();
  const nav = useNavigate();
  const [selected, setSelected] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const PAGE = 10;

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['cash-history', barbershop?.id, page],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('cash_sessions').select('*, members!cash_sessions_opened_by_fkey(id)')
        .eq('barbershop_id', barbershop!.id).eq('status', 'fechado')
        .order('closed_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      return data ?? [];
    },
  });

  const { data: sessionDetail } = useQuery({
    queryKey: ['cash-session-detail', selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const [{ data: mvts }, { data: orders }] = await Promise.all([
        supabase.from('cash_movements').select('*').eq('cash_session_id', selected.id).order('data'),
        supabase.from('orders').select('total,gorjeta,forma_pagamento').eq('cash_session_id', selected.id).eq('status', 'fechada'),
      ]);
      return { mvts: mvts ?? [], orders: orders ?? [] };
    },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-ghost px-2 py-1.5" onClick={() => nav('/caixa')}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-2xl font-semibold">Histórico de caixas</h1>
      </div>

      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading && <Skeleton />}
        {!isLoading && (!sessions || sessions.length === 0) && (
          <div className="p-12 text-center text-muted text-sm">Nenhum caixa fechado ainda</div>
        )}
        {(sessions ?? []).map((s: any) => {
          const dur = s.closed_at ? formatDuration(
            intervalToDuration({ start: new Date(s.opened_at), end: new Date(s.closed_at) }),
            { locale: ptBR, format: ['hours', 'minutes'] }
          ) : '';
          const diff = Number(s.diferenca ?? 0);
          const DiffIcon = Math.abs(diff) <= 5 ? CheckCircle2 : diff < -5 ? AlertCircle : AlertTriangle;
          const diffColor = Math.abs(diff) <= 5 ? 'text-emerald-400' : diff < -5 ? 'text-red-400' : 'text-amber-400';
          return (
            <div key={s.id} className="px-5 py-4 hover:bg-hover-soft transition-colors cursor-pointer flex items-center gap-4"
              onClick={() => setSelected(s)}>
              <DiffIcon size={18} className={diffColor} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {format(new Date(s.opened_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {format(new Date(s.opened_at), 'HH:mm')}
                  {s.closed_at && ` → ${format(new Date(s.closed_at), 'HH:mm')}`}
                  {dur && ` · ${dur}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-emerald-400">
                  {formatBRL(Number(s.saldo_final ?? 0))}
                </div>
                <div className={`text-xs ${diffColor}`}>
                  {diff >= 0 ? '+' : ''}{formatBRL(diff)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(sessions?.length ?? 0) >= PAGE && (
        <div className="flex gap-2 justify-center mt-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-outline px-4">Anterior</button>
          <button onClick={() => setPage(p => p + 1)} className="btn-outline px-4">Próxima</button>
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Relatório de fechamento" wide>
        {selected && sessionDetail && (
          <SessionReport session={selected} mvts={sessionDetail.mvts} orders={sessionDetail.orders} />
        )}
      </Modal>
    </div>
  );
}

function SessionReport({ session, mvts, orders }: { session: any; mvts: any[]; orders: any[] }) {
  const total_entradas    = mvts.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const total_sangrias    = mvts.filter(m => m.tipo === 'sangria').reduce((s, m) => s + Number(m.valor), 0);
  const total_suprimentos = mvts.filter(m => m.tipo === 'suprimento').reduce((s, m) => s + Number(m.valor), 0);
  const byForma = (f: string) => mvts.filter(m => m.tipo === 'entrada' && m.forma_pagamento === f).reduce((s, m) => s + Number(m.valor), 0);

  const diff = Number(session.diferenca ?? 0);
  const diffStatus = Math.abs(diff) <= 5 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex justify-between text-sm">
        <div>
          <div className="font-medium">{format(new Date(session.opened_at), "EEEE, dd/MM/yyyy", { locale: ptBR })}</div>
          <div className="text-muted">
            {format(new Date(session.opened_at), 'HH:mm')}
            {session.closed_at && ` → ${format(new Date(session.closed_at), 'HH:mm')}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Diferença</div>
          <div className={`text-lg font-semibold ${diffStatus}`}>
            {diff >= 0 ? '+' : ''}{formatBRL(diff)}
          </div>
        </div>
      </div>

      {/* Movimentações */}
      <div>
        <div className="text-xs text-muted uppercase tracking-wide mb-2">Movimentações</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="flex items-center gap-1.5"><TrendingUp size={13} className="text-emerald-400" /> Vendas ({orders.length})</span><span className="text-emerald-400">+{formatBRL(total_entradas)}</span></div>
          {total_sangrias > 0 && <div className="flex justify-between"><span className="flex items-center gap-1.5"><TrendingDown size={13} className="text-red-400" /> Sangrias</span><span className="text-red-400">−{formatBRL(total_sangrias)}</span></div>}
          {total_suprimentos > 0 && <div className="flex justify-between"><span className="flex items-center gap-1.5"><TrendingUp size={13} className="text-sky-400" /> Suprimentos</span><span className="text-sky-400">+{formatBRL(total_suprimentos)}</span></div>}
        </div>
      </div>

      {/* Formas */}
      <div>
        <div className="text-xs text-muted uppercase tracking-wide mb-2">Formas de pagamento</div>
        {[['dinheiro','Dinheiro',Banknote],['pix','PIX',Smartphone],['debito','Débito',CreditCard],['credito','Crédito',CreditCard]].map(([f, l, Ic]: any) => {
          const v = byForma(f); if (!v) return null;
          return (
            <div key={f} className="flex justify-between text-sm py-1.5">
              <span className="flex items-center gap-1.5 text-muted"><Ic size={13} />{l}</span>
              <span>{formatBRL(v)}</span>
            </div>
          );
        })}
      </div>

      {/* Saldo */}
      <div className="card p-4 space-y-2 text-sm font-mono">
        <div className="flex justify-between text-muted"><span>+ Saldo inicial</span><span>{formatBRL(Number(session.saldo_inicial))}</span></div>
        <div className="flex justify-between text-muted"><span>+ Dinheiro recebido</span><span>{formatBRL(byForma('dinheiro'))}</span></div>
        {total_suprimentos > 0 && <div className="flex justify-between text-muted"><span>+ Suprimentos</span><span>{formatBRL(total_suprimentos)}</span></div>}
        {total_sangrias > 0 && <div className="flex justify-between text-red-400"><span>− Sangrias</span><span>{formatBRL(total_sangrias)}</span></div>}
        <div className="border-t pt-2 flex justify-between font-semibold" style={{ borderColor: 'var(--border)' }}>
          <span>Saldo esperado</span><span>{formatBRL(Number(session.saldo_esperado ?? 0))}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Saldo contado</span><span>{formatBRL(Number(session.saldo_final ?? 0))}</span>
        </div>
        <div className={`flex justify-between font-bold ${diffStatus}`}>
          <span>Diferença</span><span>{diff >= 0 ? '+' : ''}{formatBRL(diff)}</span>
        </div>
      </div>

      {session.observacoes_fechamento && (
        <div className="text-xs text-muted p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
          Obs: {session.observacoes_fechamento}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <>{[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
        <div className="w-4 h-4 rounded-full shrink-0" style={{ background: 'var(--bg-hover)' }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-hover)' }} />
          <div className="h-2.5 rounded w-1/4" style={{ background: 'var(--bg-hover)' }} />
        </div>
        <div className="h-4 w-20 rounded" style={{ background: 'var(--bg-hover)' }} />
      </div>
    ))}</>
  );
}
