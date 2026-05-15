-- Loyalty System Migration
-- Adds fields for loyalty counter and updates close_order RPC

-- 1. Ensure Client fields from code exist in DB (just in case they were added manually)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='ultima_visita') THEN
    ALTER TABLE clients ADD COLUMN ultima_visita timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lembrete_dias') THEN
    ALTER TABLE clients ADD COLUMN lembrete_dias int DEFAULT 30;
  END IF;
END $$;

-- 2. Loyalty fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fidelidade_contagem int DEFAULT 0;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS fidelidade_meta int DEFAULT 10;

-- 3. Updated close_order RPC with Loyalty Logic
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
  v_has_service boolean;
  v_meta int;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.status = 'fechada' THEN RAISE EXCEPTION 'Pedido já fechado'; END IF;

  v_barbershop_id := v_order.barbershop_id;
  v_total := v_order.total - COALESCE(p_desconto, 0) + COALESCE(p_gorjeta, 0);

  -- Find open session for this barbershop
  SELECT id INTO v_session_id FROM cash_sessions
    WHERE barbershop_id = v_barbershop_id AND status = 'aberto'
    LIMIT 1;

  -- Process each item (Stock + Comission logic remains in app or can be moved here)
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    -- Deduct stock for products
    IF v_item.tipo = 'produto' AND v_item.ref_id IS NOT NULL THEN
      UPDATE products SET estoque = estoque - v_item.qtd WHERE id = v_item.ref_id AND estoque >= v_item.qtd;
      INSERT INTO stock_movements(product_id, tipo, qtd, motivo, ref_order_id)
        VALUES (v_item.ref_id, 'saida', v_item.qtd, 'Venda — comanda ' || p_order_id::text, p_order_id);
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
    gorjeta = COALESCE(p_gorjeta, 0),
    cash_session_id = v_session_id,
    fechada_em = now()
  WHERE id = p_order_id;

  -- Update linked appointment
  IF v_order.appointment_id IS NOT NULL THEN
    UPDATE appointments SET status = 'finalizado'
    WHERE id = v_order.appointment_id
      AND status NOT IN ('cancelado','no_show');
  END IF;

  -- 4. Loyalty & Visit Logic
  SELECT EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id AND tipo = 'servico') INTO v_has_service;
  
  IF v_has_service AND v_order.client_id IS NOT NULL THEN
    SELECT COALESCE(fidelidade_meta, 10) INTO v_meta FROM barbershops WHERE id = v_barbershop_id;
    
    UPDATE clients 
    SET 
      fidelidade_contagem = CASE 
        WHEN fidelidade_contagem >= (v_meta - 1) THEN 0 
        ELSE fidelidade_contagem + 1 
      END,
      ultima_visita = now()
    WHERE id = v_order.client_id;
  END IF;
END;
$$;
