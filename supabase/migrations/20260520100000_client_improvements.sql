-- =============================================================
-- MELHORIAS DO CLIENTE — 2026-05-20
-- 1. Fix caixa_as_cegas + outros campos barbershop
-- 2. Tabela card_brands (taxas por bandeira)
-- 3. bandeira em orders
-- 4. login/pin em barbers (nível de acesso)
-- =============================================================

-- 1. Garantir colunas do barbershop que podem estar faltando
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS caixa_as_cegas boolean NOT NULL DEFAULT false;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS comissao_frequencia text NOT NULL DEFAULT 'semanal';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS comissao_dia_pagamento text NOT NULL DEFAULT '6';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS num_cadeiras integer NOT NULL DEFAULT 1;

-- 2. Tabela de taxas por bandeira de cartão
CREATE TABLE IF NOT EXISTS card_brands (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid      NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  nome        text        NOT NULL,
  percentual  numeric(5,2) NOT NULL DEFAULT 0,
  ativo       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE card_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_brands_rw" ON card_brands;
CREATE POLICY "card_brands_rw" ON card_brands
  USING  (barbershop_id = ANY(user_barbershops()))
  WITH CHECK (barbershop_id = ANY(user_barbershops()));

-- 3. Bandeira na order (qual bandeira foi usada no cartão)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bandeira text;

-- 4. Login/PIN do barbeiro para nível de acesso
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS barber_login text;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS barber_pin   text;
