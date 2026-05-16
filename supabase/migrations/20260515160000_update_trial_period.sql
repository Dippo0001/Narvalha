-- Update trial period from 7 to 14 days
-- Affects new barbershops created after this migration

ALTER TABLE barbershops 
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '14 days');

-- Explicitly update the creation function just to be 100% sure
CREATE OR REPLACE FUNCTION create_barbershop(p_nome text, p_slug text, p_telefone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO barbershops (nome, slug, telefone, trial_ends_at) 
  VALUES (p_nome, p_slug, COALESCE(p_telefone,''), now() + interval '14 days') 
  RETURNING id INTO new_id;
  
  INSERT INTO members (user_id, barbershop_id, role, ativo) 
  VALUES (auth.uid(), new_id, 'owner', true);
  
  RETURN new_id;
END $$;
