import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useCash } from '../lib/cash-context';
import { toast } from 'sonner';
import { Wallet, Info } from 'lucide-react';
import { formatBRL } from '../lib/utils';

export default function CaixaAbrir() {
  const { barbershop, member } = useAuth();
  const { refresh } = useCash();
  const nav = useNavigate();
  const [saldo, setSaldo] = useState(150);
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershop || !member) return;
    setLoading(true);

    const { error } = await supabase.rpc('open_cash_session', {
      p_barbershop_id: barbershop.id,
      p_member_id: member.id,
      p_saldo_inicial: saldo,
      p_obs: obs,
    });

    setLoading(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success('Caixa aberto');
    nav('/caixa');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-hover)' }}>
            <Wallet size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Abrir caixa</h1>
            <p className="text-sm text-muted">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <form onSubmit={open} className="space-y-5">
          <div>
            <label className="label">Saldo inicial (R$)</label>
            <input
              className="input text-2xl font-semibold text-center py-4"
              type="number"
              step="0.01"
              min={0}
              value={saldo}
              onChange={e => setSaldo(+e.target.value)}
              required
              autoFocus
            />
            <div className="flex items-start gap-2 mt-2 p-3 rounded-lg text-xs text-muted"
              style={{ background: 'var(--bg-hover)' }}>
              <Info size={13} className="mt-0.5 shrink-0" />
              Dica: mantenha R$ 150–200 de troco para o dia
            </div>
          </div>

          <div>
            <label className="label">Observações (opcional)</label>
            <textarea className="input" rows={2} value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: abertura normal, caixa conferido" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => nav(-1)}>
              Cancelar
            </button>
            <button className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Abrindo…' : `Abrir com ${formatBRL(saldo)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
