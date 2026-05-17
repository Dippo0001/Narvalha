import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export default function Signup() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Anti-bot: record when the form was rendered
  const loadedAt = useRef(Date.now());
  // Anti-bot: honeypot — bots fill hidden fields, humans don't
  const [honeypot, setHoneypot] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check — if filled, silently block (don't alert the bot)
    if (honeypot) return;

    // Timing check — real users take at least 4s to fill a form
    if (Date.now() - loadedAt.current < 4000) {
      toast.error('Por favor, aguarde um momento antes de continuar.');
      return;
    }

    if (!acceptedTerms) {
      return toast.error('Você precisa aceitar os termos e a política de privacidade.');
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          accepted_terms: true,
          consent_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    if (data.session) {
      toast.success('Conta criada com sucesso!');
      setLoading(false);
      nav('/onboarding');
    } else {
      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.', { duration: 8000 });
      setLoading(false);
      setTimeout(() => nav('/login'), 3000);
    }
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
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {/* Honeypot — visually hidden, bots fill this */}
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={e => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />
            <span className="text-xs text-ink-500 leading-relaxed group-hover:text-ink-300 transition-colors">
              Li e aceito os{' '}
              <Link to="/termos" className="text-ink-100 hover:underline">Termos de Uso</Link>{' '}
              e a{' '}
              <Link to="/privacidade" className="text-ink-100 hover:underline">Política de Privacidade</Link>{' '}
              (LGPD).
            </span>
          </label>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Criando…' : 'Criar conta'}
          </button>
          <p className="text-xs text-center text-ink-500">
            Já tem conta? <Link to="/login" className="text-ink-100 hover:underline">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
