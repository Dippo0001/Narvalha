import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Megaphone, Package, Wallet,
  Settings, LogOut, Sun, Moon, Store, ShoppingCart,
  Menu, X, ChevronDown, Plus
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme';
import SubscriptionAlerts from './SubscriptionAlerts';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/caixa', label: 'Caixa', icon: Store },
  { to: '/pdv', label: 'PDV', icon: ShoppingCart },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/catalogo', label: 'Catálogo', icon: Package },
  { to: '/promocoes', label: 'Promoções', icon: Megaphone },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

function StoreSwitcher({ closeMenu }: { closeMenu: () => void }) {
  const { barbershop, barbershops, setActiveBarbershop } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canAddStore = barbershop?.plan === 'platinum' && barbershop?.parent_barbershop_id === null;
  const otherStores = barbershops.filter(b => b.id !== barbershop?.id);

  // Single store: show plain name, no dropdown
  if (barbershops.length <= 1 && !canAddStore) {
    return (
      <button onClick={() => { navigate('/'); closeMenu(); }} className="text-left hover:opacity-80 transition-opacity">
        <div className="logo text-3xl">Navalha</div>
        {barbershop && <div className="text-xs text-ink-500 mt-0.5 truncate max-w-[160px]">{barbershop.nome}</div>}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-left hover:opacity-90 transition-opacity w-full"
      >
        <div className="logo text-3xl">Navalha</div>
        {barbershop && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-ink-500 truncate max-w-[140px]">{barbershop.nome}</span>
            <ChevronDown size={12} className={`text-ink-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-ink-900 border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {barbershops.map(shop => (
            <button
              key={shop.id}
              onClick={() => {
                setActiveBarbershop(shop.id);
                setOpen(false);
                navigate('/');
                closeMenu();
              }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-hover-soft flex items-center justify-between gap-2 ${
                shop.id === barbershop?.id ? 'text-ink-50 font-medium' : 'text-ink-400'
              }`}
            >
              <span className="truncate">{shop.nome}</span>
              {shop.id === barbershop?.id && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
            </button>
          ))}
          {canAddStore && (
            <>
              <div className="border-t border-border" />
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/nova-filial');
                  closeMenu();
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-ink-400 hover:bg-hover-soft transition-colors flex items-center gap-2"
              >
                <Plus size={14} />
                Adicionar filial
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { signOut, barbershop } = useAuth();
  const isDemo = barbershop?.is_demo === true;
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ink-950 text-ink-50 font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-ink-950/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
        <button 
          onClick={() => navigate('/')} 
          className="logo text-2xl text-ink-50 hover:opacity-80 transition-opacity"
        >
          Navalha
        </button>
        <button 
          onClick={toggleMenu}
          className="p-2 text-ink-500 hover:text-ink-50 transition-colors"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar / Mobile Menu Overlay */}
      <aside className={`
        fixed inset-0 z-50 transform lg:relative lg:translate-x-0 lg:z-auto
        w-full sm:w-60 bg-ink-950 border-l lg:border-l-0 lg:border-r border-border flex flex-col transition-transform duration-300 ease-in-out
        ${isMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        lg:left-0 sm:right-0 lg:right-auto
      `}>
        {/* Sidebar Header */}
        <div className="px-6 py-6 border-b border-border flex items-center justify-between">
          <StoreSwitcher closeMenu={closeMenu} />
          <button onClick={closeMenu} className="lg:hidden text-ink-500 hover:text-ink-50">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-hover-soft font-medium' : 'text-muted hover:bg-hover-soft'
                }`
              }
              style={({ isActive }: any) => isActive ? { background: 'var(--bg-hover)' } : {}}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-3 space-y-1 bg-ink-950">
          <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted hover:bg-hover-soft transition-colors">
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto flex flex-col w-full pt-16 lg:pt-0">
        {isDemo && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-xs font-semibold shrink-0">
            <span>🧪 CONTA TESTE — {barbershop?.nome} (dados não contam nas métricas SaaS)</span>
            <a href="https://admin.narvalha.com.br" className="underline hover:no-underline">
              Voltar ao admin
            </a>
          </div>
        )}
        <SubscriptionAlerts />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}