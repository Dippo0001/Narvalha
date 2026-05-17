-- =============================================================
-- CRITICAL SECURITY FIX: Limit barbershop creation to 1 per user
-- Previous policy allowed any authenticated user to create
-- unlimited barbershops, enabling database flooding attacks.
-- =============================================================

-- Drop the unrestricted insert policy
DROP POLICY IF EXISTS "any authenticated can create barbershop" ON barbershops;

-- Replace with a policy that only allows creation if the user
-- has no existing active membership (i.e. no barbershop yet)
CREATE POLICY "authenticated can create one barbershop"
  ON barbershops FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND ativo = true
    )
  );

-- Also enforce the same guard inside the RPC so it's double-protected
CREATE OR REPLACE FUNCTION create_barbershop(p_nome text, p_slug text, p_telefone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Block flooding: one barbershop per user
  IF EXISTS (
    SELECT 1 FROM members WHERE user_id = auth.uid() AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Usuário já possui uma barbearia cadastrada';
  END IF;

  -- Validate slug format (alphanumeric + hyphens only)
  IF p_slug !~ '^[a-z0-9\-]{3,60}$' THEN
    RAISE EXCEPTION 'Slug inválido. Use apenas letras minúsculas, números e hifens (3–60 caracteres).';
  END IF;

  INSERT INTO barbershops (nome, slug, telefone)
  VALUES (p_nome, p_slug, COALESCE(p_telefone, ''))
  RETURNING id INTO new_id;

  INSERT INTO members (user_id, barbershop_id, role, ativo)
  VALUES (auth.uid(), new_id, 'owner', true);

  RETURN new_id;
END $$;
