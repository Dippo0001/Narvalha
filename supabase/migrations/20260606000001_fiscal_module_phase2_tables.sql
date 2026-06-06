-- Migration: Fiscal Module Phase 2
-- Creates the table to track fiscal notes (NF-e, NFC-e, NFS-e)

CREATE TYPE fiscal_note_type AS ENUM ('nfe', 'nfce', 'nfse');
CREATE TYPE fiscal_note_status AS ENUM ('pending', 'processing', 'authorized', 'rejected', 'denied', 'cancelled', 'error');

CREATE TABLE IF NOT EXISTS fiscal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  
  tipo fiscal_note_type NOT NULL,
  status fiscal_note_status DEFAULT 'pending',
  
  -- Document Info
  numero int,
  serie int,
  chave_acesso text,
  protocolo text,
  
  -- Files and Links
  xml_url text,
  pdf_url text,
  
  -- Error Tracking
  error_message text,
  error_code text,
  
  -- External Provider ID (e.g., Focus NFe reference)
  provider_id text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE fiscal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their barbershop fiscal notes" ON fiscal_notes
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_fiscal_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fiscal_notes_updated_at
  BEFORE UPDATE ON fiscal_notes
  FOR EACH ROW EXECUTE FUNCTION update_fiscal_notes_updated_at();
