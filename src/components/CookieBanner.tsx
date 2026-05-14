import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-8 md:max-w-md">
      <div className="card p-5 bg-ink-900 border-ink-800 shadow-2xl flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-ink-50">Privacidade e Cookies</h4>
            <p className="text-xs text-ink-500 leading-relaxed">
              Utilizamos cookies para melhorar sua experiência e analisar o tráfego do site. Ao continuar, você concorda com nossa <Link to="/privacidade" className="text-ink-100 underline">Política de Privacidade</Link>.
            </p>
          </div>
          <button onClick={() => setShow(false)} className="text-ink-600 hover:text-ink-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={accept} className="btn-primary w-full py-2 text-xs">
            Aceitar e continuar
          </button>
        </div>
      </div>
    </div>
  );
}
