-- Add tipo column to card_brands for per-type rates (debito, credito à vista, parcelado 2-6x, parcelado 7-12x)
ALTER TABLE card_brands
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'debito'
  CHECK (tipo IN ('debito', 'credito_avista', 'parcelado_2_6', 'parcelado_7_12'));
