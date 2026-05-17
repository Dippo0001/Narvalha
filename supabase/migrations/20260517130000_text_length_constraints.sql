-- =============================================================
-- MEDIUM SECURITY FIX: Add length constraints to text fields
-- Without limits, an attacker could insert huge strings to
-- inflate database size and degrade performance.
-- =============================================================

ALTER TABLE barbershops
  ADD CONSTRAINT chk_barbershop_nome    CHECK (length(nome)     <= 100),
  ADD CONSTRAINT chk_barbershop_slug    CHECK (length(slug)     <= 60),
  ADD CONSTRAINT chk_barbershop_tel     CHECK (length(telefone) <= 20),
  ADD CONSTRAINT chk_barbershop_end     CHECK (length(endereco) <= 300),
  ADD CONSTRAINT chk_barbershop_tz      CHECK (length(timezone) <= 60);

ALTER TABLE clients
  ADD CONSTRAINT chk_client_nome        CHECK (length(nome)          <= 100),
  ADD CONSTRAINT chk_client_telefone    CHECK (length(telefone)      <= 20),
  ADD CONSTRAINT chk_client_email       CHECK (length(email)         <= 200),
  ADD CONSTRAINT chk_client_obs         CHECK (length(observacoes)   <= 1000);

ALTER TABLE barbers
  ADD CONSTRAINT chk_barber_nome        CHECK (length(nome_exibicao) <= 100);

ALTER TABLE services
  ADD CONSTRAINT chk_service_nome       CHECK (length(nome)          <= 100);

ALTER TABLE products
  ADD CONSTRAINT chk_product_nome       CHECK (length(nome)          <= 100),
  ADD CONSTRAINT chk_product_sku        CHECK (length(sku)           <= 50);

ALTER TABLE orders
  ADD CONSTRAINT chk_order_desconto     CHECK (desconto >= 0),
  ADD CONSTRAINT chk_order_total        CHECK (total >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT chk_item_descricao     CHECK (length(descricao)     <= 200),
  ADD CONSTRAINT chk_item_qtd           CHECK (qtd > 0),
  ADD CONSTRAINT chk_item_valor_unit    CHECK (valor_unit >= 0);

ALTER TABLE cash_movements
  ADD CONSTRAINT chk_cash_descricao     CHECK (length(descricao)     <= 300),
  ADD CONSTRAINT chk_cash_valor         CHECK (valor > 0);
