import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

export interface CashSession {
  id: string;
  barbershop_id: string;
  opened_at: string;
  opened_by: string | null;
  saldo_inicial: number;
  status: 'aberto' | 'fechado';
  observacoes_abertura: string;
}

export interface CashSummary {
  total_entradas: number;
  total_saidas: number;
  total_sangrias: number;
  total_suprimentos: number;
  total_dinheiro: number;
  total_pix: number;
  total_debito: number;
  total_credito: number;
  total_outros: number;
  total_atendimentos: number;
  ticket_medio: number;
  saldo_estimado: number;
}

interface CashCtx {
  session: CashSession | null;
  summary: CashSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CashCtx>({ session: null, summary: null, loading: true, refresh: async () => {} });

const EMPTY_SUMMARY: CashSummary = {
  total_entradas: 0, total_saidas: 0, total_sangrias: 0, total_suprimentos: 0,
  total_dinheiro: 0, total_pix: 0, total_debito: 0, total_credito: 0, total_outros: 0,
  total_atendimentos: 0, ticket_medio: 0, saldo_estimado: 0,
};

export function CashProvider({ children }: { children: ReactNode }) {
  const { barbershop } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!barbershop) { setSession(null); setSummary(null); setLoading(false); return; }

    const { data: s } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('barbershop_id', barbershop.id)
      .eq('status', 'aberto')
      .maybeSingle();

    setSession(s as CashSession | null);

    if (s) {
      const [{ data: mvts }, { data: orders }] = await Promise.all([
        supabase.from('cash_movements').select('tipo,valor,forma_pagamento').eq('cash_session_id', s.id),
        supabase.from('orders').select('total').eq('cash_session_id', s.id).eq('status', 'fechada'),
      ]);

      const ms = mvts ?? [];
      const os = orders ?? [];

      const total_entradas    = ms.filter((m: any) => m.tipo === 'entrada').reduce((a: number, m: any) => a + Number(m.valor), 0);
      const total_saidas      = ms.filter((m: any) => m.tipo === 'saida').reduce((a: number, m: any) => a + Number(m.valor), 0);
      const total_sangrias    = ms.filter((m: any) => m.tipo === 'sangria').reduce((a: number, m: any) => a + Number(m.valor), 0);
      const total_suprimentos = ms.filter((m: any) => m.tipo === 'suprimento').reduce((a: number, m: any) => a + Number(m.valor), 0);

      const byForma = (forma: string) =>
        ms.filter((m: any) => m.tipo === 'entrada' && m.forma_pagamento === forma).reduce((a: number, m: any) => a + Number(m.valor), 0);

      const total_dinheiro = byForma('dinheiro');
      const total_pix      = byForma('pix');
      const total_debito   = byForma('debito');
      const total_credito  = byForma('credito');
      const total_outros   = total_entradas - total_dinheiro - total_pix - total_debito - total_credito;

      const total_atendimentos = os.length;
      const ticket_medio = total_atendimentos > 0 ? total_entradas / total_atendimentos : 0;
      const saldo_estimado = Number(s.saldo_inicial) + total_dinheiro + total_suprimentos - total_sangrias - total_saidas;

      setSummary({
        total_entradas, total_saidas, total_sangrias, total_suprimentos,
        total_dinheiro, total_pix, total_debito, total_credito, total_outros: Math.max(0, total_outros),
        total_atendimentos, ticket_medio, saldo_estimado,
      });
    } else {
      setSummary(EMPTY_SUMMARY);
    }

    setLoading(false);
  }, [barbershop]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh when cash_movements or orders change for this barbershop
  useEffect(() => {
    if (!barbershop) return;
    const ch = supabase.channel('cash-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `barbershop_id=eq.${barbershop.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions',  filter: `barbershop_id=eq.${barbershop.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',         filter: `barbershop_id=eq.${barbershop.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [barbershop, load]);

  return <Ctx.Provider value={{ session, summary, loading, refresh: load }}>{children}</Ctx.Provider>;
}

export const useCash = () => useContext(Ctx);
