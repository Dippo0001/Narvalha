import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { Barbershop, Member } from '../types/db';

interface AuthState {
  session: Session | null;
  loading: boolean;
  member: Member | null;
  barbershop: Barbershop | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null, loading: true, member: null, barbershop: null,
  refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);

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
    if (data.session) await loadMember(data.session.user.id);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
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
  };

  return (
    <Ctx.Provider value={{ session, loading, member, barbershop, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
