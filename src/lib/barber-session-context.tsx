import { createContext, useContext, useState, ReactNode } from 'react';

interface ActiveBarber {
  id: string;
  nome: string;
}

interface BarberSessionCtx {
  activeBarber: ActiveBarber | null;
  setActiveBarber: (b: ActiveBarber | null) => void;
  clearBarber: () => void;
}

const STORAGE_KEY = 'narvalha_barber_session';

function readSession(): ActiveBarber | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<BarberSessionCtx>({
  activeBarber: null,
  setActiveBarber: () => {},
  clearBarber: () => {},
});

export function BarberSessionProvider({
  children,
  initialBarber,
}: {
  children: ReactNode;
  /** When provided, skips sessionStorage and starts with this value (used by simulator). */
  initialBarber?: ActiveBarber | null;
}) {
  const [activeBarber, setActiveBarberState] = useState<ActiveBarber | null>(
    initialBarber !== undefined ? initialBarber : readSession,
  );

  const setActiveBarber = (b: ActiveBarber | null) => {
    setActiveBarberState(b);
    if (b) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    else sessionStorage.removeItem(STORAGE_KEY);
  };

  const clearBarber = () => {
    setActiveBarberState(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Ctx.Provider value={{ activeBarber, setActiveBarber, clearBarber }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBarberSession = () => useContext(Ctx);
