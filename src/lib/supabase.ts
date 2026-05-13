import { createClient } from '@supabase/supabase-js';

// Try standard Vite prefix, then the specific ones found in the user's environment
const url = (import.meta.env.VITE_SUPABASE_URL || 
             import.meta.env.A_VITE_PUBLIC_SUPABASE_URL || 
             import.meta.env.A_SUPABASE_URL) as string;

const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || 
             import.meta.env.A_VITE_PUBLIC_SUPABASE_ANON_KEY || 
             import.meta.env.A_SUPABASE_ANON_KEY) as string;

if (!url || !key) {
  console.error("Supabase credentials missing! Check your environment variables.");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
