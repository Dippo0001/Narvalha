-- =============================================================
-- FEATURE: Test account (demo barbershop for admins)
-- A barbershop flagged as is_demo=true belongs to an admin user
-- and is excluded from SaaS metrics (MRR, totals, etc.).
-- =============================================================

ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_barbershops_is_demo
  ON barbershops(is_demo) WHERE is_demo = true;

-- ---------------------------------------------------------------
-- RPC: enter_test_mode()
-- Creates a demo barbershop for the current admin if none exists,
-- and ensures the admin is an active 'owner' member of it.
-- Returns the barbershop id.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION enter_test_mode()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_saas_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem entrar no modo teste';
  END IF;

  -- Reuse existing demo shop if admin already has one
  SELECT b.id INTO v_shop_id
  FROM barbershops b
  JOIN members m ON m.barbershop_id = b.id
  WHERE m.user_id = v_uid AND m.ativo = true AND b.is_demo = true
  LIMIT 1;

  IF v_shop_id IS NOT NULL THEN
    RETURN v_shop_id;
  END IF;

  -- Create new demo shop (Platinum + active forever, marked is_demo)
  INSERT INTO barbershops (
    nome, slug, telefone, plan, subscription_status, paid_until, is_demo
  )
  VALUES (
    'Barbearia Teste',
    'teste-' || substr(replace(v_uid::text, '-', ''), 1, 8),
    '',
    'platinum',
    'active',
    now() + interval '100 years',
    true
  )
  RETURNING id INTO v_shop_id;

  INSERT INTO members (user_id, barbershop_id, role, ativo)
  VALUES (v_uid, v_shop_id, 'owner', true);

  RETURN v_shop_id;
END $$;

-- ---------------------------------------------------------------
-- RPC: reset_test_mode(p_shop_id)
-- Wipes all transactional data from a demo barbershop.
-- Keeps the barbershop, services, products, barbers (config).
-- Only deletes clients, appointments, orders, cash_movements.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_test_mode(p_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_saas_admin() THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM barbershops WHERE id = p_shop_id AND is_demo = true) THEN
    RAISE EXCEPTION 'Esta loja não é uma loja de teste';
  END IF;

  -- Delete in FK-safe order
  DELETE FROM order_items
    WHERE order_id IN (SELECT id FROM orders WHERE barbershop_id = p_shop_id);
  DELETE FROM orders          WHERE barbershop_id = p_shop_id;
  DELETE FROM cash_movements  WHERE barbershop_id = p_shop_id;
  DELETE FROM appointment_services
    WHERE appointment_id IN (SELECT id FROM appointments WHERE barbershop_id = p_shop_id);
  DELETE FROM appointments    WHERE barbershop_id = p_shop_id;
  DELETE FROM clients         WHERE barbershop_id = p_shop_id;
END $$;

-- ---------------------------------------------------------------
-- RPC: wipe_test_mode(p_shop_id)
-- Completely deletes the demo barbershop and all related data.
-- Use this if admin wants to start over from scratch.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION wipe_test_mode(p_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_saas_admin() THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM barbershops WHERE id = p_shop_id AND is_demo = true) THEN
    RAISE EXCEPTION 'Esta loja não é uma loja de teste';
  END IF;

  PERFORM reset_test_mode(p_shop_id);
  DELETE FROM products WHERE barbershop_id = p_shop_id;
  DELETE FROM services WHERE barbershop_id = p_shop_id;
  DELETE FROM working_hours
    WHERE barber_id IN (SELECT id FROM barbers WHERE barbershop_id = p_shop_id);
  DELETE FROM barbers  WHERE barbershop_id = p_shop_id;
  DELETE FROM members  WHERE barbershop_id = p_shop_id;
  DELETE FROM barbershops WHERE id = p_shop_id;
END $$;
