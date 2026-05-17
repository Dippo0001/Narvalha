import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { toast } from 'sonner';
import { GitBranch, Lock } from 'lucide-react';

export default function NovaFilial() {
  const { barbershop, refresh } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);

  const isMatrix = barbershop?.parent_barbershop_id === null;
  const isPlatinum = barbershop?.plan === 'platinum';
  const canCreate = isMatrix && isPlatinum;

  if (!canCreate) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-ink-800 flex items-center justify-center mx-auto">
            <Lock size={24} className="text-ink-500" />
          </div>
          <h2 className="text-lg font-semibold text-ink-50">Recurso Platina</h2>
          <p className="text-sm text-ink-500">
            Para adicionar filiais, sua loja matriz precisa estar no plano <strong className="text-ink-200">Platina</strong>.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(-1)} className="btn-secondary">
              Voltar
            </button>
            <button onClick={() => navigate('/configuracoes')} className="btn-primary">
              Ver planos
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slug.length < 3) return toast.error('Slug precisa ter pelo menos 3 caracteres.');

    setLoading(true);
    const { error } = await supabase.rpc('create_barbershop', {
      p_nome: nome,
      p_slug: slug,
      p_telefone: '',
    });
    setLoading(false);

    if (error) return toast.error(error.message);

    toast.success('Filial criada com sucesso!');
    await refresh();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-2">
          <div className="w-14 h-14 rounded-full bg-ink-800 flex items-center justify-center mx-auto">
            <GitBranch size={24} className="text-ink-300" />
          </div>
          <h1 className="text-xl font-semibold text-ink-50">Nova filial</h1>
          <p className="text-sm text-ink-500">Vinculada a <strong className="text-ink-300">{barbershop?.nome}</strong></p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Nome da filial</label>
            <input
              className="input"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              autoFocus
              placeholder="Ex: Navalha Centro"
            />
          </div>
          <div>
            <label className="label">Slug (identificador único)</label>
            <input
              className="input"
              type="text"
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              required
              placeholder="ex: navalha-centro"
            />
            <p className="text-xs text-ink-600 mt-1">Apenas letras minúsculas, números e hifens.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Criando…' : 'Criar filial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
