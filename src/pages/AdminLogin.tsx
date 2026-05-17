import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck size={22} className="text-ink-500" />
            <div className="logo text-4xl text-ink-50">Navalha</div>
          </div>
          <p className="text-xs text-ink-600 uppercase tracking-widest">Painel Administrativo</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Autenticando…' : 'Acessar painel'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-700 mt-6">
          Acesso restrito a administradores autorizados.
        </p>
      </div>
    </div>
  );
}
