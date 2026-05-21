-- =============================================================
-- Public Booking: re-enable anonymous access for /b/:slug page
-- Scoped to read-only on public data + a SECURITY DEFINER RPC
-- for the actual booking insert (no direct anon table writes).
-- =============================================================

-- 1. Barbershops: let anon read any barbershop (nome, slug, telefone, endereco are public)
DROP POLICY IF EXISTS "anon read barbershop for booking" ON barbershops;
CREATE POLICY "anon read barbershop for booking" ON barbershops
  FOR SELECT TO anon USING (true);

-- 2. Services: let anon read active services
DROP POLICY IF EXISTS "anon read services for booking" ON services;
CREATE POLICY "anon read services for booking" ON services
  FOR SELECT TO anon USING (ativo = true);

-- 3. Barbers: let anon read active barbers (nome only, no sensitive data)
DROP POLICY IF EXISTS "anon read barbers for booking" ON barbers;
CREATE POLICY "anon read barbers for booking" ON barbers
  FOR SELECT TO anon USING (ativo = true);

-- 4. Appointments: let anon check availability (data_hora + duracao only needed)
DROP POLICY IF EXISTS "anon read appointments for availability" ON appointments;
CREATE POLICY "anon read appointments for availability" ON appointments
  FOR SELECT TO anon
  USING (status NOT IN ('cancelado', 'no_show'));

-- 5. SECURITY DEFINER function — handles the full booking transaction
--    so anon never writes directly to any table.
CREATE OR REPLACE FUNCTION create_public_booking(
  p_barbershop_slug  text,
  p_service_id       uuid,
  p_barber_id        uuid,
  p_data_hora        timestamptz,
  p_client_nome      text,
  p_client_telefone  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_barbershop_id uuid;
  v_client_id     uuid;
  v_appt_id       uuid;
  v_duracao       int;
BEGIN
  -- Basic input validation
  IF length(trim(p_client_nome)) < 2 THEN
    RAISE EXCEPTION 'Nome muito curto';
  END IF;
  IF length(p_client_telefone) < 10 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  IF p_data_hora < now() THEN
    RAISE EXCEPTION 'Horário no passado';
  END IF;

  -- Resolve barbershop
  SELECT id INTO v_barbershop_id FROM barbershops WHERE slug = p_barbershop_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'Barbearia não encontrada'; END IF;

  -- Verify service belongs to this barbershop and is active
  SELECT duracao_min INTO v_duracao
    FROM services
   WHERE id = p_service_id AND barbershop_id = v_barbershop_id AND ativo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado'; END IF;

  -- Verify barber belongs to this barbershop and is active
  IF NOT EXISTS (
    SELECT 1 FROM barbers
     WHERE id = p_barber_id AND barbershop_id = v_barbershop_id AND ativo = true
  ) THEN RAISE EXCEPTION 'Barbeiro não encontrado'; END IF;

  -- Upsert client by phone (updates name if already exists)
  INSERT INTO clients (barbershop_id, nome, telefone)
  VALUES (v_barbershop_id, trim(p_client_nome), p_client_telefone)
  ON CONFLICT (barbershop_id, telefone)
    DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_client_id;

  -- Create appointment (conflict trigger will fire if slot is taken)
  INSERT INTO appointments
    (barbershop_id, client_id, barber_id, data_hora, duracao_min, status, origem)
  VALUES
    (v_barbershop_id, v_client_id, p_barber_id, p_data_hora, v_duracao, 'agendado', 'online')
  RETURNING id INTO v_appt_id;

  -- Link service to appointment
  INSERT INTO appointment_services (appointment_id, service_id)
  VALUES (v_appt_id, p_service_id);

  RETURN v_appt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_public_booking TO anon;
