-- Migration to add Business Rules and Barber Payments
-- Adds commission rules to barbershops and a table to track payments to barbers

-- 1. Add Business Rules columns to barbershops
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS comissao_frequencia text DEFAULT 'semanal';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS comissao_dia_pagamento text DEFAULT '6'; -- 0=Sunday, 6=Saturday, or '10' for day 10

-- 2. Create Barber Payments table
CREATE TABLE IF NOT EXISTS barber_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  metodo text NOT NULL DEFAULT 'dinheiro', -- dinheiro, pix, etc
  comprovante_url text,
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE barber_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read barber_payments"
  ON barber_payments FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "manage barber_payments"
  ON barber_payments FOR INSERT TO authenticated
  WITH CHECK (user_role_in(barbershop_id) IN ('owner', 'manager'));

CREATE POLICY "update barber_payments"
  ON barber_payments FOR UPDATE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner', 'manager'))
  WITH CHECK (user_role_in(barbershop_id) IN ('owner', 'manager'));

CREATE POLICY "delete barber_payments"
  ON barber_payments FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner', 'manager'));

-- 3. Ensure caixa_as_cegas exists (in case previous migration failed or was partial)
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS caixa_as_cegas boolean DEFAULT false;
