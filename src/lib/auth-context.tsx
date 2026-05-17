import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase, isRecoveryFlow } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { Barbershop, Member } from '../types/db';

const ACTIVE_STORE_KEY = 'narvalha_active_barbershop_id';
export const SIM_SHOP_KEY = 'narvalha_sim_shop_id';

interface AuthState {
  session: Session | null;
  loading: boolean;
  member: Member | null;
  barbershop: Barbershop | null;
  barbershops: Barbershop[];
  isAdmin: boolean;
  isRecovery: boolean;
  isSimulating: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setActiveBarbershop: (id: string) => void;
  exitSimulation: () => void;
}

const Ctx = createContext<AuthState>({
  session: null, loading: true, member: null, barbershop: null, barbershops: [],
  isAdmin: false, isRecovery: false, isSimulating: false,
  refresh: async () => {}, signOut: async () => {},
  setActiveBarbershop: () => {}, exitSimulation: () => {},
});

const ADMIN_EMAILS = ['diarley@gmail.com', 'admin@narvalha.com.br', 'diarleyduarte17@gmail.com'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [barbershops, setBarbershops] = useState<Barbershop[]>([]);
  const [isSimulating, setIsSimulating] = useState(!!localStorage.getItem(SIM_SHOP_KEY));

  // isRecoveryFlow is captured at module load time (supabase.ts import),
  // before Supabase processes and clears the URL hash — avoids race condition
  const recoveryRef = useRef(isRecoveryFlow);
  const [isRecovery, setIsRecovery] = useState(isRecoveryFlow);

  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  const loadMember = async (userId: string, userIsAdmin?: boolean) => {
    // Simulation mode: admin bypasses normal membership — loads target shop directly
    const simId = localStorage.getItem(SIM_SHOP_KEY);
    if (simId && userIsAdmin) {
      const { data: simShop } = await supabase.from('barbershops').select('*').eq('id', simId).maybeSingle();
      if (simShop) {
        setBarbershop(simShop as Barbershop);
        setBarbershops([simShop as Barbershop]);
        // Fake owner member for full access
        setMember({ id: 'sim', user_id: userId, barbershop_id: simId, role: 'owner', ativo: true });
        setIsSimulating(true);
        return;
      }
    }

    // Normal flow: load all barbershops the user is a member of
    const { data: members } = await supabase
      .from('members')
      .select('*, barbershops(*)')
      .eq('user_id', userId)
      .eq('ativo', true);

    if (!members || members.length === 0) {
      setMember(null);
      setBarbershop(null);
      setBarbershops([]);
      return;
    }

    const allShops = members.map((m: any) => m.barbershops).filter(Boolean) as Barbershop[];
    setBarbershops(allShops);

    const savedId = localStorage.getItem(ACTIVE_STORE_KEY);
    const active = allShops.find(b => b.id === savedId) ?? allShops[0];
    const activeMember = members.find((m: any) => m.barbershop_id === active.id);

    setBarbershop(active);
    setMember(activeMember as Member);
  };

  const exitSimulation = () => {
    localStorage.removeItem(SIM_SHOP_KEY);
    setIsSimulating(false);
    setMember(null);
    setBarbershop(null);
    setBarbershops([]);
  };

  const setActiveBarbershop = (id: string) => {
    const shop = barbershops.find(b => b.id === id);
    if (!shop) return;
    localStorage.setItem(ACTIVE_STORE_KEY, id);
    setBarbershop(shop);
    // Update member for the newly selected barbershop — will re-query
    if (session) loadMember(session.user.id);
  };

  const refresh = async () => {
    const { data, error } = await supabase.auth.getSession();
    // Invalid/expired refresh token — clear stale session silently
    if (error?.message?.includes('Refresh Token')) {
      await supabase.auth.signOut();
      setSession(null); setMember(null); setBarbershop(null); setBarbershops([]);
      setLoading(false);
      return;
    }
    const admin = !!data.session?.user?.email && ADMIN_EMAILS.includes(data.session.user.email.toLowerCase());
    setSession(data.session);
    // Skip member loading during recovery — user only needs to set a new password
    if (data.session && !recoveryRef.current) await loadMember(data.session.user.id, admin);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED' && !s) {
        setSession(null); setMember(null); setBarbershop(null); setBarbershops([]);
        setLoading(false);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true;
        setIsRecovery(true);
        setSession(s);
        setLoading(false);
        return;
      }
      recoveryRef.current = false;
      setIsRecovery(false);
      setSession(s);
      (async () => {
        if (s) {
          const admin = ADMIN_EMAILS.includes((s.user.email ?? '').toLowerCase());
          await loadMember(s.user.id, admin);
        } else { setMember(null); setBarbershop(null); setBarbershops([]); }
        setLoading(false);
      })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null); setBarbershop(null); setBarbershops([]);
    localStorage.removeItem(ACTIVE_STORE_KEY);
    localStorage.removeItem(SIM_SHOP_KEY);
    setIsSimulating(false);
    recoveryRef.current = false;
    setIsRecovery(false);
  };

  return (
    <Ctx.Provider value={{ session, loading, member, barbershop, barbershops, isAdmin, isRecovery, isSimulating, refresh, signOut, setActiveBarbershop, exitSimulation }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
