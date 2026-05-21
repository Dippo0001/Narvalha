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

const Ctx = createContext<BarberSessionCtx>({
  activeBarber: null,
  setActiveBarber: () => {},
  clearBarber: () => {},
});

export function BarberSessionProvider({ children }: { children: ReactNode }) {
  const [activeBarber, setActiveBarberState] = useState<ActiveBarber | null>(null);

  const setActiveBarber = (b: ActiveBarber | null) => setActiveBarberState(b);
  const clearBarber = () => setActiveBarberState(null);

  return (
    <Ctx.Provider value={{ activeBarber, setActiveBarber, clearBarber }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBarberSession = () => useContext(Ctx);
