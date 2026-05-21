-- Replace grouped installment types with individual per-installment rates
-- Old: debito | credito_avista | parcelado_2_6 | parcelado_7_12
-- New: debito | credito_1x | credito_2x | credito_3x | credito_4x | credito_5x

ALTER TABLE card_brands DROP CONSTRAINT IF EXISTS card_brands_tipo_check;

-- Migrate credito_avista → credito_1x
UPDATE card_brands SET tipo = 'credito_1x' WHERE tipo = 'credito_avista';

-- Remove old grouped installment rows (don't map to individual slots)
DELETE FROM card_brands WHERE tipo IN ('parcelado_2_6', 'parcelado_7_12');

-- Add new constraint
ALTER TABLE card_brands ADD CONSTRAINT card_brands_tipo_check
  CHECK (tipo IN ('debito', 'credito_1x', 'credito_2x', 'credito_3x', 'credito_4x', 'credito_5x'));

-- Ensure percentual supports 2 decimal places (already numeric(5,2) but be safe)
ALTER TABLE card_brands ALTER COLUMN percentual TYPE numeric(5,2);
