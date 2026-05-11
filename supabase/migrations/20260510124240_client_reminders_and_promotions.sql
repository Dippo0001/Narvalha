/*
  # Client Reminders & Promotions

  1. New Tables
    - `client_reminders`
      - Per-client reminder rules: "notify after X days since last visit via WhatsApp/SMS/email with custom message"
    - `promotions`
      - Barbershop-wide promotions with a title, description, discount, validity, and target audience filter

  2. Security
    - RLS enabled on both tables, members of the barbershop can manage their own records
*/

-- Client reminders
CREATE TABLE IF NOT EXISTS client_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE, -- NULL = applies to all clients
  titulo text NOT NULL DEFAULT '',
  mensagem text NOT NULL DEFAULT '',
  dias_sem_visita int NOT NULL DEFAULT 30,  -- trigger after N days without a visit
  canal text NOT NULL DEFAULT 'whatsapp',   -- whatsapp | sms | email
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE client_reminders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_reminders_updated ON client_reminders;
CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON client_reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read client_reminders"
  ON client_reminders FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "insert client_reminders"
  ON client_reminders FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "update client_reminders"
  ON client_reminders FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "delete client_reminders"
  ON client_reminders FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

-- Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  desconto_percentual numeric(5,2) NOT NULL DEFAULT 0,
  desconto_valor numeric(10,2) NOT NULL DEFAULT 0,
  validade_inicio date,
  validade_fim date,
  canal text NOT NULL DEFAULT 'whatsapp',
  mensagem_personalizada text NOT NULL DEFAULT '',
  filtro_dias_sem_visita int,           -- send to clients inactive for N+ days
  filtro_tags text[] DEFAULT '{}',      -- send only to clients with these tags
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_promotions_updated ON promotions;
CREATE TRIGGER trg_promotions_updated BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read promotions"
  ON promotions FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "insert promotions"
  ON promotions FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "update promotions"
  ON promotions FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "delete promotions"
  ON promotions FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
