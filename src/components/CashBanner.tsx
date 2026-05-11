import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCash } from '../lib/cash-context';
import Modal from './Modal';
import { formatBRL } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';
import {
  ArrowDownCircle, ArrowUpCircle, Lock,
  TrendingUp, DollarSign,
} from 'lucide-react';

type MovType = 'sangria' | 'suprimento';

export default function CashBanner() {
  const { session, summary, refresh } = useCash();
  const { barbershop, member } = useAuth();
  const nav = useNavigate();
  const [movModal, setMovModal] = useState<MovType | null>(null);

  if (!session) return (
    <div className="border-b px-4 py-2.5 flex items-center justify-between text-sm"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}>
      <span className="text-muted flex items-center gap-2">
        <DollarSign size={14} /> Caixa fechado
      </span>
      <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => nav('/caixa/abrir')}>
        Abrir caixa
      </button>
    </div>
  );

  const since = formatDistanceToNow(new Date(session.opened_at), { locale: ptBR, addSuffix: false });

  const doMovement = async (tipo: MovType, valor: number, desc: string) => {
    if (!session || !barbershop || !member) return;
    const { error } = await supabase.rpc('cash_movement_extra', {
      p_session_id: session.id,
      p_barbershop_id: barbershop.id,
      p_member_id: member.id,
      p_tipo: tipo,
      p_valor: valor,
      p_descricao: desc,
    });
    if (error) return toast.error(error.message);
    toast.success(tipo === 'sangria' ? `Sangria de ${formatBRL(valor)} registrada` : `Suprimento de ${formatBRL(valor)} registrado`);
    await refresh();
    setMovModal(null);
  };

  return (
    <>
      <div className="border-b px-4 py-2 flex items-center gap-3 flex-wrap"
        style={{ borderColor: 'var(--border)', background: 'rgb(6 78 59 / 0.15)' }}>
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Caixa aberto há {since}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted flex-1">
          <span className="flex items-center gap-1">
            <TrendingUp size={11} /> {formatBRL(summary?.total_entradas ?? 0)}
          </span>
          <span>·</span>
          <span>{summary?.total_atendimentos ?? 0} atend.</span>
          <span>·</span>
          <span>Saldo estimado: <strong className="text-current">{formatBRL(summary?.saldo_estimado ?? 0)}</strong></span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => nav('/caixa')} className="btn-ghost px-2.5 py-1 text-xs">Ver detalhes</button>
          <button onClick={() => setMovModal('suprimento')} className="btn-ghost px-2.5 py-1 text-xs gap-1">
            <ArrowUpCircle size={12} /> Suprimento
          </button>
          <button onClick={() => setMovModal('sangria')} className="btn-ghost px-2.5 py-1 text-xs gap-1">
            <ArrowDownCircle size={12} /> Sangria
          </button>
          <button onClick={() => nav('/caixa/fechar')} className="btn-ghost px-2.5 py-1 text-xs gap-1 text-amber-400">
            <Lock size={12} /> Fechar
          </button>
        </div>
      </div>

      <Modal open={!!movModal} onClose={() => setMovModal(null)}
        title={movModal === 'sangria' ? 'Sangria de caixa' : 'Suprimento de caixa'}>
        {movModal && (
          <MovementForm tipo={movModal} saldoAtual={summary?.saldo_estimado ?? 0} onSave={doMovement} />
        )}
      </Modal>
    </>
  );
}

function MovementForm({ tipo, saldoAtual, onSave }: {
  tipo: MovType; saldoAtual: number; onSave: (tipo: MovType, valor: number, desc: string) => void;
}) {
  const [valor, setValor] = useState(0);
  const [desc, setDesc] = useState(tipo === 'sangria' ? 'Levado ao cofre' : 'Suprimento de troco');
  const novoSaldo = tipo === 'sangria' ? saldoAtual - valor : saldoAtual + valor;
  const invalid = tipo === 'sangria' && valor > saldoAtual;

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(tipo, valor, desc); }} className="space-y-5">
      <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--bg-hover)' }}>
        Saldo atual em caixa: <strong>{formatBRL(saldoAtual)}</strong>
      </div>
      <div>
        <label className="label">Valor (R$)</label>
        <input className="input text-xl font-semibold text-center py-4" type="number" step="0.01" min={0.01}
          value={valor || ''} onChange={e => setValor(+e.target.value)} required autoFocus />
        {valor > 0 && (
          <p className={`text-xs mt-1.5 ${invalid ? 'text-red-400' : 'text-muted'}`}>
            {invalid ? 'Valor maior que saldo disponível' : `Novo saldo: ${formatBRL(novoSaldo)}`}
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
