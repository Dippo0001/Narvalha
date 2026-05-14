/*
  # LGPD Compliance Migration

  1. Changes
    - Add `consent_at` and `terms_accepted` to `barbershops` (for the owner)
    - Add `consent_at` and `marketing_consent` to `clients` (for the final customer)
    - Create `data_logs` for transparency
*/

-- Add consent info to barbershops
ALTER TABLE barbershops
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_policy_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lgpd_consent_at timestamptz;

-- Add consent info to clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lgpd_consent_at timestamptz;

-- Transparency log (for audit trails of sensitive actions)
CREATE TABLE IF NOT EXISTS data_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE,
  user_id uuid, -- Auth user
  action text NOT NULL, -- 'delete_client', 'export_data', etc
  entity_type text, -- 'client', 'financial'
  entity_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "only owners see data_logs" ON data_logs
  FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_active_barbershops()));

-- Function to log data actions
CREATE OR REPLACE FUNCTION log_data_action(
  p_bshop_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO data_logs (barbershop_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_bshop_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_details);
END;
$$;
