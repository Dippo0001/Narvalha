/*
  # Typed Promotions Schema

  Replaces the generic promotions table with a rich typed structure.

  1. Changes
    - Adds `tipo` column (enum) to identify the promotion category
    - Adds columns specific to each promotion type:
      - cashback_percentual, cashback_validade_dias
      - primeiro_corte_desconto
      - aniversario_janela (dia | semana | mes), aniversario_desconto
      - fidelidade_cortes, fidelidade_gratuito (flag)
      - happy_hour_dias (int[]), happy_hour_inicio, happy_hour_fim, happy_hour_desconto
      - combo_servicos (uuid[]), combo_valor_fixo
      - retorno_dias, retorno_desconto
      - pacote_cortes, pacote_preco
      - assinatura_cortes_mes, assinatura_preco, assinatura_desconto_produtos
      - produto_ids (uuid[]), produto_desconto (for Produto+Serviço)
  2. Security
    - Existing RLS policies remain (already applied)
*/

DO $$
BEGIN
  -- tipo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='tipo') THEN
    ALTER TABLE promotions ADD COLUMN tipo text NOT NULL DEFAULT 'generico';
  END IF;

  -- cashback
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='cashback_percentual') THEN
    ALTER TABLE promotions ADD COLUMN cashback_percentual numeric(5,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='cashback_validade_dias') THEN
    ALTER TABLE promotions ADD COLUMN cashback_validade_dias int DEFAULT 30;
  END IF;

  -- primeiro corte
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='primeiro_corte_desconto') THEN
    ALTER TABLE promotions ADD COLUMN primeiro_corte_desconto numeric(5,2) DEFAULT 0;
  END IF;

  -- aniversário
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='aniversario_janela') THEN
    ALTER TABLE promotions ADD COLUMN aniversario_janela text DEFAULT 'dia'; -- dia | semana | mes
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='aniversario_desconto') THEN
    ALTER TABLE promotions ADD COLUMN aniversario_desconto numeric(5,2) DEFAULT 0;
  END IF;

  -- fidelidade (corte X vezes, próximo grátis)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='fidelidade_cortes') THEN
    ALTER TABLE promotions ADD COLUMN fidelidade_cortes int DEFAULT 10;
  END IF;

  -- happy hour
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='happy_hour_dias') THEN
    ALTER TABLE promotions ADD COLUMN happy_hour_dias int[] DEFAULT '{}'; -- 0=dom..6=sab
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='happy_hour_inicio') THEN
    ALTER TABLE promotions ADD COLUMN happy_hour_inicio time DEFAULT '10:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='happy_hour_fim') THEN
    ALTER TABLE promotions ADD COLUMN happy_hour_fim time DEFAULT '14:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='happy_hour_desconto') THEN
    ALTER TABLE promotions ADD COLUMN happy_hour_desconto numeric(5,2) DEFAULT 20;
  END IF;

  -- combo serviços
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='combo_servico_ids') THEN
    ALTER TABLE promotions ADD COLUMN combo_servico_ids uuid[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='combo_valor_fixo') THEN
    ALTER TABLE promotions ADD COLUMN combo_valor_fixo numeric(10,2) DEFAULT 0;
  END IF;

  -- retorno com desconto
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='retorno_dias') THEN
    ALTER TABLE promotions ADD COLUMN retorno_dias int DEFAULT 21;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='retorno_desconto') THEN
    ALTER TABLE promotions ADD COLUMN retorno_desconto numeric(5,2) DEFAULT 15;
  END IF;

  -- pacote pré-pago
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='pacote_cortes') THEN
    ALTER TABLE promotions ADD COLUMN pacote_cortes int DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='pacote_preco') THEN
    ALTER TABLE promotions ADD COLUMN pacote_preco numeric(10,2) DEFAULT 0;
  END IF;

  -- assinatura mensal
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='assinatura_cortes_mes') THEN
    ALTER TABLE promotions ADD COLUMN assinatura_cortes_mes int DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='assinatura_preco') THEN
    ALTER TABLE promotions ADD COLUMN assinatura_preco numeric(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='assinatura_desconto_produtos') THEN
    ALTER TABLE promotions ADD COLUMN assinatura_desconto_produtos numeric(5,2) DEFAULT 10;
  END IF;

  -- produto + serviço
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='produto_ids') THEN
    ALTER TABLE promotions ADD COLUMN produto_ids uuid[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='produto_desconto') THEN
    ALTER TABLE promotions ADD COLUMN produto_desconto numeric(5,2) DEFAULT 20;
  END IF;

  -- primeiro horário do dia
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='primeiro_horario_desconto') THEN
    ALTER TABLE promotions ADD COLUMN primeiro_horario_desconto numeric(5,2) DEFAULT 15;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='primeiro_horario_slot') THEN
    ALTER TABLE promotions ADD COLUMN primeiro_horario_slot time DEFAULT '08:00';
  END IF;

  -- dia fixo (ex: Terça do Corte Social)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='dia_fixo_dia_semana') THEN
    ALTER TABLE promotions ADD COLUMN dia_fixo_dia_semana int DEFAULT 2; -- 0=dom,2=ter
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promotions' AND column_name='dia_fixo_valor') THEN
    ALTER TABLE promotions ADD COLUMN dia_fixo_valor numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Fidelidade progress tracker per client
CREATE TABLE IF NOT EXISTS client_fidelidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  cortes_acumulados int NOT NULL DEFAULT 0,
  resgatado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, client_id)
);
ALTER TABLE client_fidelidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read client_fidelidade"
  ON client_fidelidade FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "insert client_fidelidade"
  ON client_fidelidade FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "update client_fidelidade"
  ON client_fidelidade FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "delete client_fidelidade"
  ON client_fidelidade FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

-- Cashback balance per client
CREATE TABLE IF NOT EXISTS client_cashback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  saldo numeric(10,2) NOT NULL DEFAULT 0,
  validade date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, client_id)
);
ALTER TABLE client_cashback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read client_cashback"
  ON client_cashback FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "insert client_cashback"
  ON client_cashback FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "update client_cashback"
  ON client_cashback FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));

CREATE POLICY "delete client_cashback"
  ON client_cashback FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
