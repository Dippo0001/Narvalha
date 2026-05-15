import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import { formatBRL } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, Banknote, Smartphone, CreditCard,
  AlertCircle, CheckCircle2, AlertTriangle, Receipt,
} from 'lucide-react';

export default function CaixaFechar() {
  const { barbershop, member } = useAuth();
  const { session, summary, refresh } = useCash();
  const nav = useNavigate();

  const [saldoFinal, setSaldoFinal] = useState(0);
  const [obs, setObs] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(false);

  const isBlind = barbershop?.caixa_as_cegas ?? false;

  const { data: movements } = useQuery({
    queryKey: ['cash-movements-close', session?.id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from('cash_movements').select('*')
        .eq('cash_session_id', session!.id).order('data');
      return data ?? [];
    },
  });

  if (!session) return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <p className="text-muted">Nenhum caixa aberto.</p>
    </div>
  );

  const saldoEsperado = summary?.saldo_estimado ?? 0;
  const diferenca = saldoFinal - saldoEsperado;
  const diffAbs = Math.abs(diferenca);

  const diffStatus = diffAbs <= 5
    ? { label: 'Conferido', color: 'text-emerald-400', bg: 'rgb(6 78 59 / 0.3)', icon: CheckCircle2 }
    : diferenca > 0
    ? { label: `Sobra de ${formatBRL(diferenca)}`, color: 'text-amber-400', bg: 'rgb(120 53 15 / 0.3)', icon: AlertTriangle }
    : { label: `Falta de ${formatBRL(diffAbs)} — ATENÇÃO`, color: 'text-red-400', bg: 'rgb(127 29 29 / 0.3)', icon: AlertCircle };

  const close = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmado) return toast.error('Confirme a contagem do caixa');
    if (!member || !session) return;
    setLoading(true);

    const { error } = await supabase.rpc('close_cash_session', {
      p_session_id: session.id,
      p_member_id: member.id,
      p_saldo_final: saldoFinal,
      p_obs: obs,
    });

    setLoading(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success(`Caixa fechado. Diferença: ${formatBRL(diferenca)}`);
    nav('/caixa/historico');
  };

  const byForma = (forma: string) =>
    (movements ?? []).filter((m: any) => m.tipo === 'entrada' && m.forma_pagamento === forma)
      .reduce((s: number, m: any) => s + Number(m.valor), 0);

  const countForma = (forma: string) =>
    (movements ?? []).filter((m: any) => m.tipo === 'entrada' && m.forma_pagamento === forma).length;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fechar caixa</h1>
        <p className="text-sm text-muted mt-0.5">
          Aberto às {format(new Date(session.opened_at), "HH:mm 'de' dd/MM", { locale: ptBR })}
        </p>
      </div>

      {!isBlind && (
        <>
          {/* Resumo do dia */}
          <div className="card p-5 space-y-3">
            <div className="text-sm font-medium text-muted uppercase tracking-wide">Resumo do dia</div>
            <div className="grid grid-cols-2 gap-3">
              <StatRow icon={TrendingUp}   label="Total vendas"         value={formatBRL(summary?.total_entradas ?? 0)} color="text-emerald-400" />
              <StatRow icon={Receipt}      label="Atendimentos"         value={String(summary?.total_atendimentos ?? 0)} />
              <StatRow icon={TrendingDown} label="Sangrias"             value={formatBRL(summary?.total_sangrias ?? 0)} color="text-red-400" />
              <StatRow icon={TrendingUp}   label="Suprimentos"          value={formatBRL(summary?.total_suprimentos ?? 0)} color="text-sky-400" />
            </div>
          </div>

          {/* Formas de pagamento */}
          <div className="card p-5">
            <div className="text-sm font-medium text-muted uppercase tracking-wide mb-4">Formas recebidas</div>
            <div className="space-y-2">
              {[
                { label: 'Dinheiro', forma: 'dinheiro', icon: Banknote },
                { label: 'PIX',      forma: 'pix',      icon: Smartphone },
                { label: 'Débito',   forma: 'debito',   icon: CreditCard },
                { label: 'Crédito',  forma: 'credito',  icon: CreditCard },
              ].map(({ label, forma, icon: Icon }) => {
                const val = byForma(forma);
                const cnt = countForma(forma);
                if (val === 0) return null;
                return (
                  <div key={forma} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon size={14} className="text-muted" />
                      <span>{label}</span>
                      <span className="text-muted text-xs">({cnt} venda{cnt !== 1 ? 's' : ''})</span>
                    </div>
                    <span className="font-medium text-emerald-400">{formatBRL(val)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between font-semibold pt-2">
                <span>Total</span>
                <span>{formatBRL(summary?.total_entradas ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Saldo esperado */}
          <div className="card p-5 space-y-3">
            <div className="text-sm font-medium text-muted uppercase tracking-wide">Cálculo do saldo esperado</div>
            <div className="space-y-1.5 text-sm font-mono">
              <CalcRow label="Saldo inicial"       sign="+"  value={session.saldo_inicial} />
              <CalcRow label="Entradas (dinheiro)" sign="+"  value={summary?.total_dinheiro ?? 0} />
              <CalcRow label="Suprimentos"         sign="+"  value={summary?.total_suprimentos ?? 0} />
              <CalcRow label="Sangrias"            sign="−"  value={summary?.total_sangrias ?? 0} color="text-red-400" />
              <div className="border-t pt-2 flex justify-between font-semibold" style={{ borderColor: 'var(--border)' }}>
                <span>Saldo esperado</span>
                <span>{formatBRL(saldoEsperado)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contagem real */}
      <form onSubmit={close} className="card p-5 space-y-5">
        <div className="text-sm font-medium text-muted uppercase tracking-wide">Contagem real do caixa</div>
        <div>
          <label className="label">Quanto tem fisicamente no caixa agora? (R$)</label>
          <input className="input text-2xl font-semibold text-center py-4" type="number" step="0.01" min={0}
            value={saldoFinal || ''} onChange={e => setSaldoFinal(+e.target.value)} required autoFocus />
        </div>

        {saldoFinal > 0 && !isBlind && (
          <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: diffStatus.bg }}>
            <diffStatus.icon size={18} className={diffStatus.color} />
            <div>
              <div className={`text-sm font-medium ${diffStatus.color}`}>{diffStatus.label}</div>
              {diffAbs > 5 && (
                <div className="text-xs text-muted mt-0.5">
                  Esperado: {formatBRL(saldoEsperado)} · Contado: {formatBRL(saldoFinal)}
                </div>
              )}
            </div>
          </div>
        )}

        {isBlind && (
          <div className="p-4 bg-ink-900/50 border border-ink-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <AlertTriangle size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Modo às Cegas</span>
            </div>
            <p className="text-[11px] text-ink-400">
              O sistema não mostrará os valores esperados. A conferência será realizada após o fechamento pelo gestor.
            </p>
          </div>
        )}

        <div>
          <label className="label">Observações do fechamento</label>
          <textarea className="input" rows={2} value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex: caixa conferido, troco entregue ao gerente" />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-1" />
          <span className="text-sm">Confirmo que conferi o caixa físico e os valores acima estão corretos</span>
        </label>

        <div className="flex gap-3">
          <button type="button" className="btn-outline flex-1" onClick={() => nav('/caixa')}>
            Cancelar
          </button>
          <button className="btn-primary flex-1" disabled={!confirmado || loading}>
            {loading ? 'Fechando…' : 'Fechar caixa'}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
      <Icon size={15} className={color ?? 'text-muted'} />
      <div className="flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className={`text-sm font-semibold ${color ?? ''}`}>{value}</div>
      </div>
    </div>
  );
}

function CalcRow({ label, sign, value, color }: { label: string; sign: string; value: number; color?: string }) {
  if (value === 0) return null;
  return (
    <div className={`flex justify-between ${color ?? 'text-muted'}`}>
      <span>{sign} {label}</span>
      <span>{formatBRL(value)}</span>
    </div>
  );
}
