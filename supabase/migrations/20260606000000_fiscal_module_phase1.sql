-- Migration: Fiscal Module Phase 1
-- Adds tax and fiscal fields to barbershops, clients, products, and services.

-- Barbershops extension
ALTER TABLE barbershops 
ADD COLUMN IF NOT EXISTS fiscal_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS inscricao_estadual text,
ADD COLUMN IF NOT EXISTS inscricao_municipal text,
ADD COLUMN IF NOT EXISTS cnae text,
ADD COLUMN IF NOT EXISTS crt int DEFAULT 1, -- 1: Simples Nacional, 2: Simples Nacional - excesso, 3: Regime Normal
ADD COLUMN IF NOT EXISTS ibge_code text;

-- Clients extension
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS cpf_cnpj text,
ADD COLUMN IF NOT EXISTS tipo_pessoa text DEFAULT 'PF', -- PF or PJ
ADD COLUMN IF NOT EXISTS logradouro text,
ADD COLUMN IF NOT EXISTS numero text,
ADD COLUMN IF NOT EXISTS complemento text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS cidade text,
ADD COLUMN IF NOT EXISTS uf text,
ADD COLUMN IF NOT EXISTS ibge_code text;

-- Products extension
ALTER TABLE products
ADD COLUMN IF NOT EXISTS ncm text,
ADD COLUMN IF NOT EXISTS cest text,
ADD COLUMN IF NOT EXISTS origem int DEFAULT 0, -- 0: Nacional, 1: Importada...
ADD COLUMN IF NOT EXISTS cfop text DEFAULT '5102', -- Venda de mercadoria adquirida ou recebida de terceiros
ADD COLUMN IF NOT EXISTS csosn text DEFAULT '102', -- Tributada pelo Simples Nacional sem permissão de crédito
ADD COLUMN IF NOT EXISTS icms_aliquota numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_aliquota numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_aliquota numeric(5,2) DEFAULT 0;

-- Services extension
ALTER TABLE services
ADD COLUMN IF NOT EXISTS lc116_code text DEFAULT '04.01', -- Barbearia, cabeleireiros, manicuros, pedicuros e congêneres
ADD COLUMN IF NOT EXISTS codigo_tributacao_municipio text,
ADD COLUMN IF NOT EXISTS iss_aliquota numeric(5,2) DEFAULT 0;
