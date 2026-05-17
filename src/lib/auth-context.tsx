import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase, isRecoveryFlow } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { Barbershop, Member } from '../types/db';

const ACTIVE_STORE_KEY = 'narvalha_active_barbershop_id';

interface AuthState {
  session: Session | null;
  loading: boolean;
  member: Member | null;
  barbershop: Barbershop | null;
  barbershops: Barbershop[];
  isAdmin: boolean;
  isRecovery: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setActiveBarbershop: (id: string) => void;
}

const Ctx = createContext<AuthState>({
  session: null, loading: true, member: null, barbershop: null, barbershops: [],
  isAdmin: false, isRecovery: false,
  refresh: async () => {}, signOut: async () => {}, setActiveBarbershop: () => {},
});

const ADMIN_EMAILS = ['diarley@gmail.com', 'admin@narvalha.com.br', 'diarleyduarte17@gmail.com'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [barbershops, setBarbershops] = useState<Barbershop[]>([]);

  // isRecoveryFlow is captured at module load time (supabase.ts import),
  // before Supabase processes and clears the URL hash — avoids race condition
  const recoveryRef = useRef(isRecoveryFlow);
  const [isRecovery, setIsRecovery] = useState(isRecoveryFlow);

  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  const loadMember = async (userId: string) => {
    // Load all barbershops the user is a member of
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

    const allShops = members
      .map((m: any) => m.barbershops)
      .filter(Boolean) as Barbershop[];

    setBarbershops(allShops);

    // Determine which store is active
    const savedId = localStorage.getItem(ACTIVE_STORE_KEY);
    const active = allShops.find(b => b.id === savedId) ?? allShops[0];
    const activeMember = members.find((m: any) => m.barbershop_id === active.id);

    setBarbershop(active);
    setMember(activeMember as Member);
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
    setSession(data.session);
    // Skip member loading during recovery — user only needs to set a new password
    if (data.session && !recoveryRef.current) await loadMember(data.session.user.id);
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
        if (s) await loadMember(s.user.id);
        else { setMember(null); setBarbershop(null); setBarbershops([]); }
        setLoading(false);
      })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null); setBarbershop(null); setBarbershops([]);
    localStorage.removeItem(ACTIVE_STORE_KEY);
    recoveryRef.current = false;
    setIsRecovery(false);
  };

  return (
    <Ctx.Provider value={{ session, loading, member, barbershop, barbershops, isAdmin, isRecovery, refresh, signOut, setActiveBarbershop }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
