import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useBarberSession } from '../lib/barber-session-context';
import { toast } from 'sonner';
import { Scissors, Lock, ShieldAlert } from 'lucide-react';

export default function BarberLock() {
  const { barbershop, session } = useAuth();
  const { setActiveBarber } = useBarberSession();
  const [selected, setSelected] = useState<{ id: string; nome: string; pin: string | null } | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Owner password gate
  const [ownerGate, setOwnerGate] = useState(false);
  const [ownerPass, setOwnerPass] = useState('');
  const [ownerLoading, setOwnerLoading] = useState(false);

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

  const handleOwnerEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;
    setOwnerLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: ownerPass,
    });
    setOwnerLoading(false);
    if (error) {
      toast.error('Senha incorreta');
      setOwnerPass('');
      return;
    }
    setActiveBarber({ id: 'owner', nome: 'Dono' });
  };

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

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
              onClick={() => {
                if (!b.barber_pin) {
                  toast.error(`${b.nome_exibicao} não tem PIN. Configure em Configurações → Equipe.`);
                  return;
                }
                setSelected({ id: b.id, nome: b.nome_exibicao, pin: b.barber_pin });
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${b.barber_pin ? 'border-ink-800 hover:bg-ink-800/50' : 'border-ink-800/40 opacity-50 cursor-not-allowed'}`}
            >
              <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center text-lg font-bold shrink-0">
                {b.nome_exibicao.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-ink-50">{b.nome_exibicao}</div>
                <div className="text-xs flex items-center gap-1 mt-0.5">
                  {b.barber_pin
                    ? <span className="text-ink-500"><Lock size={10} className="inline mr-0.5" />PIN configurado</span>
                    : <span className="text-amber-500">Sem PIN — configure em Configurações</span>
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
          {!ownerGate ? (
            <button
              onClick={() => setOwnerGate(true)}
              className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors py-2"
            >
              Entrar como dono (acesso completo)
            </button>
          ) : (
            <form onSubmit={handleOwnerEnter} className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <ShieldAlert size={13} />
                <span>Confirme sua senha de acesso</span>
              </div>
              <input
                className="input text-center text-sm tracking-widest"
                type="password"
                placeholder="Senha do dono"
                value={ownerPass}
                onChange={e => setOwnerPass(e.target.value)}
                autoFocus
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost flex-1 text-xs text-ink-500"
                  onClick={() => { setOwnerGate(false); setOwnerPass(''); }}
                >
                  Cancelar
                </button>
                <button className="btn-primary flex-1 text-sm" disabled={ownerLoading}>
                  {ownerLoading ? 'Verificando…' : 'Confirmar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
