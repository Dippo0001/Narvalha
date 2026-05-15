-- Migration to add "Caixa às Cegas" configuration
-- Allows hiding expected values during cashier closure for a blind count

ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS caixa_as_cegas boolean DEFAULT false;
