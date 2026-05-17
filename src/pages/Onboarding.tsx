import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { slugify, maskPhone, isValidPhone } from '../lib/utils';
import { toast } from 'sonner';
import { CheckCircle2, Sparkles, CreditCard } from 'lucide-react';

const PLANS = [
  { 
    id: 'silver',   
    name: 'Prata',   
    price: 'R$ 29,90', 
    features: ['Até 2 barbeiros', '10 serviços e 10 itens', 'Contas Pagar/Receber'],
  },
  { 
    id: 'gold',     
    name: 'Ouro',    
    price: 'R$ 49,90', 
    popular: true,
    features: ['Até 5 barbeiros', '20 serviços e produtos', 'Financeiro Completo'],
  },
  { 
    id: 'platinum', 
    name: 'Platina', 
    price: 'R$ 59,90', 
    features: ['Barbeiros ILIMITADOS', 'Serviços/Produtos ILIMITADOS', 'Promoções Completas'],
  },
];

export default function Onboarding() {
  const nav = useNavigate();
  const { refresh, session } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [telefone, setTelefone] = useState('');
  const [bshopId, setBshopId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('silver');
  const [barberName, setBarberName] = useState('');
  const [services, setServices] = useState([
    { nome: 'Corte', duracao_min: 30, valor: 50 },
    { nome: 'Barba', duracao_min: 20, valor: 35 },
    { nome: 'Corte + Barba', duracao_min: 50, valor: 75 },
  ]);

  if (!session) { nav('/login'); return null; }

  const createShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(telefone)) {
      return toast.error('O telefone deve ter exatamente 11 dígitos: (DD) 9 XXXX-XXXX');
    }
    setLoading(true);
    const finalSlug = slug || slugify(nome);
    const { data, error } = await supabase.rpc('create_barbershop', {
      p_nome: nome, p_slug: finalSlug, p_telefone: telefone.replace(/\D/g, ''),
    });
    
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    // Update plan selection (defaults to trial 14 days in DB, but we set the UI choice here)
    await supabase.from('barbershops').update({ plan: selectedPlan }).eq('id', data);

    setBshopId(data as string);
    setLoading(false);
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
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="logo text-4xl text-ink-50">Navalha</div>
          <p className="text-sm text-ink-500 mt-2">Passo {step} de 3</p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <form onSubmit={createShop} className="lg:col-span-2 card p-6 space-y-4">
              <h2 className="text-lg text-ink-50">Sua barbearia</h2>
              <div><label className="label">Nome</label>
                <input className="input" value={nome} onChange={(e) => { setNome(e.target.value); setSlug(slugify(e.target.value)); }} required autoFocus /></div>
              <div><label className="label">Identificador (URL)</label>
                <input className="input" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
                <p className="text-xs text-ink-500 mt-1">navalha.app/{slug || 'sua-barbearia'}</p></div>
              <div><label className="label">Telefone</label>
                <input 
                  className="input" 
                  value={telefone} 
                  onChange={(e) => setTelefone(maskPhone(e.target.value))} 
                  placeholder="(85) 98888-8888" 
                /></div>
              
              <div className="pt-4 border-t border-ink-800">
                <div className="flex items-center gap-2 text-emerald-400 mb-3">
                  <Sparkles size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Oferta de Lançamento</span>
                </div>
                <p className="text-xs text-ink-300 leading-relaxed">
                  Escolha seu plano ao lado. Você terá <strong className="text-emerald-400">14 dias de ACESSO TOTAL GRATUITO</strong> para configurar e usar. Não pedimos cartão agora!
                </p>
              </div>

              <button className="btn-primary w-full" disabled={loading}>Começar meu Teste Grátis</button>
            </form>

            <div className="lg:col-span-3 space-y-4">
              <h3 className="text-sm font-bold text-ink-500 uppercase tracking-widest ml-1">Escolha um Plano para Iniciar</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p.id)}
                    className={`card p-4 text-left border-2 transition-all relative ${selectedPlan === p.id ? 'border-ink-50 bg-ink-900' : 'border-ink-800 hover:border-ink-700'}`}
                  >
                    {p.popular && <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Melhor Escolha</span>}
                    <div className="text-xs font-bold text-ink-400 uppercase mb-1">{p.name}</div>
                    <div className="text-lg font-bold text-ink-50 mb-3">{p.price}</div>
                    <ul className="space-y-1.5 mb-4">
                      {p.features.map(f => (
                        <li key={f} className="text-[10px] text-ink-400 flex items-start gap-1.5">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" /> {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto text-[9px] text-center font-medium text-emerald-500 bg-emerald-500/10 py-1 rounded">
                      14 DIAS GRÁTIS
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={createBarber} className="card p-6 space-y-4 max-w-lg mx-auto">
            <h2 className="text-lg text-ink-50">Primeiro barbeiro</h2>
            <p className="text-xs text-ink-500">Cadastre-se ou seu primeiro colaborador para começar a agenda.</p>
            <div><label className="label">Nome de exibição</label>
              <input className="input" value={barberName} onChange={(e) => setBarberName(e.target.value)} required autoFocus /></div>
            <button className="btn-primary w-full" disabled={loading}>Continuar</button>
          </form>
        )}

        {step === 3 && (
          <div className="card p-6 space-y-4 max-w-lg mx-auto">
            <h2 className="text-lg text-ink-50 font-bold">Seus serviços</h2>
            <p className="text-xs text-ink-500">Adicione os serviços que você oferece. Você poderá mudar depois.</p>
            
            <div className="grid grid-cols-12 gap-2 px-1">
              <span className="text-[10px] uppercase font-bold text-ink-500 col-span-6">Serviço</span>
              <span className="text-[10px] uppercase font-bold text-ink-500 col-span-2 text-center">Tempo</span>
              <span className="text-[10px] uppercase font-bold text-ink-500 col-span-3 text-center">Preço</span>
              <span className="col-span-1"></span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {services.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-6" value={s.nome} placeholder="Ex: Corte" onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <input className="input col-span-2 text-center" type="number" value={s.duracao_min} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, duracao_min: +e.target.value } : x))} />
                  <input className="input col-span-3 text-center" type="number" step="0.01" value={s.valor} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, valor: +e.target.value } : x))} />
                  <button 
                    onClick={() => setServices(services.filter((_, j) => j !== i))}
                    className="col-span-1 flex items-center justify-center text-red-500 hover:text-red-400"
                    disabled={services.length <= 1}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              type="button"
              onClick={() => setServices([...services, { nome: '', duracao_min: 30, valor: 50 }])}
              className="flex items-center justify-center gap-2 text-xs font-bold text-ink-300 hover:text-ink-50 transition-colors w-full py-2 border border-dashed border-ink-800 rounded-md"
            >
              <Plus size={14} /> Adicionar mais um serviço
            </button>

            <button onClick={createServices} className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading ? <div className="w-5 h-5 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Concluir Onboarding'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
