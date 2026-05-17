import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);
    if (error) return toast.error(error.message);
    
    setSent(true);
    toast.success('E-mail de recuperação enviado!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-950">
      <div className="w-full max-w-md card p-8 space-y-6">
        <PageHeader title="Recuperar senha" subtitle="Insira seu e-mail para receber as instruções" />
        
        {sent ? (
          <div className="text-center p-4 bg-emerald-500/10 text-emerald-500 rounded-lg text-sm">
            Verifique sua caixa de entrada. Enviamos um link para redefinir sua senha.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
            <Link to="/login" className="block text-center text-xs text-ink-500 hover:text-ink-300">Voltar para o login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
