-- Migration to update payment methods with PIX details and default flag
-- Allows customizing default methods and storing PIX keys/QR codes

-- 1. Add new columns to payment_methods
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS qr_code_url text;

-- 2. Ensure default methods exist for all barbershops
-- This is a one-time migration to seed existing barbershops with default methods
-- (In a real production environment, this might be handled by an onboarding hook or trigger)

INSERT INTO payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'Dinheiro', 'dinheiro', true, true FROM barbershops
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'PIX', 'pix', true, true FROM barbershops
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'Cartão de Débito', 'debito', true, true FROM barbershops
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'Cartão de Crédito', 'credito', true, true FROM barbershops
ON CONFLICT DO NOTHING;
