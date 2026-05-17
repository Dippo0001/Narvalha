-- ==========================================================
-- NARVALHA - SCRIPT DE ATUALIZAÇÃO DE BANCO (SQL EDITOR)
-- Este script corrige os erros 400 e 404 no Financeiro
-- ==========================================================

-- 1. CRIAR TABELA DE PAGAMENTOS DE BARBEIROS (Resolve Erro 404)
CREATE TABLE IF NOT EXISTS public.barber_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  metodo text NOT NULL DEFAULT 'dinheiro',
  comprovante_url text,
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar Segurança (RLS)
ALTER TABLE public.barber_payments ENABLE ROW LEVEL SECURITY;

-- Política de Segurança Básica
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'manage_barber_payments' AND tablename = 'barber_payments') THEN
        CREATE POLICY "manage_barber_payments" ON public.barber_payments FOR ALL TO authenticated USING (true);
    END IF;
END $$;


-- 2. ATUALIZAR FORMAS DE PAGAMENTO (Resolve Erro 400)
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS qr_code_url text;


-- 3. INSERIR FORMAS PADRÃO PARA TODAS AS BARBEARIAS
-- Dinheiro
INSERT INTO public.payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'Dinheiro', 'dinheiro', true, true FROM public.barbershops
ON CONFLICT DO NOTHING;

-- PIX
INSERT INTO public.payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'PIX', 'pix', true, true FROM public.barbershops
ON CONFLICT DO NOTHING;

-- Débito
INSERT INTO public.payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'Cartão de Débito', 'debito', true, true FROM public.barbershops
ON CONFLICT DO NOTHING;

-- Crédito
INSERT INTO public.payment_methods (barbershop_id, nome, tipo, is_default, ativo)
SELECT id, 'Cartão de Crédito', 'credito', true, true FROM public.barbershops
ON CONFLICT DO NOTHING;

-- ==========================================================
-- SCRIPT FINALIZADO
-- ==========================================================
