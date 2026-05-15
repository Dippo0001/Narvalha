import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Barber } from '../types/db';

export default function Settings() {
  const { barbershop, refresh } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'geral' | 'equipe' | 'plano'>('geral');
  const [nome, setNome] = useState(barbershop?.nome ?? '');
  const [telefone, setTelefone] = useState(barbershop?.telefone ?? '');
  const [endereco, setEndereco] = useState(barbershop?.endereco ?? '');
  const [slug, setSlug] = useState(barbershop?.slug ?? '');
  const [cancel, setCancel] = useState(barbershop?.cancel_min_hours ?? 2);
  const [numCadeiras, setNumCadeiras] = useState(barbershop?.num_cadeiras ?? 1);

  const saveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershop) return;
    const { error } = await supabase.from('barbershops').update({ 
      nome, telefone, endereco, slug, 
      cancel_min_hours: cancel,
      num_cadeiras: numCadeiras
    }).eq('id', barbershop.id);
    if (error) return toast.error(error.message);
    toast.success('Salvo');
    refresh();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader title="Configurações" />
      <div className="flex gap-1 border-b border-ink-800 mb-6 overflow-x-auto">
        <button onClick={() => setTab('geral')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === 'geral' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Geral</button>
        <button onClick={() => setTab('equipe')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === 'equipe' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Equipe</button>
        <button onClick={() => setTab('plano')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === 'plano' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Assinatura</button>
      </div>
      {tab === 'geral' && (
        <form onSubmit={saveShop} className="card p-6 space-y-4 max-w-xl">
          <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><label className="label">Slug</label><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><label className="label">Telefone</label><input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div><label className="label">Endereço</label><input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
          <div>
            <label className="label">Número de Cadeiras (Capacidade simultânea)</label>
            <input className="input" type="number" min={1} value={numCadeiras} onChange={(e) => setNumCadeiras(+e.target.value)} />
            <p className="text-[10px] text-ink-500 mt-1">Define quantos atendimentos podem ocorrer ao mesmo tempo na barbearia.</p>
          </div>
          <div><label className="label">Antecedência mín. cancelamento (horas)</label><input className="input" type="number" value={cancel} onChange={(e) => setCancel(+e.target.value)} /></div>
          <button className="btn-primary">Salvar</button>
        </form>
      )}
      {tab === 'equipe' && <BarbersTab qc={qc} />}
      {tab === 'plano' && <SubscriptionTab />}
    </div>
  );
}

import { CheckCircle2, CreditCard, Sparkles } from 'lucide-react';

const PLANS = [
  { id: 'silver',   name: 'Prata',   price: 'R$ 49,90', features: ['Até 2 barbeiros', 'Gestão básica', 'Suporte e-mail'], color: 'text-slate-400' },
  { id: 'gold',     name: 'Ouro',    price: 'R$ 89,90', features: ['Até 5 barbeiros', 'Financeiro completo', 'Suporte WhatsApp'], color: 'text-amber-400', popular: true },
  { id: 'platinum', name: 'Platina', price: 'R$ 149,90', features: ['Barbeiros ilimitados', 'Dashboard Admin', 'Gerente de conta'], color: 'text-cyan-400' },
];

function SubscriptionTab() {
  const { barbershop } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId, barbershopId: barbershop?.id }
      });
      
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar pagamento');
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading('manage');
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { barbershopId: barbershop?.id }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao abrir portal');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="card p-6 bg-ink-900 border-ink-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-ink-50/10 p-2 rounded-full"><Sparkles className="text-ink-50" size={20} /></div>
            <div>
              <h3 className="font-bold text-lg">Seu Plano Atual: <span className="text-ink-50 uppercase">{barbershop?.plan}</span></h3>
              <p className="text-sm text-ink-500">Status: <span className="capitalize">{barbershop?.subscription_status === 'trialing' ? 'Período de Teste' : 'Assinatura Ativa'}</span></p>
            </div>
          </div>
          {barbershop?.stripe_customer_id && (
            <button 
              onClick={handleManage}
              disabled={loading === 'manage'}
              className="btn-ghost text-xs gap-2"
            >
              <CreditCard size={14} />
              {loading === 'manage' ? 'Carregando...' : 'Gerenciar Pagamento'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((p) => (
          <div key={p.id} className={`card p-6 flex flex-col relative ${p.id === barbershop?.plan ? 'border-2 border-ink-50' : 'border-ink-800'}`}>
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ink-50 text-ink-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                Mais Popular
              </span>
            )}
            <div className={`text-sm font-bold uppercase tracking-widest mb-1 ${p.color}`}>{p.name}</div>
            <div className="text-2xl font-bold mb-4">{p.price}<span className="text-xs text-ink-500 font-normal">/mês</span></div>
            
            <ul className="flex-1 space-y-2 mb-6">
              {p.features.map(f => (
                <li key={f} className="text-xs text-ink-300 flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-emerald-500" /> {f}
                </li>
              ))}
            </ul>

            <button 
              disabled={loading !== null || p.id === barbershop?.plan}
              onClick={() => handleSubscribe(p.id)}
              className={`w-full py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                p.id === barbershop?.plan 
                  ? 'bg-ink-800 text-ink-500 cursor-default' 
                  : 'bg-ink-50 text-ink-950 hover:bg-white active:scale-95'
              }`}
            >
              {loading === p.id ? (
                <div className="w-5 h-5 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" />
              ) : p.id === barbershop?.plan ? 'Plano Atual' : (
                <><CreditCard size={16} /> Assinar Agora</>
              )}
            </button>
          </div>
        ))}
      </div>
      
      <p className="text-center text-xs text-ink-500">
        Pagamentos processados com segurança via Stripe. Cancele a qualquer momento.
      </p>
    </div>
  );
}

