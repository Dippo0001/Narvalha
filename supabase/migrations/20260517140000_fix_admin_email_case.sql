-- =============================================================
-- FIX: Make admin email check case-insensitive
-- Supabase normalizes emails to lowercase, but the previous
-- function had 'Diarleyduarte17@gmail.com' with capital D,
-- which never matched auth.email() (always lowercase).
-- =============================================================

CREATE OR REPLACE FUNCTION is_saas_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT lower(auth.email()) IN (
    'diarley@gmail.com',
    'admin@narvalha.com.br',
    'diarleyduarte17@gmail.com'
  );
$$;
