import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function Signup() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setLoading(false); return toast.error(error.message); }
    // Attempt immediate sign-in (email confirm is disabled)
    await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    nav('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="logo text-5xl text-ink-50">Navalha</div>
          <p className="text-sm text-ink-500 mt-2">Comece grátis em menos de 1 minuto</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Criando…' : 'Criar conta'}</button>
          <p className="text-xs text-center text-ink-500">
            Já tem conta? <Link to="/login" className="text-ink-100 hover:underline">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
