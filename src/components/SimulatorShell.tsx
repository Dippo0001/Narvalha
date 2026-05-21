import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Monitor, X } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { BarberSessionProvider } from '../lib/barber-session-context';
import { CashProvider } from '../lib/cash-context';
import { SimulatorCtx } from '../lib/simulator-context';
import Layout from './Layout';
import Dashboard from '../pages/Dashboard';
import Schedule from '../pages/Schedule';
import Clients from '../pages/Clients';
import Catalog from '../pages/Catalog';
import PDV from '../pages/PDV';
import Finance from '../pages/Finance';
import Settings from '../pages/Settings';
import Promotions from '../pages/Promotions';
import CaixaAbrir from '../pages/CaixaAbrir';
import CaixaResumo from '../pages/CaixaResumo';
import CaixaFechar from '../pages/CaixaFechar';
import CaixaHistorico from '../pages/CaixaHistorico';
import POS from '../pages/POS';
import NovaFilial from '../pages/NovaFilial';

/**
 * Full-screen simulator overlay rendered at /simulador on admin subdomain.
 * Renders the full user-facing app inside a MemoryRouter so navigation is
 * completely isolated from the admin URL. Uses the demo (is_demo=true) shop
 * as the active barbershop — plan is platinum, subscription is active,
 * all features unlocked, no billing alerts.
 */
export default function SimulatorShell() {
  const navigate = useNavigate(); // real BrowserRouter navigate — for the exit button
  const { barbershops, barbershop: currentShop, setActiveBarbershop } = useAuth();
  const [ready, setReady] = useState(false);

  const demoShop = (barbershops as any[]).find(s => s.is_demo);

  // Switch active barbershop to the demo shop before showing the app
  useEffect(() => {
    if (!demoShop) { setReady(true); return; }
    setActiveBarbershop(demoShop.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoShop?.id]);

  // Mark ready once the auth context reflects the demo shop
  useEffect(() => {
    if (!demoShop) return;
    if (currentShop?.id === demoShop.id) setReady(true);
  }, [currentShop?.id, demoShop?.id]);

  /* ── No demo shop ── */
  if (!demoShop && ready) {
    return (
      <div className="fixed inset-0 z-50 bg-ink-950 flex flex-col">
        <SimBar onExit={() => navigate('/')} shopName={null} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <Monitor size={40} className="mx-auto text-ink-600" />
            <div>
              <p className="font-medium text-ink-200">Nenhuma conta teste criada</p>
              <p className="text-sm text-ink-500 mt-2 leading-relaxed">
                Para usar o simulador, primeiro crie uma conta teste na aba{' '}
                <strong className="text-ink-300">Conta Teste</strong> do painel admin.
              </p>
            </div>
            <button onClick={() => navigate('/')} className="btn-outline w-full">
              ← Voltar ao admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Switching barbershop ── */
  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 bg-ink-950 flex items-center justify-center">
        <div className="logo text-3xl text-ink-500 animate-pulse">Navalha</div>
      </div>
    );
  }

  /* ── Full simulator ── */
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <SimBar onExit={() => navigate('/')} shopName={demoShop.nome} />
      <div className="flex-1 overflow-hidden">
        <SimulatorCtx.Provider value={true}>
          {/*
            MemoryRouter: all navigation inside the simulator is in-memory.
            NavLinks, useNavigate(), <Link> — all use this router.
            The real BrowserRouter URL stays at /simulador.
          */}
          <MemoryRouter initialEntries={['/']}>
            {/* Isolated barber session starting as owner — no BarberLock shown */}
            <BarberSessionProvider initialBarber={{ id: 'owner', nome: 'Proprietário' }}>
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
            </BarberSessionProvider>
          </MemoryRouter>
        </SimulatorCtx.Provider>
      </div>
    </div>
  );
}

/* ── Simulator top bar ─────────────────────────────────────── */
function SimBar({ onExit, shopName }: { onExit: () => void; shopName: string | null }) {
  return (
    <div className="h-9 bg-violet-950 border-b border-violet-800/60 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2 text-xs text-violet-300">
        <Monitor size={13} className="text-violet-400" />
        <span className="font-semibold text-violet-200">Modo Simulador</span>
        {shopName && (
          <>
            <span className="text-violet-700">·</span>
            <span className="text-violet-400">{shopName}</span>
            <span className="text-violet-700">·</span>
            <span className="text-emerald-400 font-medium">Platina · Tudo liberado</span>
          </>
        )}
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-100 transition-colors"
      >
        <X size={13} /> Fechar simulador
      </button>
    </div>
  );
}
