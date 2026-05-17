import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase, isRecoveryFlow } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { Barbershop, Member } from '../types/db';

interface AuthState {
  session: Session | null;
  loading: boolean;
  member: Member | null;
  barbershop: Barbershop | null;
  isAdmin: boolean;
  isRecovery: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null, loading: true, member: null, barbershop: null, isAdmin: false, isRecovery: false,
  refresh: async () => {}, signOut: async () => {},
});

const ADMIN_EMAILS = ['diarley@gmail.com', 'admin@narvalha.com.br', 'Diarleyduarte17@gmail.com'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);

  // isRecoveryFlow is captured at module load time (supabase.ts import),
  // before Supabase processes and clears the URL hash — avoids race condition
  const recoveryRef = useRef(isRecoveryFlow);
  const [isRecovery, setIsRecovery] = useState(isRecoveryFlow);

  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  const loadMember = async (userId: string) => {
    const { data: m } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();
    setMember(m as Member | null);
    if (m) {
      const { data: b } = await supabase
        .from('barbershops')
        .select('*')
        .eq('id', (m as Member).barbershop_id)
        .maybeSingle();
      setBarbershop(b as Barbershop | null);
    } else {
      setBarbershop(null);
    }
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    // Skip member loading during recovery — user only needs to set a new password
    if (data.session && !recoveryRef.current) await loadMember(data.session.user.id);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
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
        else { setMember(null); setBarbershop(null); }
        setLoading(false);
      })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null); setBarbershop(null);
    recoveryRef.current = false;
    setIsRecovery(false);
  };

  return (
    <Ctx.Provider value={{ session, loading, member, barbershop, isAdmin, isRecovery, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
