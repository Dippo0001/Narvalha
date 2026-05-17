-- Admin emails that bypass RLS and can access all tenant data
CREATE OR REPLACE FUNCTION is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.email() IN (
    'diarley@gmail.com',
    'admin@narvalha.com.br',
    'Diarleyduarte17@gmail.com'
  );
$$;

-- Barbershops: admin can read and update all
CREATE POLICY "saas_admin_select_all_barbershops"
  ON barbershops FOR SELECT TO authenticated
  USING (is_saas_admin());

CREATE POLICY "saas_admin_update_all_barbershops"
  ON barbershops FOR UPDATE TO authenticated
  USING (is_saas_admin())
  WITH CHECK (is_saas_admin());

-- Members: admin can read all members across all shops
CREATE POLICY "saas_admin_select_all_members"
  ON members FOR SELECT TO authenticated
  USING (is_saas_admin());
