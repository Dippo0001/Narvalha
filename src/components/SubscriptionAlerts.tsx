import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { AlertTriangle, ShieldAlert, X, CreditCard } from 'lucide-react';
import { differenceInDays, format, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Modal from './Modal';

export default function SubscriptionAlerts() {
  const { barbershop } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [alertData, setAlertData] = useState<{
    type: 'preventive' | 'due_day' | 'overdue' | 'imminent_block';
    days: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!barbershop) return;

    const expiration = barbershop.paid_until 
      ? new Date(barbershop.paid_until) 
      : new Date(barbershop.trial_ends_at);
    
    const today = new Date();
    const diff = differenceInDays(expiration, today);
    const isOverdue = isAfter(today, expiration);
    const daysOverdue = isOverdue ? Math.abs(diff) : 0;

    // 1. Check for imminent block (5 to 9 days overdue)
    if (isOverdue && daysOverdue >= 5 && daysOverdue < 10) {
      setAlertData({
        type: 'imminent_block',
        days: 10 - daysOverdue,
        message: `Sua conta será SUSPENSA em ${10 - daysOverdue} dias por falta de pagamento.`
      });
      checkDailyPopup('imminent_block');
      return;
    }

    // 2. Check for overdue (1 to 4 days)
    if (isOverdue && daysOverdue >= 1 && daysOverdue < 5) {
      setAlertData({
        type: 'overdue',
        days: daysOverdue,
        message: `Sua mensalidade está atrasada há ${daysOverdue} dia(s). Evite a suspensão do sistema.`
      });
      checkDailyPopup('overdue');
      return;
    }

    // 3. Check for due day
    if (diff === 0) {
      setAlertData({
        type: 'due_day',
        days: 0,
        message: 'Sua mensalidade vence HOJE. Renove agora para manter o acesso.'
      });
      return;
    }

    // 4. Check for preventive (up to 5 days before)
    if (diff > 0 && diff <= 5) {
      setAlertData({
        type: 'preventive',
        days: diff,
        message: `Sua assinatura vence em ${diff} dias (${format(expiration, 'dd/MM', { locale: ptBR })}).`
      });
      return;
    }

    setAlertData(null);
  }, [barbershop]);

  const checkDailyPopup = (type: string) => {
    const key = `last_sub_popup_${barbershop?.id}`;
    const lastShown = localStorage.getItem(key);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (lastShown !== todayStr) {
      setShowPopup(true);
      localStorage.setItem(key, todayStr);
    }
  };

  if (!alertData) return null;

  return (
    <>
      {/* Horizontal Banner for Preventive and Due Day */}
      {(alertData.type === 'preventive' || alertData.type === 'due_day') && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top duration-500">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs font-medium text-amber-200">{alertData.message}</span>
          <button 
            onClick={() => window.location.href = '/configuracoes'} 
            className="text-[10px] bg-amber-500 text-ink-950 px-2 py-0.5 rounded font-bold uppercase hover:bg-amber-400 transition-colors"
          >
            Pagar Agora
          </button>
        </div>
      )}

      {/* Daily Popup for Overdue */}
      <Modal open={showPopup} onClose={() => setShowPopup(false)} title="Aviso Importante">
        <div className="space-y-4 py-2">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} className="text-red-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-ink-50">Pagamento Pendente</h3>
            <p className="text-sm text-ink-400 mt-2 leading-relaxed">
              {alertData.message}
            </p>
            {alertData.type === 'imminent_block' && (
              <p className="text-xs text-red-400 mt-3 font-bold uppercase tracking-tight">
                Regularize hoje para evitar o bloqueio total do seu acesso.
              </p>
            )}
          </div>
          <div className="pt-4 flex flex-col gap-2">
            <button 
              onClick={() => { setShowPopup(false); window.location.href = '/configuracoes'; }}
              className="btn-primary w-full py-3"
            >
              Ir para Pagamento
            </button>
            <button 
              onClick={() => setShowPopup(false)}
              className="btn-ghost w-full text-xs text-ink-500"
            >
              Lembrar-me amanhã
            </button>
          </div>
        </div>
      </Modal>

      {/* Floating Warning for Imminent Block (after closing popup) */}
      {(alertData.type === 'imminent_block' || alertData.type === 'overdue') && !showPopup && (
        <div className="fixed bottom-6 right-6 z-50 animate-in zoom-in slide-in-from-bottom duration-500">
          <div className="bg-red-600 text-white p-4 rounded-xl shadow-2xl shadow-black/50 border border-red-500 max-w-xs flex gap-3">
            <ShieldAlert size={20} className="shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5">Atenção!</p>
              <p className="text-[11px] leading-tight opacity-90">{alertData.message}</p>
              <button 
                onClick={() => window.location.href = '/configuracoes'} 
                className="mt-2 text-[10px] font-bold bg-white text-red-600 px-2 py-1 rounded uppercase"
              >
                Resolver Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
