import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useBarberSession } from '../lib/barber-session-context';
import { toast } from 'sonner';
import { Scissors, Lock } from 'lucide-react';

export default function BarberLock() {
  const { barbershop } = useAuth();
  const { setActiveBarber } = useBarberSession();
  const [selected, setSelected] = useState<{ id: string; nome: string; pin: string | null } | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: barbers } = useQuery({
    queryKey: ['barbers-lock', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase
        .from('barbers')
        .select('id, nome_exibicao, barber_pin, barber_login')
        .eq('barbershop_id', barbershop!.id)
        .eq('ativo', true)
        .order('nome_exibicao');
      return data ?? [];
    },
  });

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    // Barbeiro sem PIN cadastrado → acesso direto (dono configurou depois)
    if (!selected.pin) {
      setActiveBarber({ id: selected.id, nome: selected.nome });
      return;
    }

    setLoading(true);
    if (pin !== selected.pin) {
      setLoading(false);
      toast.error('PIN incorreto');
      setPin('');
      return;
    }
    setLoading(false);
    setActiveBarber({ id: selected.id, nome: selected.nome });
  };

  if (selected) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center mx-auto text-2xl font-bold text-ink-50">
              {selected.nome.charAt(0)}
            </div>
            <h2 className="text-xl font-semibold">{selected.nome}</h2>
            <p className="text-sm text-ink-500">Digite seu PIN para entrar</p>
          </div>

          <form onSubmit={handleEnter} className="space-y-4">
            <div>
              <label className="label">PIN</label>
              <input
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required={!!selected.pin}
              />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verificando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="btn-ghost w-full text-ink-500"
              onClick={() => { setSelected(null); setPin(''); }}
            >
              Voltar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center mx-auto">
            <Scissors size={28} className="text-ink-300" />
          </div>
          <h1 className="logo text-3xl">Navalha</h1>
          <p className="text-sm text-ink-500">Selecione quem vai atender</p>
        </div>

        <div className="space-y-2">
          {(barbers ?? []).map((b: any) => (
            <button
              key={b.id}
              onClick={() => setSelected({ id: b.id, nome: b.nome_exibicao, pin: b.barber_pin })}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-ink-800 hover:bg-ink-800/50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center text-lg font-bold shrink-0">
                {b.nome_exibicao.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-ink-50">{b.nome_exibicao}</div>
                <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5">
                  {b.barber_pin
                    ? <><Lock size={10} /> PIN configurado</>
                    : <span className="text-amber-500">Sem PIN — contate o dono</span>
                  }
                </div>
              </div>
            </button>
          ))}

          {(!barbers || barbers.length === 0) && (
            <p className="text-center text-sm text-ink-500 py-8">
              Nenhum barbeiro cadastrado ainda.
            </p>
          )}
        </div>

        <div className="border-t border-ink-800 pt-4">
          <button
            onClick={() => setActiveBarber({ id: 'owner', nome: 'Dono' })}
            className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors py-2"
          >
            Entrar como dono (acesso completo)
          </button>
        </div>
      </div>
    </div>
  );
}
