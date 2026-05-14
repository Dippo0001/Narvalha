import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import { formatBRL } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Store, Users, CreditCard, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function SaaSAdmin() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('barbershops').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  if (!isAdmin) return <div className="p-8 text-center">Acesso negado</div>;

  const updateStatus = async (shopId: string, status: string) => {
    const { error } = await supabase.from('barbershops').update({ subscription_status: status }).eq('id', shopId);
    if (error) return toast.error(error.message);
    toast.success('Status atualizado');
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
  };

  const updatePlan = async (shopId: string, plan: string) => {
    const { error } = await supabase.from('barbershops').update({ plan }).eq('id', shopId);
    if (error) return toast.error(error.message);
    toast.success('Plano atualizado');
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Administração SaaS" subtitle="Gestão de barbearias e assinaturas" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="text-xs text-muted uppercase tracking-wide">Total de Barbearias</div>
          <div className="text-3xl font-semibold mt-2">{shops?.length || 0}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted uppercase tracking-wide">Ativas / Trial</div>
          <div className="text-3xl font-semibold mt-2 text-emerald-400">
            {shops?.filter((s: any) => s.subscription_status === 'active').length || 0} / {shops?.filter((s: any) => s.subscription_status === 'trialing').length || 0}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-muted uppercase tracking-wide">Inadimplentes</div>
          <div className="text-3xl font-semibold mt-2 text-red-400">
            {shops?.filter((s: any) => s.subscription_status === 'past_due' || s.subscription_status === 'canceled').length || 0}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg-hover text-xs uppercase tracking-wider text-muted font-semibold">
              <th className="px-6 py-4">Barbearia</th>
              <th className="px-6 py-4">Plano</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Expira em / Pago até</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="px-6 py-8 text-center animate-pulse">Carregando...</td></tr>}
            {shops?.map((shop: any) => (
              <tr key={shop.id} className="hover:bg-hover-soft transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-sm">{shop.nome}</div>
                  <div className="text-xs text-muted">/{shop.slug}</div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={shop.plan} 
                    onChange={(e) => updatePlan(shop.id, e.target.value)}
                    className="bg-transparent text-sm border-none focus:ring-0 p-0 capitalize cursor-pointer"
                  >
                    <option value="trial">Trial</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={shop.subscription_status} />
                    <select 
                      value={shop.subscription_status} 
                      onChange={(e) => updateStatus(shop.id, e.target.value)}
                      className="bg-transparent text-sm border-none focus:ring-0 p-0 capitalize cursor-pointer"
                    >
                      <option value="trialing">Trialing</option>
                      <option value="active">Active</option>
                      <option value="past_due">Past Due</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  {shop.subscription_status === 'trialing' ? (
                    <span className={new Date(shop.trial_ends_at) < new Date() ? 'text-red-400' : ''}>
                      {format(new Date(shop.trial_ends_at), 'dd/MM/yyyy')}
                    </span>
                  ) : (
                    shop.paid_until ? format(new Date(shop.paid_until), 'dd/MM/yyyy') : '—'
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => window.open(`${window.location.origin}/b/${shop.slug}`, '_blank')}
                    className="btn-ghost px-2 py-1 text-xs"
                  >
                    Ver Site
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'active': return <CheckCircle2 size={14} className="text-emerald-400" />;
    case 'trialing': return <Clock size={14} className="text-amber-400" />;
    case 'past_due': return <ShieldAlert size={14} className="text-red-400" />;
    case 'canceled': return <XCircle size={14} className="text-muted" />;
    default: return <Clock size={14} className="text-muted" />;
  }
}
