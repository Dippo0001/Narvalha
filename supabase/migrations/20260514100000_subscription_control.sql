/*
  # Subscription Access Control

  1. Changes
    - Add subscription columns to `barbershops`
    - Create `plan_type` enum
    - Create `subscription_status` enum
  2. Logic
    - Barbershops are created with a 'trial' status by default
*/

-- Enums
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('trial', 'silver', 'gold', 'platinum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to barbershops
ALTER TABLE barbershops
ADD COLUMN IF NOT EXISTS plan subscription_plan NOT NULL DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_status subscription_status NOT NULL DEFAULT 'trialing',
ADD COLUMN IF NOT EXISTS subscription_id text, -- link to Stripe/MercadoPago
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS paid_until timestamptz;

-- Helper to check if barbershop is active
CREATE OR REPLACE FUNCTION is_barbershop_active(bshop_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM barbershops
    WHERE id = bshop_id
      AND (
        subscription_status = 'active'
        OR (subscription_status = 'trialing' AND trial_ends_at > now())
        OR (paid_until > now())
      )
  );
$$;

-- Update RLS policies to check for active subscription
-- We only want to block WRITE operations if not active, or block SELECT if strict.
-- "Bloquear acesso total" usually means SELECT too.

-- For simplicity, let's update user_barbershops to only return active ones if we want strict blocking
-- OR we can modify each policy.

-- Re-defining user_barbershops to respect subscription status for non-owners maybe?
-- Actually, the user wants "total block".

CREATE OR REPLACE FUNCTION user_active_barbershops() RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT b.id FROM barbershops b
  JOIN members m ON m.barbershop_id = b.id
  WHERE m.user_id = auth.uid()
    AND m.ativo = true
    AND (
      b.subscription_status = 'active'
      OR (b.subscription_status = 'trialing' AND b.trial_ends_at > now())
      OR (b.paid_until > now())
      OR (m.role = 'owner') -- Owners can always see, maybe to pay?
    );
$$;

-- Helper to check if user is a superadmin
CREATE OR REPLACE FUNCTION is_superadmin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth.jwt() ->> 'email' IN ('diarley@gmail.com', 'admin@narvalha.com.br');
$$;

-- Update RLS policies for barbershops
CREATE POLICY "superadmins read all barbershops" ON barbershops FOR SELECT TO authenticated
  USING (is_superadmin());
CREATE POLICY "superadmins update all barbershops" ON barbershops FOR UPDATE TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Update RLS policies for members (to see who owns which shop)
CREATE POLICY "superadmins read all members" ON members FOR SELECT TO authenticated
  USING (is_superadmin());
