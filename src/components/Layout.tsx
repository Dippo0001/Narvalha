import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Scissors, Megaphone, Package, Wallet, Settings, LogOut, Link as LinkIcon, Sun, Moon, Store, ShoppingCart, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme';
import { toast } from 'sonner';

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

  const copyLink = () => {
    if (!barbershop) return;
    const url = `${window.location.origin}/b/${barbershop.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de agendamento copiado');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r divider bg-elev flex flex-col">
        <div className="px-6 py-6 border-b divider">
          <div className="logo text-3xl">Navalha</div>
          {barbershop && <div className="text-xs text-dim mt-0.5 truncate">{barbershop.nome}</div>}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-hover-soft font-medium' : 'text-muted hover:bg-hover-soft'
                }`
              }
              style={({ isActive }: any) => isActive ? { background: 'var(--bg-hover)' } : {}}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/saas-admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mt-6 border-t border-border pt-6 ${
                  isActive ? 'bg-hover-soft font-medium text-amber-500' : 'text-amber-500/70 hover:bg-hover-soft'
                }`
              }
              style={({ isActive }: any) => isActive ? { background: 'var(--bg-hover)' } : {}}
            >
              <ShieldCheck size={16} strokeWidth={1.75} />
              Admin SaaS
            </NavLink>
          )}
        </nav>
        <div className="border-t divider p-3 space-y-1">
          <button onClick={copyLink} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted bg-hover-soft">
            <LinkIcon size={16} strokeWidth={1.75} />
            Link público
          </button>
          <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted bg-hover-soft">
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted bg-hover-soft"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
