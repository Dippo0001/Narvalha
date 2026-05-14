import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { slugify } from '../lib/utils';
import { toast } from 'sonner';

export default function Onboarding() {
  const nav = useNavigate();
  const { refresh, session } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [telefone, setTelefone] = useState('');
  const [bshopId, setBshopId] = useState<string | null>(null);
  const [barberName, setBarberName] = useState('');
  const [services, setServices] = useState([
    { nome: 'Corte', duracao_min: 30, valor: 50 },
    { nome: 'Barba', duracao_min: 20, valor: 35 },
    { nome: 'Corte + Barba', duracao_min: 50, valor: 75 },
  ]);

  if (!session) { nav('/login'); return null; }

  const createShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const finalSlug = slug || slugify(nome);
    const { data, error } = await supabase.rpc('create_barbershop', {
      p_nome: nome, p_slug: finalSlug, p_telefone: telefone,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setBshopId(data as string);
    setStep(2);
  };

  const createBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bshopId) return;
    setLoading(true);
    const { error } = await supabase.from('barbers').insert({
      barbershop_id: bshopId, nome_exibicao: barberName, comissao_padrao: 50,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setStep(3);
  };

  const createServices = async () => {
    if (!bshopId) return;
    setLoading(true);
    const rows = services.filter(s => s.nome).map((s, i) => ({ ...s, barbershop_id: bshopId, ordem: i }));
    const { error } = await supabase.from('services').insert(rows);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Tudo pronto!');
    await refresh();
    nav('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="logo text-4xl text-ink-50">Navalha</div>
          <p className="text-sm text-ink-500 mt-2">Passo {step} de 3</p>
        </div>
        {step === 1 && (
          <form onSubmit={createShop} className="card p-6 space-y-4">
            <h2 className="text-lg text-ink-50">Sua barbearia</h2>
            <div><label className="label">Nome</label>
              <input className="input" value={nome} onChange={(e) => { setNome(e.target.value); setSlug(slugify(e.target.value)); }} required autoFocus /></div>
            <div><label className="label">Slug (link público)</label>
              <input className="input" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
              <p className="text-xs text-ink-500 mt-1">navalha.app/b/{slug || 'sua-barbearia'}</p></div>
            <div><label className="label">Telefone</label>
              <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="85999999999" /></div>
            <button className="btn-primary w-full" disabled={loading}>Continuar</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={createBarber} className="card p-6 space-y-4">
            <h2 className="text-lg text-ink-50">Primeiro barbeiro</h2>
            <div><label className="label">Nome de exibição</label>
              <input className="input" value={barberName} onChange={(e) => setBarberName(e.target.value)} required autoFocus /></div>
            <button className="btn-primary w-full" disabled={loading}>Continuar</button>
          </form>
        )}
        {step === 3 && (
          <div className="card p-6 space-y-4">
            <h2 className="text-lg text-ink-50">Seus serviços</h2>
            
            <div className="grid grid-cols-6 gap-2 px-1">
              <span className="text-[10px] uppercase font-bold text-ink-500 col-span-3">Serviço</span>
              <span className="text-[10px] uppercase font-bold text-ink-500 col-span-1 text-center">Tempo</span>
              <span className="text-[10px] uppercase font-bold text-ink-500 col-span-2 text-center">Preço</span>
            </div>

            {services.map((s, i) => (
              <div key={i} className="grid grid-cols-6 gap-2">
                <input className="input col-span-3" value={s.nome} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                <input className="input col-span-1 text-center" type="number" value={s.duracao_min} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, duracao_min: +e.target.value } : x))} />
                <input className="input col-span-2 text-center" type="number" step="0.01" value={s.valor} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, valor: +e.target.value } : x))} />
              </div>
            ))}
            <button onClick={createServices} className="btn-primary w-full" disabled={loading}>Concluir</button>
          </div>
        )}
      </div>
    </div>
  );
}
