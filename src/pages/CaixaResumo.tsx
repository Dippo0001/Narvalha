import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import Modal from '../components/Modal';
import { formatBRL } from '../lib/utils';
import { format, formatDistanceToNow, parseISO, intervalToDuration, formatDuration } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Receipt, Users, DollarSign, Lock, History, ArrowRight,
  CheckCircle2, AlertCircle, AlertTriangle, Banknote, Smartphone, CreditCard,
} from 'lucide-react';

type SubTab = 'resumo' | 'movimentos' | 'fechar';

export default function CaixaResumo() {
  const { barbershop, member } = useAuth();
  const { session, summary, refresh } = useCash();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>('resumo');
  const [movModal, setMovModal] = useState<'sangria' | 'suprimento' | null>(null);

  const { data: movements } = useQuery({
    queryKey: ['cash-movements-session', session?.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from('cash_movements').select('*')
        .eq('cash_session_id', session!.id).order('data', { ascending: false });
      return data ?? [];
    },
  });

  const doMovement = async (tipo: 'sangria' | 'suprimento', valor: number, descricao: string) => {
    if (!session || !barbershop || !member) return;
    const { error } = await supabase.rpc('cash_movement_extra', {
      p_session_id: session.id,
      p_barbershop_id: barbershop.id,
      p_member_id: member.id,
      p_tipo: tipo,
      p_valor: valor,
      p_descricao: descricao,
    });
    if (error) return toast.error(error.message);
    toast.success(tipo === 'sangria' ? `Sangria de ${formatBRL(valor)} registrada` : `Suprimento de ${formatBRL(valor)} registrado`);
    await refresh();
    qc.invalidateQueries({ queryKey: ['cash-movements-session'] });
    setMovModal(null);
  };

  if (!session) return (
    <div className="p-8 max-w-xl mx-auto flex flex-col items-center gap-6 pt-20">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
        <DollarSign size={36} className="text-muted" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-1">Caixa fechado</h2>
        <p className="text-sm text-muted">Abra o caixa para registrar vendas e movimentações do dia.</p>
      </div>
      <div className="flex gap-3">
        <button className="btn-outline gap-1.5" onClick={() => nav('/caixa/historico')}>
          <History size={15} /> Ver histórico
        </button>
        <button className="btn-primary gap-1.5" onClick={() => nav('/caixa/abrir')}>
          Abrir caixa <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );

  const since = formatDistanceToNow(new Date(session.opened_at), { locale: ptBR, addSuffix: false });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-2xl font-semibold">Caixa aberto</h1>
          </div>
          <p className="text-sm text-muted mt-0.5 ml-4.5">
            há {since} · desde {format(new Date(session.opened_at), 'HH:mm')} · saldo inicial {formatBRL(session.saldo_inicial)}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'resumo',    label: 'Resumo' },
          { key: 'movimentos', label: 'Sangria / Suprimento' },
          { key: 'fechar',    label: 'Fechar Caixa / Histórico' },
        ] as { key: SubTab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors whitespace-nowrap
              ${subTab === key ? 'border-current font-medium' : 'border-transparent text-muted hover:text-current'}`}
            style={subTab === key ? { borderColor: 'var(--text)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── RESUMO ── */}
      {subTab === 'resumo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={TrendingUp}   label="Vendas"        value={formatBRL(summary?.total_entradas ?? 0)} color="text-emerald-400" />
            <Kpi icon={TrendingDown} label="Sangrias"       value={formatBRL(summary?.total_sangrias ?? 0)} color="text-red-400" />
            <Kpi icon={Receipt}      label="Atendimentos"   value={String(summary?.total_atendimentos ?? 0)} />
            <Kpi icon={Users}        label="Ticket médio"   value={formatBRL(summary?.ticket_medio ?? 0)} />
          </div>

          <div className="card p-6 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted uppercase tracking-wide mb-1">Saldo estimado</div>
              <div className="text-4xl font-semibold">{formatBRL(summary?.saldo_estimado ?? 0)}</div>
              <div className="text-xs text-muted mt-1 space-x-2">
                <span>{formatBRL(session.saldo_inicial)} inicial</span>
                {(summary?.total_dinheiro ?? 0) > 0 && <span>+ {formatBRL(summary!.total_dinheiro)} dinheiro</span>}
                {(summary?.total_suprimentos ?? 0) > 0 && <span>+ {formatBRL(summary!.total_suprimentos)} suprimentos</span>}
                {(summary?.total_sangrias ?? 0) > 0 && <span>− {formatBRL(summary!.total_sangrias)} sangrias</span>}
              </div>
            </div>
            <DollarSign size={40} className="text-muted opacity-20" />
          </div>

          {/* Movimentações da sessão */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <span className="font-medium text-sm">Movimentações de hoje</span>
              <span className="text-xs text-muted">{(movements ?? []).length} registros</span>
            </div>
            <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              {(!movements || movements.length === 0) && (
                <div className="p-8 text-center text-muted text-sm">Nenhuma movimentação ainda</div>
              )}
              {(movements ?? []).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm">{m.descricao || m.categoria}</div>
                    <div className="text-xs text-muted">
                      {format(new Date(m.data), 'HH:mm')} · {m.tipo}
                      {m.forma_pagamento ? ` · ${m.forma_pagamento}` : ''}
                    </div>
                  </div>
                  <span className={`font-medium text-sm ${m.tipo === 'entrada' || m.tipo === 'suprimento' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.tipo === 'entrada' || m.tipo === 'suprimento' ? '+' : '−'}{formatBRL(Number(m.valor))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SANGRIA / SUPRIMENTO ── */}
      {subTab === 'movimentos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <ArrowDownCircle size={20} className="text-red-400" />
                </div>
                <div>
                  <div className="font-semibold">Sangria</div>
                  <div className="text-xs text-muted">Retirada de dinheiro do caixa</div>
                </div>
              </div>
              <p className="text-xs text-muted">
                Use para levar dinheiro ao cofre, pagar despesas ou reduzir o troco físico.
              </p>
              <button className="btn-primary w-full gap-1.5" style={{ background: 'rgb(220 38 38)', color: 'white' }}
                onClick={() => setMovModal('sangria')}>
                <ArrowDownCircle size={15} /> Registrar sangria
              </button>
            </div>

            <div className="card p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <ArrowUpCircle size={20} className="text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold">Suprimento</div>
                  <div className="text-xs text-muted">Entrada de dinheiro no caixa</div>
                </div>
              </div>
              <p className="text-xs text-muted">
                Use para adicionar troco, reforço de caixa ou dinheiro de outra fonte.
              </p>
              <button className="btn-primary w-full gap-1.5"
                onClick={() => setMovModal('suprimento')}>
                <ArrowUpCircle size={15} /> Registrar suprimento
              </button>
            </div>
          </div>

          {/* Historico sangrias/suprimentos */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b text-sm font-medium" style={{ borderColor: 'var(--border)' }}>
              Sangrias e suprimentos de hoje
            </div>
            <div className="divide-y max-h-64 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              {(movements ?? []).filter((m: any) => m.tipo === 'sangria' || m.tipo === 'suprimento').length === 0 && (
                <div className="p-8 text-center text-muted text-sm">Nenhuma sangria ou suprimento hoje</div>
              )}
              {(movements ?? []).filter((m: any) => m.tipo === 'sangria' || m.tipo === 'suprimento').map((m: any) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm">{m.descricao}</div>
                    <div className="text-xs text-muted">{format(new Date(m.data), 'HH:mm')} · {m.tipo}</div>
                  </div>
                  <span className={`font-medium text-sm ${m.tipo === 'suprimento' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.tipo === 'suprimento' ? '+' : '−'}{formatBRL(Number(m.valor))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FECHAR / HISTÓRICO ── */}
      {subTab === 'fechar' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <div className="text-sm font-medium mb-2">Fechar caixa</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted"><span>Saldo inicial</span><span>{formatBRL(session.saldo_inicial)}</span></div>
              <div className="flex justify-between text-emerald-400"><span>+ Vendas</span><span>{formatBRL(summary?.total_entradas ?? 0)}</span></div>
              {(summary?.total_suprimentos ?? 0) > 0 && <div className="flex justify-between text-sky-400"><span>+ Suprimentos</span><span>{formatBRL(summary!.total_suprimentos)}</span></div>}
              {(summary?.total_sangrias ?? 0) > 0 && <div className="flex justify-between text-red-400"><span>− Sangrias</span><span>{formatBRL(summary!.total_sangrias)}</span></div>}
              <div className="border-t pt-2 flex justify-between font-semibold" style={{ borderColor: 'var(--border)' }}>
                <span>Saldo esperado</span>
                <span>{formatBRL(summary?.saldo_estimado ?? 0)}</span>
              </div>
            </div>
            <button className="btn-primary w-full gap-2" onClick={() => nav('/caixa/fechar')}>
              <Lock size={15} /> Ir para fechamento completo
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <span className="font-medium text-sm">Histórico de caixas</span>
              <button className="btn-ghost px-2 py-1 text-xs gap-1" onClick={() => nav('/caixa/historico')}>
                Ver todos <ArrowRight size={12} />
              </button>
            </div>
            <HistoricoPreview />
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={movModal === 'sangria'} onClose={() => setMovModal(null)} title="Sangria de caixa">
        <MovementForm tipo="sangria" saldoAtual={summary?.saldo_estimado ?? 0}
          onSave={(v, d) => doMovement('sangria', v, d)} />
      </Modal>
      <Modal open={movModal === 'suprimento'} onClose={() => setMovModal(null)} title="Suprimento de caixa">
        <MovementForm tipo="suprimento" saldoAtual={summary?.saldo_estimado ?? 0}
          onSave={(v, d) => doMovement('suprimento', v, d)} />
      </Modal>
    </div>
  );
}

/* ── Historico preview ───────────────────────────────────────────── */
function HistoricoPreview() {
  const { barbershop } = useAuth();
  const { data } = useQuery({
    queryKey: ['cash-history-preview', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('cash_sessions').select('*')
        .eq('barbershop_id', barbershop!.id).eq('status', 'fechado')
        .order('closed_at', { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  if (!data || data.length === 0) return (
    <div className="p-6 text-center text-muted text-sm">Nenhum caixa fechado ainda</div>
  );

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {data.map((s: any) => {
        const diff = Number(s.diferenca ?? 0);
        const DiffIcon = Math.abs(diff) <= 5 ? CheckCircle2 : diff < 0 ? AlertCircle : AlertTriangle;
        const diffColor = Math.abs(diff) <= 5 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-amber-400';
        const dur = s.closed_at ? formatDuration(
          intervalToDuration({ start: new Date(s.opened_at), end: new Date(s.closed_at) }),
          { locale: ptBR, format: ['hours', 'minutes'] }
        ) : '';
        return (
          <div key={s.id} className="flex items-center gap-3 px-5 py-3">
            <DiffIcon size={15} className={diffColor} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{format(new Date(s.opened_at), "dd/MM/yy", { locale: ptBR })}</div>
              <div className="text-xs text-muted">{dur}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-emerald-400">{formatBRL(Number(s.saldo_final ?? 0))}</div>
              <div className={`text-xs ${diffColor}`}>{diff >= 0 ? '+' : ''}{formatBRL(diff)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────── */
function MovementForm({ tipo, saldoAtual, onSave }: {
  tipo: 'sangria' | 'suprimento'; saldoAtual: number; onSave: (valor: number, desc: string) => void;
}) {
  const [valor, setValor] = useState(0);
  const [desc, setDesc] = useState(tipo === 'sangria' ? 'Levado ao cofre' : 'Suprimento de troco');
  const novoSaldo = tipo === 'sangria' ? saldoAtual - valor : saldoAtual + valor;
  const invalid = tipo === 'sangria' && valor > saldoAtual;

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(valor, desc); }} className="space-y-5">
      <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--bg-hover)' }}>
        Saldo atual: <strong>{formatBRL(saldoAtual)}</strong>
      </div>
      <div>
        <label className="label">Valor (R$)</label>
        <input className="input text-xl font-semibold text-center py-4" type="number" step="0.01" min={0.01}
          value={valor || ''} onChange={e => setValor(+e.target.value)} required autoFocus />
        {valor > 0 && (
          <p className={`text-xs mt-1.5 ${invalid ? 'text-red-400' : 'text-muted'}`}>
            {invalid ? 'Valor maior que o saldo disponível' : `Novo saldo: ${formatBRL(novoSaldo)}`}
          </p>
        )}
      </div>
      <div>
        <label className="label">Observação</label>
        <input className="input" value={desc} onChange={e => setDesc(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={invalid || valor <= 0}>Confirmar {tipo}</button>
    </form>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Icon size={18} className={color ?? 'text-muted'} />
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className={`text-lg font-semibold ${color ?? ''}`}>{value}</div>
      </div>
    </div>
  );
}
