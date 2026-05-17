import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || 
             import.meta.env.A_VITE_PUBLIC_SUPABASE_URL || 
             import.meta.env.A_SUPABASE_URL) as string;

const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || 
             import.meta.env.A_VITE_PUBLIC_SUPABASE_ANON_KEY || 
             import.meta.env.A_SUPABASE_ANON_KEY) as string;

// Initialize the client with silent settings where possible
export const supabase = createClient(url, key, {
  auth: { 
    persistSession: true, 
    autoRefreshToken: true,
    debug: false, // Ensure auth debug is off
  },
  global: {
    // Some versions of the client might use this for logging
    headers: { 'x-client-info': 'narvalha-web' },
  }
});

// Only log error in development if keys are missing
if (!url || !key) {
  if (import.meta.env.DEV) {
    console.warn("Supabase: Credenciais não encontradas. Verifique seu arquivo .env");
  }
}
