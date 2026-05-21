import { createContext, useContext } from 'react';

/** True when rendering inside the admin simulator overlay. */
export const SimulatorCtx = createContext(false);
export const useIsSimulator = () => useContext(SimulatorCtx);
