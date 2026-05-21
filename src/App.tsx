import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth-context';
import { useBarberSession, BarberSessionProvider } from './lib/barber-session-context';
import { CashProvider } from './lib/cash-context';
import { addDays, isAfter } from 'date-fns';
import Login from './pages/Login';
import PublicBooking from './pages/PublicBooking';
import AdminLogin from './pages/AdminLogin';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword';
import Onboarding from './pages/Onboarding';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Clients from './pages/Clients';
import Catalog from './pages/Catalog';
import POS from './pages/POS';
import PDV from './pages/PDV';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Promotions from './pages/Promotions';
import CaixaAbrir from './pages/CaixaAbrir';
import CaixaResumo from './pages/CaixaResumo';
import CaixaFechar from './pages/CaixaFechar';
import CaixaHistorico from './pages/CaixaHistorico';
import SubscriptionBlocked from './pages/SubscriptionBlocked';
import SaaSAdmin from './pages/SaaSAdmin';
import SimulatorShell from './components/SimulatorShell';
import NovaFilial from './pages/NovaFilial';
import Landing from './pages/Landing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import BarberLock from './pages/BarberLock';
import CookieBanner from './components/CookieBanner';

function AppRoutes() {
  const { session, loading, member, barbershop, isAdmin, isRecovery } = useAuth();
  const { activeBarber } = useBarberSession();
  const { pathname } = useLocation();
  const isAdminSubdomain = window.location.hostname === 'admin.narvalha.com.br';

  // Public booking page — accessible without authentication
  if (pathname.startsWith('/b/')) {
    return (
      <Routes>
        <Route path="/b/:slug" element={<PublicBooking />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="logo text-3xl text-ink-500 animate-pulse">Navalha</div>
      </div>
    );
  }

  // Password recovery flow — must come before any other routing logic
  if (isRecovery) {
    return (
      <Routes>
        <Route path="*" element={<UpdatePassword />} />
      </Routes>
    );
  }

  // Admin Subdomain Logic
  if (isAdminSubdomain) {
    if (!session || !isAdmin) {
      return (
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
    return (
      <Routes>
        <Route path="/simulador" element={<SimulatorShell />} />
        <Route path="/" element={<SaaSAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Main App Logic
  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacidade" element={<PrivacyPolicy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!member) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // Subscription check: Hard block only after 10 days of grace period
  const expiration = barbershop?.paid_until
    ? new Date(barbershop.paid_until)
    : new Date(barbershop?.trial_ends_at || 0);

  const blockDate = addDays(expiration, 10);
  const isHardBlocked = isAfter(new Date(), blockDate);

  if (isHardBlocked && !isAdmin) {
    return (
      <Routes>
        <Route path="/assinatura-bloqueada" element={<SubscriptionBlocked />} />
        <Route path="*" element={<Navigate to="/assinatura-bloqueada" replace />} />
      </Routes>
    );
  }

  // Barber lock screen — owner is logged in but no barber selected yet
  if (!activeBarber) {
    return <BarberLock />;
  }

  // Barber mode — restricted to PDV only
  if (activeBarber.id !== 'owner') {
    return (
      <CashProvider>
        <Routes>
          <Route path="/caixa/abrir" element={<CaixaAbrir />} />
          <Route path="*" element={<PDV barberId={activeBarber.id} />} />
        </Routes>
      </CashProvider>
    );
  }

  // Owner mode — full access
  return (
    <CashProvider>
      <Routes>
        <Route path="/caixa/abrir" element={<CaixaAbrir />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/caixa" element={<CaixaResumo />} />
          <Route path="/caixa/fechar" element={<CaixaFechar />} />
          <Route path="/caixa/historico" element={<CaixaHistorico />} />
          <Route path="/agenda" element={<Schedule />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/servicos" element={<Navigate to="/catalogo" replace />} />
          <Route path="/produtos" element={<Navigate to="/catalogo" replace />} />
          <Route path="/promocoes" element={<Promotions />} />
          <Route path="/atendimento/:id" element={<POS />} />
          <Route path="/pdv" element={<PDV />} />
          <Route path="/financeiro" element={<Finance />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/nova-filial" element={<NovaFilial />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CashProvider>
  );
}

function App() {
  return (
    <BarberSessionProvider>
      <AppRoutes />
      <CookieBanner />
    </BarberSessionProvider>
  );
}

export default App;
