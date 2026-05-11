/*
  # Contas a Pagar, Contas a Receber e Formas de Pagamento

  1. New Tables
    - `contas_pagar` — despesas com vencimento e status de pagamento
    - `contas_receber` — receitas esperadas com vencimento e status de recebimento
    - `payment_methods` — formas de pagamento configuráveis por barbearia
      (além das fixas: dinheiro, pix, débito, crédito)

  2. Other changes
    - Function `product_pdv_sale` — vende produto direto do PDV de produtos:
      registra saída de estoque, cria cash_movement de entrada e retorna o novo saldo

  3. Security
    - RLS enabled on all new tables, restricted to barbershop members
*/

-- ── contas a pagar ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'outros',
  valor numeric(10,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  pago_em date,
  status text NOT NULL DEFAULT 'pendente', -- pendente | pago | vencido | cancelado
  recorrente boolean NOT NULL DEFAULT false,
  recorrencia text, -- mensal | semanal | anual
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read contas_pagar"
  ON contas_pagar FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert contas_pagar"
  ON contas_pagar FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update contas_pagar"
  ON contas_pagar FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "delete contas_pagar"
  ON contas_pagar FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

-- ── contas a receber ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'servico',
  valor numeric(10,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  recebido_em date,
  status text NOT NULL DEFAULT 'pendente', -- pendente | recebido | vencido | cancelado
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read contas_receber"
  ON contas_receber FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert contas_receber"
  ON contas_receber FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update contas_receber"
  ON contas_receber FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "delete contas_receber"
  ON contas_receber FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

-- ── formas de pagamento ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'outro', -- dinheiro | pix | debito | credito | outro
  taxa_percentual numeric(5,2) NOT NULL DEFAULT 0, -- taxa cobrada pela adquirente
  prazo_liquidacao_dias int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read payment_methods"
  ON payment_methods FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert payment_methods"
  ON payment_methods FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update payment_methods"
  ON payment_methods FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "delete payment_methods"
  ON payment_methods FOR DELETE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));

-- ── PDV de produtos: venda avulsa ─────────────────────────────────
-- Sells a product directly (not via appointment), decrements stock,
-- creates a cash_movement entry, and returns the new stock level.
CREATE OR REPLACE FUNCTION product_pdv_sale(
  p_barbershop_id uuid,
  p_product_id uuid,
  p_qtd int,
  p_forma text,
  p_desconto numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_preco     numeric;
  v_estoque   int;
  v_total     numeric;
  v_novo_estoque int;
BEGIN
  SELECT preco, estoque INTO v_preco, v_estoque
  FROM products
  WHERE id = p_product_id AND barbershop_id = p_barbershop_id;

  IF v_estoque IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF v_estoque < p_qtd THEN
    RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', v_estoque;
  END IF;

  v_total := (v_preco * p_qtd) - p_desconto;
  v_novo_estoque := v_estoque - p_qtd;

  -- deduct stock
  UPDATE products SET estoque = v_novo_estoque WHERE id = p_product_id;

  -- record stock movement
  INSERT INTO stock_movements(product_id, tipo, qtd, motivo)
  VALUES (p_product_id, 'saida', p_qtd, 'Venda PDV');

  -- record cash movement
  INSERT INTO cash_movements(barbershop_id, tipo, categoria, descricao, valor, data)
  SELECT p_barbershop_id, 'entrada', 'venda_produto',
         concat('Venda PDV — ', nome, ' x', p_qtd),
         v_total, now()
  FROM products WHERE id = p_product_id;

  RETURN v_novo_estoque;
END;
$$;
