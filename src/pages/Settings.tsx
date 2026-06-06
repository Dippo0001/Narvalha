import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Plus, CheckCircle2, CreditCard, Sparkles, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { maskPhone, isValidPhone } from '../lib/utils';
import type { Barber } from '../types/db';

export default function Settings() {
  const { barbershop, refresh } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'geral' | 'equipe' | 'regras' | 'fiscal' | 'plano'>('geral');
  const [nome, setNome] = useState(barbershop?.nome ?? '');
  const [telefone, setTelefone] = useState(maskPhone(barbershop?.telefone ?? ''));
  const [endereco, setEndereco] = useState(barbershop?.endereco ?? '');
  const [slug, setSlug] = useState(barbershop?.slug ?? '');
  const [cancel, setCancel] = useState(barbershop?.cancel_min_hours ?? 2);
  const [numCadeiras, setNumCadeiras] = useState(barbershop?.num_cadeiras ?? 1);
  const [numCadeirasInfantil, setNumCadeirasInfantil] = useState(barbershop?.num_cadeiras_infantil ?? 0);
  const [caixaAsCegas, setCaixaAsCegas] = useState(barbershop?.caixa_as_cegas ?? false);
  const [frequencia, setFrequencia] = useState(barbershop?.comissao_frequencia ?? 'semanal');
  const [diaPagamento, setDiaPagamento] = useState(barbershop?.comissao_dia_pagamento ?? '6');

  // Fiscal states
  const [fiscalEnabled, setFiscalEnabled] = useState(barbershop?.fiscal_enabled ?? false);
  const [cnpj, setCnpj] = useState(barbershop?.cnpj ?? '');
  const [ie, setIe] = useState(barbershop?.inscricao_estadual ?? '');
  const [im, setIm] = useState(barbershop?.inscricao_municipal ?? '');
  const [cnae, setCnae] = useState(barbershop?.cnae ?? '');
  const [crt, setCrt] = useState(barbershop?.crt ?? 1);
  const [ibge, setIbge] = useState(barbershop?.ibge_code ?? '');

  const saveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershop) return;
    
    if (!isValidPhone(telefone)) {
      return toast.error('O telefone deve ter exatamente 11 dígitos: (DD) 9 XXXX-XXXX');
    }

    const { error } = await supabase.from('barbershops').update({ 
      nome, telefone: telefone.replace(/\D/g, ''), endereco, slug, 
      cancel_min_hours: cancel,
      num_cadeiras: numCadeiras,
      num_cadeiras_infantil: numCadeirasInfantil,
      caixa_as_cegas: caixaAsCegas,
      comissao_frequencia: frequencia,
      comissao_dia_pagamento: diaPagamento,
      fiscal_enabled: fiscalEnabled,
      cnpj,
      inscricao_estadual: ie,
      inscricao_municipal: im,
      cnae,
      crt,
      ibge_code: ibge
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
        <button onClick={() => setTab('regras')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === 'regras' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Regras de Negócio</button>
        <button onClick={() => setTab('fiscal')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === 'fiscal' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Fiscal</button>
        <button onClick={() => setTab('plano')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === 'plano' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Assinatura</button>
      </div>
      {tab === 'geral' && (
        <div className="space-y-6 max-w-xl">
          <form onSubmit={saveShop} className="card p-6 space-y-4">
            <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><label className="label">Slug</label><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
            <div>
              <label className="label">Telefone (Celular)</label>
              <input
                className="input"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(85) 98888-8888"
              />
            </div>
            <div><label className="label">Endereço</label><input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cadeiras (adulto)</label>
                <input className="input" type="number" min={1} value={numCadeiras} onChange={(e) => setNumCadeiras(+e.target.value)} />
              </div>
              <div>
                <label className="label">Cadeiras infantis</label>
                <input className="input" type="number" min={0} value={numCadeirasInfantil} onChange={(e) => setNumCadeirasInfantil(+e.target.value)} />
              </div>
            </div>
            <p className="text-[10px] text-ink-500 -mt-2">Capacidade simultânea de atendimentos na barbearia.</p>
            <div><label className="label">Antecedência mín. cancelamento (horas)</label><input className="input" type="number" value={cancel} onChange={(e) => setCancel(+e.target.value)} /></div>
            <button className="btn-primary">Salvar</button>
          </form>

          <ChangePasswordSection />
          <OwnerPinSection />
        </div>
      )}
      {tab === 'fiscal' && (
        <div className="space-y-6 max-w-xl">
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink-50 uppercase tracking-wider">Modo de Operação</h3>
                <p className="text-[10px] text-ink-500">Defina como o sistema deve tratar as vendas.</p>
              </div>
              <div className="flex bg-ink-900 p-1 rounded-lg border border-ink-800">
                <button 
                  onClick={() => setFiscalEnabled(false)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${!fiscalEnabled ? 'bg-ink-800 text-ink-50 shadow-sm' : 'text-ink-500 hover:text-ink-300'}`}
                >
                  Gerencial
                </button>
                <button 
                  onClick={() => setFiscalEnabled(true)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${fiscalEnabled ? 'bg-emerald-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-300'}`}
                >
                  Fiscal
                </button>
              </div>
            </div>

            {fiscalEnabled ? (
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg flex gap-3">
                <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
                <p className="text-[10px] text-emerald-200/70 leading-relaxed">
                  <strong>MODO FISCAL ATIVO:</strong> As vendas finalizadas tentarão emitir nota fiscal eletrônica. 
                  Certifique-se de que todos os dados abaixo e os dados tributários de produtos/serviços estão corretos.
                </p>
              </div>
            ) : (
              <div className="bg-ink-800/30 border border-ink-800 p-3 rounded-lg flex gap-3">
                <ShieldCheck className="text-ink-500 shrink-0" size={18} />
                <p className="text-[10px] text-ink-500 leading-relaxed">
                  <strong>MODO GERENCIAL:</strong> O sistema funcionará apenas para controle interno, sem envio de dados para a SEFAZ ou prefeituras.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={saveShop} className={`card p-6 space-y-4 transition-opacity ${!fiscalEnabled ? 'opacity-50 grayscale-[0.5]' : ''}`}>
            <h3 className="text-sm font-bold text-ink-50 uppercase tracking-wider mb-2">Dados do Emitente</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CNPJ</label>
                <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value.replace(/\D/g, ''))} placeholder="00.000.000/0000-00" disabled={!fiscalEnabled} />
              </div>
              <div>
                <label className="label">Regime Tributário (CRT)</label>
                <select className="input" value={crt} onChange={(e) => setCrt(+e.target.value)} disabled={!fiscalEnabled}>
                  <option value={1}>Simples Nacional</option>
                  <option value={2}>Simples Nacional - Excesso</option>
                  <option value={3}>Regime Normal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Inscrição Estadual</label>
                <input className="input" value={ie} onChange={(e) => setIe(e.target.value)} disabled={!fiscalEnabled} />
              </div>
              <div>
                <label className="label">Inscrição Municipal</label>
                <input className="input" value={im} onChange={(e) => setIm(e.target.value)} disabled={!fiscalEnabled} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CNAE Principal</label>
                <input className="input" value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="9602-5/01" disabled={!fiscalEnabled} />
              </div>
              <div>
                <label className="label">Código IBGE Município</label>
                <input className="input" value={ibge} onChange={(e) => setIbge(e.target.value)} placeholder="2304400" disabled={!fiscalEnabled} />
              </div>
            </div>

            <p className="text-[10px] text-ink-500 mt-2">Esses dados são obrigatórios para a emissão de notas fiscais eletrônicas.</p>
            
            <button className="btn-primary" disabled={!fiscalEnabled && barbershop?.fiscal_enabled === fiscalEnabled}>
              Salvar Configurações
            </button>
          </form>

          {fiscalEnabled && (
            <div className="card p-6 space-y-4 border-dashed border-ink-800 bg-ink-900/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-ink-500" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-ink-50">Certificado Digital A1</h4>
                  <p className="text-[10px] text-ink-500">O upload do certificado será disponibilizado na Fase 2 do módulo fiscal.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {tab === 'regras' && (
        <form onSubmit={saveShop} className="card p-6 space-y-6 max-w-xl">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ink-50 uppercase tracking-wider">Fechamento de Caixa</h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative inline-flex items-center">
                <input type="checkbox" checked={caixaAsCegas} onChange={(e) => setCaixaAsCegas(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-ink-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ink-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:bg-ink-50 peer-checked:bg-emerald-600"></div>
              </div>
              <div>
                <span className="text-sm font-medium text-ink-50 group-hover:text-white transition-colors">Caixa às Cegas</span>
                <p className="text-[10px] text-ink-500">Esconde os valores esperados durante o fechamento para uma conferência neutra.</p>
              </div>
            </label>
          </div>

          <div className="space-y-4 pt-6 border-t border-ink-800">
            <h3 className="text-sm font-bold text-ink-50 uppercase tracking-wider">Pagamento de Comissões</h3>
            <div>
              <label className="label">Frequência de Pagamento</label>
              <select className="input" value={frequencia} onChange={(e) => setFrequencia(e.target.value)}>
                <option value="diario">Todo dia</option>
                <option value="semanal">Toda semana</option>
                <option value="quinzenal">A cada 15 dias</option>
                <option value="mensal">Todo mês</option>
              </select>
            </div>

            <div>
              <label className="label">Dia do Pagamento</label>
              <select className="input" value={diaPagamento} onChange={(e) => setDiaPagamento(e.target.value)}>
                {frequencia === 'semanal' && (
                  <>
                    <option value="1">Segunda-feira</option>
                    <option value="2">Terça-feira</option>
                    <option value="3">Quarta-feira</option>
                    <option value="4">Quinta-feira</option>
                    <option value="5">Sexta-feira</option>
                    <option value="6">Sábado</option>
                    <option value="0">Domingo</option>
                  </>
                )}
                {frequencia === 'mensal' && (
                  <>
                    <option value="1">Dia 1</option>
                    <option value="5">Dia 5</option>
                    <option value="10">Dia 10</option>
                    <option value="15">Dia 15</option>
                    <option value="20">Dia 20</option>
                    <option value="25">Dia 25</option>
                    <option value="30">Dia 30</option>
                  </>
                )}
                {(frequencia === 'diario' || frequencia === 'quinzenal') && (
                  <option value="auto">Automático pelo sistema</option>
                )}
              </select>
            </div>
          </div>

          <button className="btn-primary">Salvar Regras</button>
        </form>
      )}
      {tab === 'equipe' && <BarbersTab qc={qc} />}
      {tab === 'plano' && <SubscriptionTab />}
    </div>
  );
}

const PLANS = [
  { 
    id: 'silver',   
    name: 'Prata',   
    price: 'R$ 29,90', 
    color: 'text-slate-400',
    features: ['Até 2 barbeiros', '10 serviços e 10 itens', 'Gestão de Contas Pagar/Receber', 'Suporte 5x2'],
    rank: 1
  },
  { 
    id: 'gold',     
    name: 'Ouro',    
    price: 'R$ 49,90', 
    color: 'text-amber-400', 
    popular: true,
    features: ['Até 5 barbeiros', '20 serviços e 20 produtos', 'Módulo Financeiro Completo', 'Suporte 5x2'],
    rank: 2
  },
  { 
    id: 'platinum', 
    name: 'Platina', 
    price: 'R$ 59,90', 
    color: 'text-cyan-400',
    features: ['Barbeiros ILIMITADOS', 'Serviços/Produtos ILIMITADOS', 'Módulo Promoção Completo', 'Multi-loja (matriz + filiais)'],
    rank: 3
  },
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
    <div className="space-y-10">
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

      {/* Tabela Comparativa */}
      <div className="mt-12">
        <h3 className="text-lg font-bold text-center mb-8">Comparativo Detalhado</h3>
        <div className="card overflow-hidden border-ink-800">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-ink-900/50 text-ink-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-4 py-4 border-b border-ink-800">Funcionalidade</th>
                <th className="px-4 py-4 border-b border-ink-800 text-center">Prata</th>
                <th className="px-4 py-4 border-b border-ink-800 text-center">Ouro</th>
                <th className="px-4 py-4 border-b border-ink-800 text-center">Platina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              <tr>
                <td className="px-4 py-3 font-medium">Barbeiros</td>
                <td className="px-4 py-3 text-center text-ink-400">Até 2</td>
                <td className="px-4 py-3 text-center text-ink-400">Até 5</td>
                <td className="px-4 py-3 text-center text-emerald-400 font-bold uppercase">Ilimitado</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Serviços e Produtos</td>
                <td className="px-4 py-3 text-center text-ink-400">10 de cada</td>
                <td className="px-4 py-3 text-center text-ink-400">20 de cada</td>
                <td className="px-4 py-3 text-center text-emerald-400 font-bold uppercase">Ilimitado</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Módulo Financeiro</td>
                <td className="px-4 py-3 text-center text-ink-400 text-xs">Pagar/Receber</td>
                <td className="px-4 py-3 text-center text-ink-400">Completo</td>
                <td className="px-4 py-3 text-center text-ink-400">Completo</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Promoções</td>
                <td className="px-4 py-3 text-center text-ink-400 text-xs">Básico</td>
                <td className="px-4 py-3 text-center text-ink-400 text-xs">Intermediário</td>
                <td className="px-4 py-3 text-center text-emerald-400 font-bold uppercase">Completo</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Suporte</td>
                <td className="px-4 py-3 text-center text-ink-400 text-xs">Email 5x2</td>
                <td className="px-4 py-3 text-center text-ink-400 text-xs">WhatsApp 5x2</td>
                <td className="px-4 py-3 text-center text-emerald-400 font-bold uppercase">Prioritário</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Multi-loja</td>
                <td className="px-4 py-3 text-center text-red-500/50">—</td>
                <td className="px-4 py-3 text-center text-red-500/50">—</td>
                <td className="px-4 py-3 text-center text-emerald-400">Disponível</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-center text-xs text-ink-500">
        Pagamentos processados com segurança via Stripe. Cancele a qualquer momento.
      </p>
    </div>
  );
}

const BARBER_LIMITS: Record<string, number> = { silver: 2, gold: 5, platinum: 999, trial: 999 };

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

  const canAddBarber = (barbers?.length ?? 0) < BARBER_LIMITS[barbershop?.plan || 'silver'];

  const save = async (form: any) => {
    if (!barbershop) return;
    // Campos opcionais: salvar como NULL se vazio (não string vazia)
    const payload = {
      ...form,
      barbershop_id: barbershop.id,
      barber_login: form.barber_login?.trim() || null,
      barber_pin:   form.barber_pin?.trim()   || null,
    };
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
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs text-ink-500">
          Uso de equipe: <span className="font-bold text-ink-300">{barbers?.length ?? 0} de {BARBER_LIMITS[barbershop?.plan || 'silver']}</span>
        </div>
        <button 
          className="btn-primary" 
          disabled={!canAddBarber}
          onClick={() => {
            if (!canAddBarber) return toast.error('Limite de barbeiros atingido para o seu plano. Faça um upgrade!');
            setModal('new');
          }}
        >
          <Plus size={16} /> Adicionar barbeiro
        </button>
      </div>
      <div className="card divide-y divide-ink-800">
        {(barbers ?? []).map((b) => (
          <button key={b.id} onClick={() => setModal(b)} className="w-full text-left p-4 hover:bg-ink-800/40 flex justify-between items-center">
            <div>
              <div className="text-ink-50">{b.nome_exibicao}</div>
              <div className="text-xs text-ink-500">
                Comissão {b.comissao_padrao}% · {b.ativo ? 'ativo' : 'inativo'}
                {b.barber_login && ` · login: ${b.barber_login}`}
              </div>
            </div>
            {b.barber_pin
              ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">PIN OK</span>
              : <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Sem PIN</span>
            }
          </button>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo barbeiro' : 'Editar barbeiro'}>
        <BarberForm initial={modal === 'new' ? null : modal} onSave={save} />
      </Modal>
    </div>
  );
}

function ChangePasswordSection() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) return toast.error('As senhas não coincidem.');
    if (newPassword.length < 8) return toast.error('A senha deve ter pelo menos 8 caracteres.');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Senha alterada com sucesso!');
    setNewPassword('');
    setConfirm('');
    setOpen(false);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-ink-500" />
          <div>
            <span className="text-sm font-medium text-ink-100">Senha geral</span>
            <p className="text-[10px] text-ink-500 mt-0.5">Usada para fazer login com e-mail</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-xs text-ink-400 hover:text-ink-100 transition-colors"
        >
          {open ? 'Cancelar' : 'Alterar'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-ink-800">
          <div>
            <label className="label">Nova senha</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button className="btn-primary" disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar senha geral'}
          </button>
        </form>
      )}
    </div>
  );
}

function OwnerPinSection() {
  const { barbershop, refresh } = useAuth();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const hasPin = !!barbershop?.owner_pin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) return toast.error('As senhas não coincidem.');
    if (pin.length < 4) return toast.error('A senha do dono deve ter pelo menos 4 caracteres.');
    setLoading(true);
    const { error } = await supabase
      .from('barbershops')
      .update({ owner_pin: pin })
      .eq('id', barbershop!.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Senha do dono salva!');
    await refresh();
    setPin('');
    setConfirm('');
    setOpen(false);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-500" />
          <div>
            <span className="text-sm font-medium text-ink-100">Senha do dono</span>
            <p className="text-[10px] text-ink-500 mt-0.5">
              Usada para "Entrar como dono" na tela de seleção de barbeiros
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPin && (
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">
              Configurada
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="text-xs text-ink-400 hover:text-ink-100 transition-colors"
          >
            {open ? 'Cancelar' : hasPin ? 'Alterar' : 'Configurar'}
          </button>
        </div>
      </div>

      {!hasPin && !open && (
        <p className="text-xs text-amber-400/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
          Sem senha do dono configurada — o acesso de dono usa a senha geral de login como fallback.
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-ink-800">
          <div>
            <label className="label">Nova senha do dono</label>
            <input
              className="input"
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              minLength={4}
              placeholder="Mínimo 4 caracteres"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Confirmar senha do dono</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              minLength={4}
              required
            />
          </div>
          <button className="btn-primary" disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar senha do dono'}
          </button>
        </form>
      )}
    </div>
  );
}

function BarberForm({ initial, onSave }: { initial: Barber | null; onSave: (v: any) => void }) {
  const [form, setForm] = useState({
    nome_exibicao:    initial?.nome_exibicao ?? '',
    comissao_padrao:  Number(initial?.comissao_padrao ?? 50),
    ativo:            initial?.ativo ?? true,
    cor_agenda:       initial?.cor_agenda ?? '#6b7280',
    barber_login:     initial?.barber_login ?? '',
    barber_pin:       initial?.barber_pin ?? '',
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="label">Nome</label>
        <input className="input" value={form.nome_exibicao} onChange={(e) => setForm({ ...form, nome_exibicao: e.target.value })} required autoFocus />
      </div>
      <div>
        <label className="label">Comissão padrão (%)</label>
        <input className="input" type="number" step="0.01" value={form.comissao_padrao} onChange={(e) => setForm({ ...form, comissao_padrao: +e.target.value })} />
      </div>

      {/* Acesso ao sistema */}
      <div className="pt-3 border-t border-ink-800 space-y-3">
        <div className="text-xs font-bold text-ink-500 uppercase tracking-widest">Acesso ao Sistema (PDV)</div>
        <div>
          <label className="label">Login (nome de usuário)</label>
          <input
            className="input"
            value={form.barber_login}
            onChange={(e) => setForm({ ...form, barber_login: e.target.value.toLowerCase().replace(/\s/g, '') })}
            placeholder="Ex: joao"
          />
          <p className="text-[10px] text-ink-600 mt-1">Sem espaços, letras minúsculas.</p>
        </div>
        <div>
          <label className="label">PIN (4–6 dígitos)</label>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={form.barber_pin}
            onChange={(e) => setForm({ ...form, barber_pin: e.target.value.replace(/\D/g, '') })}
            placeholder="••••••"
          />
          <p className="text-[10px] text-ink-600 mt-1">O barbeiro usa esse PIN para entrar no modo PDV.</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
      </label>
      <button className="btn-primary w-full">Salvar</button>
    </form>
  );
}
