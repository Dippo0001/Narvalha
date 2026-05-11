/*
  # Fix cash_movement_extra RPC — enum casting

  The RPC was passing text directly to cash_movement_type enum.
  Now properly casts to cash_movement_type.
*/

DROP FUNCTION IF EXISTS cash_movement_extra(uuid, uuid, uuid, text, numeric, text);

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
  VALUES (
    p_barbershop_id,
    p_session_id,
    p_tipo::cash_movement_type,
    p_tipo,
    p_descricao,
    p_valor,
    p_member_id,
    now()
  );
END;
$$;
