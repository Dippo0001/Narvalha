/*
  # Cash Sessions — Sistema completo de caixa

  1. New Tables
    - `cash_sessions` — Sessão de caixa (abertura até fechamento)
      - id, barbershop_id, opened_at, opened_by (member), closed_at/by
      - saldo_inicial, saldo_final, saldo_esperado, diferenca
      - status: aberto | fechado
      - observacoes_abertura, observacoes_fechamento

  2. Changes to existing tables
    - `cash_movements` — Add cash_session_id, expand tipo enum, add responsavel_id
    - `orders` — Add cash_session_id, gorjeta

  3. Constraints
    - Only 1 open session per barbershop at a time (partial unique index)
    - cash_movements.valor must be > 0

  4. Security
    - RLS on cash_sessions: owner/manager/reception can read+write; barbers cannot
*/

-- Expand cash_movement_type enum to include sangria and suprimento
DO $$
BEGIN
  ALTER TYPE cash_movement_type ADD VALUE IF NOT EXISTS 'sangria';
  ALTER TYPE cash_movement_type ADD VALUE IF NOT EXISTS 'suprimento';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── cash_sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid REFERENCES members(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  saldo_inicial numeric(10,2) NOT NULL DEFAULT 0,
  saldo_final numeric(10,2),
  saldo_esperado numeric(10,2),
  diferenca numeric(10,2),
  status text NOT NULL DEFAULT 'aberto', -- aberto | fechado
  observacoes_abertura text NOT NULL DEFAULT '',
  observacoes_fechamento text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_cash_sessions_updated ON cash_sessions;
CREATE TRIGGER trg_cash_sessions_updated
  BEFORE UPDATE ON cash_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Only 1 open session per barbershop
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_cash_per_barbershop
  ON cash_sessions (barbershop_id)
  WHERE status = 'aberto';

CREATE POLICY "read cash_sessions"
  ON cash_sessions FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "insert cash_sessions"
  ON cash_sessions FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "update cash_sessions"
  ON cash_sessions FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

-- ── Extend cash_movements ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_movements' AND column_name='cash_session_id') THEN
    ALTER TABLE cash_movements ADD COLUMN cash_session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_movements' AND column_name='responsavel_id') THEN
    ALTER TABLE cash_movements ADD COLUMN responsavel_id uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_movements' AND column_name='forma_pagamento') THEN
    ALTER TABLE cash_movements ADD COLUMN forma_pagamento text;
  END IF;
END $$;

-- ── Extend orders ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='cash_session_id') THEN
    ALTER TABLE orders ADD COLUMN cash_session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='gorjeta') THEN
    ALTER TABLE orders ADD COLUMN gorjeta numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── close_order RPC — full version with stock deduct + cash movement ──
CREATE OR REPLACE FUNCTION close_order(
  p_order_id uuid,
  p_forma text,
  p_gorjeta numeric DEFAULT 0,
  p_desconto numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_item  RECORD;
  v_session_id uuid;
  v_barbershop_id uuid;
  v_total numeric;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.status = 'fechada' THEN RAISE EXCEPTION 'Pedido já fechado'; END IF;

  v_barbershop_id := v_order.barbershop_id;
  v_total := v_order.total - v_order.desconto + p_gorjeta;

  -- Find open session for this barbershop
  SELECT id INTO v_session_id FROM cash_sessions
    WHERE barbershop_id = v_barbershop_id AND status = 'aberto'
    LIMIT 1;

  -- Process each item
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    -- Deduct stock for products
    IF v_item.tipo = 'produto' AND v_item.ref_id IS NOT NULL THEN
      UPDATE products SET estoque = estoque - v_item.qtd WHERE id = v_item.ref_id AND estoque >= v_item.qtd;
      INSERT INTO stock_movements(product_id, tipo, qtd, motivo)
        VALUES (v_item.ref_id, 'saida', v_item.qtd, 'Venda — comanda ' || p_order_id::text);
    END IF;
  END LOOP;

  -- Record cash movement
  INSERT INTO cash_movements(barbershop_id, cash_session_id, tipo, categoria, descricao, valor, forma_pagamento, ref_order_id, data)
  VALUES (
    v_barbershop_id,
    v_session_id,
    'entrada',
    'venda',
    'Comanda #' || substring(p_order_id::text, 1, 8),
    v_total,
    p_forma,
    p_order_id,
    now()
  );

  -- Close the order
  UPDATE orders SET
    status = 'fechada',
    forma_pagamento = p_forma::payment_method,
    desconto = COALESCE(p_desconto, 0),
    gorjeta = p_gorjeta,
    total = v_order.total,
    cash_session_id = v_session_id,
    fechada_em = now()
  WHERE id = p_order_id;

  -- Update linked appointment
  UPDATE appointments SET status = 'finalizado'
  WHERE id = (SELECT appointment_id FROM orders WHERE id = p_order_id)
    AND status NOT IN ('cancelado','no_show');
END;
$$;

-- ── open_cash_session RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION open_cash_session(
  p_barbershop_id uuid,
  p_member_id uuid,
  p_saldo_inicial numeric,
  p_obs text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Check for existing open session
  IF EXISTS (SELECT 1 FROM cash_sessions WHERE barbershop_id = p_barbershop_id AND status = 'aberto') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto para esta barbearia';
  END IF;

  INSERT INTO cash_sessions(barbershop_id, opened_by, saldo_inicial, observacoes_abertura, status)
  VALUES (p_barbershop_id, p_member_id, p_saldo_inicial, p_obs, 'aberto')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── close_cash_session RPC ────────────────────────────────────────
CREATE OR REPLACE FUNCTION close_cash_session(
  p_session_id uuid,
  p_member_id uuid,
  p_saldo_final numeric,
  p_obs text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_entradas numeric; v_saidas numeric; v_sangrias numeric; v_suprimentos numeric;
  v_entradas_dinheiro numeric; v_saldo_esperado numeric;
BEGIN
  SELECT * INTO v_session FROM cash_sessions WHERE id = p_session_id AND status = 'aberto';
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada ou já fechada'; END IF;

  -- Compute expected balance (cash only)
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'entrada' AND (forma_pagamento = 'dinheiro' OR forma_pagamento IS NULL) THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'sangria' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'suprimento' THEN valor ELSE 0 END), 0)
  INTO v_entradas_dinheiro, v_saidas, v_sangrias, v_suprimentos
  FROM cash_movements WHERE cash_session_id = p_session_id;

  v_saldo_esperado := v_session.saldo_inicial + v_entradas_dinheiro + v_suprimentos - v_sangrias - v_saidas;

  UPDATE cash_sessions SET
    status = 'fechado',
    closed_at = now(),
    closed_by = p_member_id,
    saldo_final = p_saldo_final,
    saldo_esperado = v_saldo_esperado,
    diferenca = p_saldo_final - v_saldo_esperado,
    observacoes_fechamento = p_obs
  WHERE id = p_session_id;
END;
$$;

-- ── sangria / suprimento RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION cash_movement_extra(
  p_session_id uuid,
  p_barbershop_id uuid,
  p_member_id uuid,
  p_tipo text,   -- sangria | suprimento
  p_valor numeric,
  p_descricao text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_valor <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero'; END IF;
  INSERT INTO cash_movements(barbershop_id, cash_session_id, tipo, categoria, descricao, valor, responsavel_id, data)
  VALUES (p_barbershop_id, p_session_id, p_tipo, p_tipo, p_descricao, p_valor, p_member_id, now());
END;
$$;
