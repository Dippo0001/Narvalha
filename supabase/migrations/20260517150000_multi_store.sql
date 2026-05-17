-- =============================================================
-- FEATURE: Multi-store (loja matriz + filiais)
-- Rule: user's matrix store must be Platinum to create branches
-- Each branch is linked to the matrix via parent_barbershop_id
-- =============================================================

-- 1. Add parent reference column
ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS parent_barbershop_id uuid REFERENCES barbershops(id) ON DELETE SET NULL;

-- 2. Drop the 1-per-user limit policy (allow multi-store now)
DROP POLICY IF EXISTS "authenticated can create one barbershop" ON barbershops;

-- 3. New policy: create first store freely, or create filial if matrix is Platinum
CREATE POLICY "authenticated can create barbershop"
  ON barbershops FOR INSERT TO authenticated
  WITH CHECK (
    -- First store (no existing membership) — always allowed
    NOT EXISTS (
      SELECT 1 FROM members WHERE user_id = auth.uid() AND ativo = true
    )
    OR
    -- Additional store (filial) — only if user's matrix store is Platinum
    EXISTS (
      SELECT 1 FROM members m
      JOIN barbershops b ON b.id = m.barbershop_id
      WHERE m.user_id = auth.uid()
        AND m.ativo = true
        AND b.plan = 'platinum'
        AND b.parent_barbershop_id IS NULL
    )
  );

-- 4. Updated create_barbershop RPC with multi-store logic
CREATE OR REPLACE FUNCTION create_barbershop(p_nome text, p_slug text, p_telefone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id    uuid;
  v_parent  uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a matrix store (this would be a filial creation)
  SELECT b.id INTO v_parent
  FROM members m
  JOIN barbershops b ON b.id = m.barbershop_id
  WHERE m.user_id = auth.uid()
    AND m.ativo = true
    AND b.parent_barbershop_id IS NULL
  LIMIT 1;

  IF v_parent IS NOT NULL THEN
    -- Filial creation — matrix must be Platinum
    IF NOT EXISTS (
      SELECT 1 FROM barbershops WHERE id = v_parent AND plan = 'platinum'
    ) THEN
      RAISE EXCEPTION 'Sua loja matriz precisa ser Platina para adicionar filiais';
    END IF;
  END IF;

  -- Validate slug format
  IF p_slug !~ '^[a-z0-9\-]{3,60}$' THEN
    RAISE EXCEPTION 'Slug inválido. Use apenas letras minúsculas, números e hifens (3–60 caracteres).';
  END IF;

  INSERT INTO barbershops (nome, slug, telefone, parent_barbershop_id)
  VALUES (p_nome, p_slug, COALESCE(p_telefone, ''), v_parent)
  RETURNING id INTO new_id;

  INSERT INTO members (user_id, barbershop_id, role, ativo)
  VALUES (auth.uid(), new_id, 'owner', true);

  RETURN new_id;
END $$;
