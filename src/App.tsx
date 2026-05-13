import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth-context';
import { CashProvider } from './lib/cash-context';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Clients from './pages/Clients';
import Services from './pages/Services';
import Products from './pages/Products';
import POS from './pages/POS';
import PDV from './pages/PDV';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Promotions from './pages/Promotions';
import CaixaAbrir from './pages/CaixaAbrir';
import CaixaResumo from './pages/CaixaResumo';
import CaixaFechar from './pages/CaixaFechar';
import CaixaHistorico from './pages/CaixaHistorico';
import PublicBooking from './pages/PublicBooking';

function AppRoutes() {
  const { session, loading, member } = useAuth();

  // BYPASS LOGIN FOR DEVELOPMENT
  const isDevBypass = true;

  if (loading && !isDevBypass) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="logo text-3xl text-ink-500 animate-pulse">Navalha</div>
      </div>
    );
  }

  if (!session && !isDevBypass) {
    return (
      <Routes>
        <Route path="/b/:slug" element={<PublicBooking />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!member && !isDevBypass) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <CashProvider>
      <Routes>
        <Route path="/b/:slug" element={<PublicBooking />} />
        <Route path="/caixa/abrir" element={<CaixaAbrir />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/caixa" element={<CaixaResumo />} />
          <Route path="/caixa/fechar" element={<CaixaFechar />} />
          <Route path="/caixa/historico" element={<CaixaHistorico />} />
          <Route path="/agenda" element={<Schedule />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/servicos" element={<Services />} />
          <Route path="/promocoes" element={<Promotions />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/atendimento/:id" element={<POS />} />
          <Route path="/pdv" element={<PDV />} />
          <Route path="/financeiro" element={<Finance />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CashProvider>
  );
}

function App() {
  return <AppRoutes />;
}

export default App;
