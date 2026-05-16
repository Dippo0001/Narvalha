import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Users, Scissors, Megaphone, Package, Wallet, 
  Settings, LogOut, Sun, Moon, Store, ShoppingCart, 
  ShieldCheck, Menu, X 
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
  { to: '/servicos', label: 'Serviços', icon: Scissors },
  { to: '/promocoes', label: 'Promoções', icon: Megaphone },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Layout() {
  const { barbershop, signOut, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ink-950 text-ink-50 font-sans">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-ink-950/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
        <div className="logo text-2xl text-ink-50">Navalha</div>
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
        w-full sm:w-60 bg-ink-950 border-r border-border flex flex-col transition-transform duration-300 ease-in-out
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="px-6 py-6 border-b border-border flex items-center justify-between">
          <div>
            <div className="logo text-3xl">Navalha</div>
            {barbershop && <div className="text-xs text-ink-500 mt-0.5 truncate">{barbershop.nome}</div>}
          </div>
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
          {isAdmin && (
            <NavLink
              to="/saas-admin"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors mt-6 border-t border-border pt-6 ${
                  isActive ? 'bg-hover-soft font-medium text-amber-500' : 'text-amber-500/70 hover:bg-hover-soft'
                }`
              }
              style={({ isActive }: any) => isActive ? { background: 'var(--bg-hover)' } : {}}
            >
              <ShieldCheck size={18} strokeWidth={1.75} />
              Admin SaaS
            </NavLink>
          )}
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
        <SubscriptionAlerts />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}