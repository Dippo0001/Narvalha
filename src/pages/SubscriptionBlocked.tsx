import { useAuth } from '../lib/auth-context';
import { CreditCard, LogOut, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SubscriptionBlocked() {
  const { barbershop, signOut } = useAuth();

  const isTrialExpired = barbershop?.subscription_status === 'trialing' && 
    new Date(barbershop.trial_ends_at) < new Date();
  
  const isPastDue = barbershop?.subscription_status === 'past_due' || barbershop?.subscription_status === 'canceled';

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full card p-8 text-center space-y-6" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
          <AlertCircle size={32} />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Acesso Suspenso</h1>
          <p className="text-muted text-sm">
            {isTrialExpired ? (
              <>Seu período de teste gratuito expirou em <strong>{format(new Date(barbershop!.trial_ends_at), "dd 'de' MMMM", { locale: ptBR })}</strong>.</>
            ) : isPastDue ? (
              <>Sua assinatura está atrasada ou foi cancelada. Regularize seu pagamento para continuar usando o sistema.</>
            ) : (
              <>Sua barbearia está com o acesso bloqueado por falta de pagamento.</>
            )}
          </p>
        </div>

        <div className="bg-bg-hover rounded-lg p-4 text-left border border-border">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs uppercase tracking-wider text-muted font-semibold">Barbearia</span>
            <span className="text-sm font-medium">{barbershop?.nome}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-muted font-semibold">Status</span>
            <span className="text-sm font-medium text-red-400 capitalize">
              {barbershop?.subscription_status === 'trialing' ? 'Teste Expirado' : 'Inadimplente'}
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button 
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            onClick={() => window.open('https://narvalha.com.br/assinar', '_blank')}
          >
            <CreditCard size={18} />
            Regularizar Assinatura
          </button>
          
          <button 
            className="btn-ghost w-full py-3 flex items-center justify-center gap-2 text-muted hover:text-current"
            onClick={signOut}
          >
            <LogOut size={18} />
            Sair do Sistema
          </button>
        </div>

        <p className="text-[10px] text-muted-dark">
          Dúvidas? Entre em contato com o suporte: (88) 99999-9999
        </p>
      </div>
    </div>
  );
}