function BarbersTab({ qc }: any) {
  const { barbershop } = useAuth();
  const [modal, setModal] = useState<Barber | 'new' | null>(null);
  const { data: barbers } = useQuery({
    queryKey: ['barbers-settings', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('*').eq('barbershop_id', barbershop!.id).order('nome_exibicao');
      return (data ?? []) as Barber[];
    },
  });
  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('barbers').insert(payload)
      : await supabase.from('barbers').update(payload).eq('id', (modal as Barber).id);
    if (error) return toast.error(error.message);
    toast.success('Salvo');
    qc.invalidateQueries({ queryKey: ['barbers-settings'] });
    setModal(null);
  };
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={16} /> Adicionar barbeiro</button>
      </div>
      <div className="card divide-y divide-ink-800">
        {(barbers ?? []).map((b) => (
          <button key={b.id} onClick={() => setModal(b)} className="w-full text-left p-4 hover:bg-ink-800/40 flex justify-between">
            <div>
              <div className="text-ink-50">{b.nome_exibicao}</div>
              <div className="text-xs text-ink-500">Comissão {b.comissao_padrao}% · {b.ativo ? 'ativo' : 'inativo'}</div>
            </div>
          </button>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo barbeiro' : 'Editar barbeiro'}>
        <BarberForm initial={modal === 'new' ? null : modal} onSave={save} />
      </Modal>
    </div>
  );
}

function BarberForm({ initial, onSave }: { initial: Barber | null; onSave: (v: any) => void }) {
  const [form, setForm] = useState({
    nome_exibicao: initial?.nome_exibicao ?? '',
    comissao_padrao: Number(initial?.comissao_padrao ?? 50),
    ativo: initial?.ativo ?? true,
    cor_agenda: initial?.cor_agenda ?? '#6b7280',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={form.nome_exibicao} onChange={(e) => setForm({ ...form, nome_exibicao: e.target.value })} required autoFocus /></div>
      <div><label className="label">Comissão padrão (%)</label><input className="input" type="number" step="0.01" value={form.comissao_padrao} onChange={(e) => setForm({ ...form, comissao_padrao: +e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm text-ink-300"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
      <button className="btn-primary w-full">Salvar</button>
    </form>
  );
}
