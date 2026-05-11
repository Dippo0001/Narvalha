/*
  # Products — add foto_url column

  Adds an optional photo URL to products for display in the product catalog.
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'foto_url'
  ) THEN
    ALTER TABLE products ADD COLUMN foto_url text DEFAULT '';
  END IF;
END $$;
