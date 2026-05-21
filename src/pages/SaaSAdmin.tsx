import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { formatBRL } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Store, Users, TrendingUp, ShieldAlert,
  CheckCircle2, Clock, Search, X, ChevronRight,
  Activity, LayoutDashboard, LogOut, FlaskConical, ExternalLink,
  RotateCcw, Trash2, Monitor,
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'overview' | 'shops' | 'activity' | 'test';

const PLAN_PRICE: Record<string, number> = { silver: 79, gold: 129, platinum: 199 };
const PLAN_LABEL: Record<string, string> = { trial: 'Trial', silver: 'Prata', gold: 'Ouro', platinum: 'Platina' };
const STATUS_LABEL: Record<string, string> = {
  trialing: 'Trial', active: 'Ativa', past_due: 'Inadimplente',
  canceled: 'Cancelada', incomplete: 'Incompleta',
};

export default function SaaSAdmin() {
  const { isAdmin, signOut, barbershops } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const demoShop = (barbershops as any[]).find(s => s.is_demo);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [selectedShop, setSelectedShop] = useState<any>(null);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['admin-shops'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from('barbershops')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: shopMembers = [] } = useQuery({
    queryKey: ['admin-shop-members', selectedShop?.id],
    enabled: !!selectedShop,
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('barbershop_id', selectedShop.id);
      return data || [];
    },
  });

  if (!isAdmin) return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center">
      <div className="text-center space-y-2">
        <ShieldAlert size={40} className="text-red-400 mx-auto" />
        <p className="text-ink-300">Acesso negado.</p>
      </div>
    </div>
  );

  // --- Metrics (exclude demo/test shops) ---
  const realShops = shops.filter((s: any) => !s.is_demo);
  const total = realShops.length;
  const active = realShops.filter((s: any) => s.subscription_status === 'active');
  const trialing = realShops.filter((s: any) => s.subscription_status === 'trialing');
  const overdue = realShops.filter((s: any) => ['past_due', 'canceled'].includes(s.subscription_status));
  const mrr = active.reduce((sum: number, s: any) => sum + (PLAN_PRICE[s.plan] || 0), 0);

  // --- Filtered list (exclude demo shops from main list) ---
  const filtered = realShops.filter((s: any) => {
    const matchSearch = !search ||
      s.nome?.toLowerCase().includes(search.toLowerCase()) ||
      s.slug?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || s.subscription_status === filterStatus;
    const matchPlan = !filterPlan || s.plan === filterPlan;
    return matchSearch && matchStatus && matchPlan;
  });

  const updateField = async (shopId: string, field: string, value: string) => {
    const { error } = await supabase.from('barbershops').update({ [field]: value }).eq('id', shopId);
    if (error) return toast.error(error.message);
    toast.success('Atualizado');
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    if (selectedShop?.id === shopId) setSelectedShop((p: any) => ({ ...p, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-ink-900 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="logo text-2xl text-ink-50">Navalha</span>
          <span className="text-xs text-ink-600 uppercase tracking-widest border border-ink-800 rounded px-2 py-0.5">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Simulador button */}
          <button
            onClick={() => navigate('/simulador')}
            title={demoShop ? `Simular app — ${demoShop.nome}` : 'Crie uma conta teste para usar o simulador'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              demoShop
                ? 'bg-violet-900/40 text-violet-300 hover:bg-violet-900/70 border border-violet-800/50'
                : 'text-ink-600 border border-ink-800 cursor-not-allowed opacity-50'
            }`}
            disabled={!demoShop}
          >
            <Monitor size={13} />
            Simulador
            {demoShop && <span className="text-violet-500 text-[10px]">Platina</span>}
          </button>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-200 transition-colors">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="border-b border-ink-900 px-6 flex gap-1">
        {([
          { id: 'overview', label: 'Visão Geral',  icon: LayoutDashboard },
          { id: 'shops',    label: 'Barbearias',   icon: Store },
          { id: 'activity', label: 'Atividade',    icon: Activity },
          { id: 'test',     label: 'Conta Teste',  icon: FlaskConical },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              tab === id
                ? 'border-ink-200 text-ink-100'
                : 'border-transparent text-ink-500 hover:text-ink-300'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">

        {/* ── VISÃO GERAL ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Total de barbearias" value={total} icon={<Store size={16} />} />
              <MetricCard label="Assinaturas ativas" value={active.length} icon={<CheckCircle2 size={16} />} color="text-emerald-400" />
              <MetricCard label="Em trial" value={trialing.length} icon={<Clock size={16} />} color="text-amber-400" />
              <MetricCard label="Inadimplentes" value={overdue.length} icon={<ShieldAlert size={16} />} color="text-red-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-5 space-y-1">
                <div className="text-xs text-ink-500 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp size={13} /> MRR Estimado
                </div>
                <div className="text-3xl font-semibold text-emerald-400">{formatBRL(mrr)}</div>
                <div className="text-xs text-ink-600">Apenas assinaturas ativas pagas</div>
              </div>

              <div className="card p-5 space-y-3">
                <div className="text-xs text-ink-500 uppercase tracking-wide">Distribuição por plano</div>
                {['trial', 'silver', 'gold', 'platinum'].map(plan => {
                  const count = realShops.filter((s: any) => s.plan === plan).length;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={plan} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-400">{PLAN_LABEL[plan]}</span>
                        <span className="text-ink-300">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-ink-900 rounded-full overflow-hidden">
                        <div className="h-full bg-ink-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inadimplentes em destaque */}
            {overdue.length > 0 && (
              <div className="card p-5 space-y-3 border border-red-900/40">
                <div className="text-xs text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldAlert size={13} /> Barbearias inadimplentes / canceladas
                </div>
                <div className="divide-y divide-ink-900">
                  {overdue.map((s: any) => (
                    <div key={s.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{s.nome}</div>
                        <div className="text-xs text-ink-500">/{s.slug} · {STATUS_LABEL[s.subscription_status]}</div>
                      </div>
                      <button onClick={() => { setSelectedShop(s); setTab('shops'); }} className="text-xs text-ink-400 hover:text-ink-200 flex items-center gap-1">
                        Ver <ChevronRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BARBEARIAS ── */}
        {tab === 'shops' && (
          <div className="flex gap-6 h-full">
            <div className={`flex-1 space-y-4 ${selectedShop ? 'hidden md:block' : ''}`}>
              {/* Filters */}
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    className="input pl-9 text-sm"
                    placeholder="Buscar barbearia…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select className="input text-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="trialing">Trial</option>
                  <option value="active">Ativa</option>
                  <option value="past_due">Inadimplente</option>
                  <option value="canceled">Cancelada</option>
                </select>
                <select className="input text-sm w-auto" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
                  <option value="">Todos os planos</option>
                  <option value="trial">Trial</option>
                  <option value="silver">Prata</option>
                  <option value="gold">Ouro</option>
                  <option value="platinum">Platina</option>
                </select>
              </div>

              <div className="text-xs text-ink-600">{filtered.length} resultado(s)</div>

              <div className="card overflow-hidden">
                {isLoading && <div className="p-8 text-center text-ink-500 animate-pulse text-sm">Carregando…</div>}
                <div className="divide-y divide-ink-900">
                  {filtered.map((shop: any) => (
                    <button
                      key={shop.id}
                      onClick={() => setSelectedShop(selectedShop?.id === shop.id ? null : shop)}
                      className={`w-full px-5 py-4 text-left hover:bg-ink-900/50 transition-colors flex items-center justify-between gap-4 ${selectedShop?.id === shop.id ? 'bg-ink-900/70' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusDot status={shop.subscription_status} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{shop.nome}</div>
                          <div className="text-xs text-ink-500">/{shop.slug}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <PlanBadge plan={shop.plan} />
                        <span className="text-xs text-ink-500 hidden sm:block">
                          {shop.paid_until
                            ? format(new Date(shop.paid_until), 'dd/MM/yy')
                            : format(new Date(shop.trial_ends_at), 'dd/MM/yy')}
                        </span>
                        <ChevronRight size={14} className="text-ink-600" />
                      </div>
                    </button>
                  ))}
                  {!isLoading && filtered.length === 0 && (
                    <div className="p-8 text-center text-ink-500 text-sm">Nenhuma barbearia encontrada.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Detail panel */}
            {selectedShop && (
              <div className="w-full md:w-96 shrink-0 space-y-4">
                <div className="card p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{selectedShop.nome}</div>
                      <div className="text-xs text-ink-500">/{selectedShop.slug}</div>
                    </div>
                    <button onClick={() => setSelectedShop(null)} className="text-ink-500 hover:text-ink-200">
                      <X size={16} />
                    </button>
                  </div>

                  {selectedShop.telefone && <InfoRow label="Telefone" value={selectedShop.telefone} />}
                  {selectedShop.endereco && <InfoRow label="Endereço" value={selectedShop.endereco} />}
                  <InfoRow label="Cadeiras" value={selectedShop.num_cadeiras} />
                  <InfoRow
                    label="Criada em"
                    value={format(new Date(selectedShop.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  />

                  <div className="pt-2 space-y-3 border-t border-ink-900">
                    <div className="space-y-1">
                      <label className="text-xs text-ink-500 uppercase tracking-wide">Plano</label>
                      <select
                        value={selectedShop.plan}
                        onChange={e => updateField(selectedShop.id, 'plan', e.target.value)}
                        className="input text-sm"
                      >
                        <option value="trial">Trial</option>
                        <option value="silver">Prata — R$79/mês</option>
                        <option value="gold">Ouro — R$129/mês</option>
                        <option value="platinum">Platina — R$199/mês</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-ink-500 uppercase tracking-wide">Status da assinatura</label>
                      <select
                        value={selectedShop.subscription_status}
                        onChange={e => updateField(selectedShop.id, 'subscription_status', e.target.value)}
                        className="input text-sm"
                      >
                        <option value="trialing">Trial</option>
                        <option value="active">Ativa</option>
                        <option value="past_due">Inadimplente</option>
                        <option value="canceled">Cancelada</option>
                        <option value="incomplete">Incompleta</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Members */}
                <div className="card p-5 space-y-3">
                  <div className="text-xs text-ink-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Users size={13} /> Membros ({shopMembers.length})
                  </div>
                  {shopMembers.length === 0 && (
                    <div className="text-xs text-ink-600">Nenhum membro encontrado.</div>
                  )}
                  <div className="divide-y divide-ink-900">
                    {shopMembers.map((m: any) => (
                      <div key={m.id} className="py-2 flex items-center justify-between text-xs">
                        <span className="text-ink-400 capitalize">{m.role}</span>
                        <span className={m.ativo ? 'text-emerald-400' : 'text-ink-600'}>
                          {m.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTA TESTE ── */}
        {tab === 'test' && <TestAccountTab shops={shops} qc={qc} onOpenSimulator={() => navigate('/simulador')} />}

        {/* ── ATIVIDADE ── */}
        {tab === 'activity' && (
          <div className="space-y-4 max-w-2xl">
            <div className="text-xs text-ink-500">Últimos cadastros e eventos recentes</div>
            <div className="card divide-y divide-ink-900">
              {realShops.slice(0, 30).map((shop: any) => (
                <div key={shop.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-medium text-ink-300 shrink-0">
                      {shop.nome?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{shop.nome}</div>
                      <div className="text-xs text-ink-500">
                        Cadastrou{' '}
                        <span className="text-ink-400">
                          {formatDistanceToNow(new Date(shop.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PlanBadge plan={shop.plan} />
                    <StatusDot status={shop.subscription_status} />
                  </div>
                </div>
              ))}
              {shops.length === 0 && !isLoading && (
                <div className="p-8 text-center text-ink-500 text-sm">Nenhuma atividade registrada.</div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function MetricCard({ label, value, icon, color = 'text-ink-100' }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="card p-5 space-y-1">
      <div className="text-xs text-ink-500 uppercase tracking-wide flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className={`text-3xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-300 text-right max-w-48 truncate">{value}</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color: Record<string, string> = {
    active: 'bg-emerald-400',
    trialing: 'bg-amber-400',
    past_due: 'bg-red-400',
    canceled: 'bg-ink-600',
    incomplete: 'bg-ink-600',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color[status] ?? 'bg-ink-600'}`} title={STATUS_LABEL[status]} />;
}

function TestAccountTab({ shops, qc, onOpenSimulator }: { shops: any[]; qc: any; onOpenSimulator: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const demoShop = shops.find((s: any) => s.is_demo);

  const enter = async () => {
    setBusy('enter');
    const { data, error } = await supabase.rpc('enter_test_mode');
    setBusy(null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    toast.success('Conta teste pronta!');
    window.open('https://narvalha.com.br', '_blank');
  };

  const reset = async () => {
    if (!demoShop) return;
    if (!confirm('Apagar todos os clientes, agendamentos, vendas e movimentos de caixa da conta teste? Os serviços/produtos/barbeiros são mantidos.')) return;
    setBusy('reset');
    const { error } = await supabase.rpc('reset_test_mode', { p_shop_id: demoShop.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Dados resetados.');
  };

  const wipe = async () => {
    if (!demoShop) return;
    if (!confirm('Apagar COMPLETAMENTE a conta teste (incluindo serviços, produtos e barbeiros)? Você poderá criar uma nova depois.')) return;
    setBusy('wipe');
    const { error } = await supabase.rpc('wipe_test_mode', { p_shop_id: demoShop.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    toast.success('Conta teste removida.');
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5 border border-amber-900/40 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
          <FlaskConical size={16} /> Sobre a conta teste
        </div>
        <p className="text-sm text-ink-400 leading-relaxed">
          Uma barbearia isolada vinculada ao seu email de admin, marcada como teste e <strong className="text-ink-200">excluída de todas as métricas</strong> (MRR, total de lojas, etc.).
          Já vem como <strong className="text-ink-200">Platina ativa</strong> — pode testar multi-loja, PDV, agenda, e qualquer feature sem afetar dados reais.
        </p>
        <p className="text-xs text-ink-500">
          Você acessa pelo seletor de lojas em <code className="text-ink-300">narvalha.com.br</code>.
          Use o mesmo email/senha do admin para entrar.
        </p>
      </div>

      {!demoShop && (
        <button
          onClick={enter}
          disabled={busy === 'enter'}
          className="w-full card p-5 hover:bg-ink-900/50 transition-colors flex items-center justify-between group"
        >
          <div className="text-left">
            <div className="text-sm font-medium text-ink-100 flex items-center gap-2">
              <FlaskConical size={15} className="text-amber-400" />
              Criar conta teste
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              Cria uma barbearia teste vinculada ao seu admin
            </div>
          </div>
          <ChevronRight size={16} className="text-ink-600 group-hover:text-ink-300 transition-colors" />
        </button>
      )}

      {demoShop && (
        <>
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-ink-500 uppercase tracking-wide">Conta teste ativa</div>
                <div className="text-base font-semibold mt-1">{demoShop.nome}</div>
                <div className="text-xs text-ink-500">/{demoShop.slug}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={onOpenSimulator}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-violet-900/40 text-violet-300 hover:bg-violet-900/70 border border-violet-800/50 transition-colors"
                >
                  <Monitor size={12} /> Abrir simulador
                </button>
                <a
                  href="https://narvalha.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  narvalha.com.br <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={reset}
              disabled={busy === 'reset'}
              className="card p-4 hover:bg-ink-900/50 transition-colors text-left space-y-1 disabled:opacity-50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink-100">
                <RotateCcw size={14} className="text-amber-400" />
                {busy === 'reset' ? 'Resetando…' : 'Resetar dados'}
              </div>
              <div className="text-xs text-ink-500">
                Apaga clientes, vendas, agenda e caixa. Mantém serviços e produtos.
              </div>
            </button>

            <button
              onClick={wipe}
              disabled={busy === 'wipe'}
              className="card p-4 hover:bg-red-900/10 hover:border-red-900/40 transition-colors text-left space-y-1 disabled:opacity-50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink-100">
                <Trash2 size={14} className="text-red-400" />
                {busy === 'wipe' ? 'Removendo…' : 'Remover conta teste'}
              </div>
              <div className="text-xs text-ink-500">
                Apaga tudo. Você pode criar uma nova depois.
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const color: Record<string, string> = {
    trial: 'text-ink-500 bg-ink-900',
    silver: 'text-ink-300 bg-ink-800',
    gold: 'text-amber-300 bg-amber-900/30',
    platinum: 'text-sky-300 bg-sky-900/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color[plan] ?? 'text-ink-500 bg-ink-900'}`}>
      {PLAN_LABEL[plan] ?? plan}
    </span>
  );
}
