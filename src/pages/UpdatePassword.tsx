import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({ password });
    
    setLoading(false);
    if (error) return toast.error(error.message);
    
    toast.success('Senha atualizada com sucesso!');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-950">
      <div className="w-full max-w-md card p-8 space-y-6">
        <PageHeader title="Nova senha" subtitle="Digite sua nova senha abaixo" />
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nova senha</label>
            <input 
              className="input" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              minLength={6}
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
