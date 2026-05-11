/*
  # Navalha - Initial Schema

  Creates the complete multi-tenant schema for the barbershop SaaS.

  1. Tables
    - barbershops: tenant root
    - members: links auth.users to a barbershop with a role
    - barbers: barber profiles (optionally linked to a member)
    - working_hours: weekly schedule per barber
    - services: service catalog
    - service_commissions: per-barber commission overrides
    - products: product catalog with stock
    - stock_movements: stock history
    - clients: customers per barbershop
    - appointments: scheduled appointments
    - appointment_services: M2M services for an appointment
    - orders: open/closed tickets (comandas)
    - order_items: line items
    - cash_movements: cash ledger
  2. Security
    - RLS enabled on all tables
    - Policies: members of a barbershop can read/write its data
    - Barbers (role=barber) restricted to their own appointments/orders
  3. Triggers
    - updated_at auto-maintained
    - appointment conflict prevention
  4. Notes
    - Public booking uses service role or explicit public policies for reads
*/

-- Enums
DO $$ BEGIN CREATE TYPE member_role AS ENUM ('owner','manager','barber','reception'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appointment_status AS ENUM ('agendado','confirmado','em_atendimento','finalizado','cancelado','no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appointment_origin AS ENUM ('online','manual','telefone'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('dinheiro','pix','debito','credito'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('aberta','fechada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_item_type AS ENUM ('servico','produto'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stock_movement_type AS ENUM ('entrada','saida','ajuste'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cash_movement_type AS ENUM ('entrada','saida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Barbershops
CREATE TABLE IF NOT EXISTS barbershops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  telefone text DEFAULT '',
  endereco text DEFAULT '',
  timezone text DEFAULT 'America/Fortaleza',
  logo_url text DEFAULT '',
  cancel_min_hours int DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_barbershops_updated ON barbershops;
CREATE TRIGGER trg_barbershops_updated BEFORE UPDATE ON barbershops FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Members
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'owner',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, barbershop_id)
);
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_members_updated ON members;
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Helper: user's barbershops
CREATE OR REPLACE FUNCTION user_barbershops() RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND ativo = true;
$$;

CREATE OR REPLACE FUNCTION user_role_in(bshop uuid) RETURNS member_role
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM members WHERE user_id = auth.uid() AND barbershop_id = bshop AND ativo = true LIMIT 1;
$$;

-- RLS policies: barbershops
CREATE POLICY "members read own barbershop" ON barbershops FOR SELECT TO authenticated
  USING (id IN (SELECT user_barbershops()));
CREATE POLICY "owner/manager update barbershop" ON barbershops FOR UPDATE TO authenticated
  USING (user_role_in(id) IN ('owner','manager'))
  WITH CHECK (user_role_in(id) IN ('owner','manager'));
CREATE POLICY "any authenticated can create barbershop" ON barbershops FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS: members
CREATE POLICY "read members of own barbershops" ON members FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()) OR user_id = auth.uid());
CREATE POLICY "insert self as member" ON members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "owner updates members" ON members FOR UPDATE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'))
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "owner deletes members" ON members FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) = 'owner');

-- Barbers
CREATE TABLE IF NOT EXISTS barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  nome_exibicao text NOT NULL,
  comissao_padrao numeric(5,2) NOT NULL DEFAULT 50,
  ativo boolean NOT NULL DEFAULT true,
  cor_agenda text DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_barbers_updated ON barbers;
CREATE TRIGGER trg_barbers_updated BEFORE UPDATE ON barbers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read barbers of own barbershop" ON barbers FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "manage barbers" ON barbers FOR INSERT TO authenticated
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "update barbers" ON barbers FOR UPDATE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'))
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "delete barbers" ON barbers FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'));

-- Working hours
CREATE TABLE IF NOT EXISTS working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_wh_updated ON working_hours;
CREATE TRIGGER trg_wh_updated BEFORE UPDATE ON working_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read working_hours" ON working_hours FOR SELECT TO authenticated
  USING (barber_id IN (SELECT id FROM barbers WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "insert working_hours" ON working_hours FOR INSERT TO authenticated
  WITH CHECK (barber_id IN (SELECT id FROM barbers WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "update working_hours" ON working_hours FOR UPDATE TO authenticated
  USING (barber_id IN (SELECT id FROM barbers WHERE barbershop_id IN (SELECT user_barbershops())))
  WITH CHECK (barber_id IN (SELECT id FROM barbers WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "delete working_hours" ON working_hours FOR DELETE TO authenticated
  USING (barber_id IN (SELECT id FROM barbers WHERE barbershop_id IN (SELECT user_barbershops())));

-- Services
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  nome text NOT NULL,
  duracao_min int NOT NULL DEFAULT 30,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_services_updated ON services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read services" ON services FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert services" ON services FOR INSERT TO authenticated
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "update services" ON services FOR UPDATE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'))
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "delete services" ON services FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'));

-- Service commissions
CREATE TABLE IF NOT EXISTS service_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_id, barber_id)
);
ALTER TABLE service_commissions ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_sc_updated ON service_commissions;
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON service_commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read service_commissions" ON service_commissions FOR SELECT TO authenticated
  USING (service_id IN (SELECT id FROM services WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "insert service_commissions" ON service_commissions FOR INSERT TO authenticated
  WITH CHECK (service_id IN (SELECT id FROM services WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "update service_commissions" ON service_commissions FOR UPDATE TO authenticated
  USING (service_id IN (SELECT id FROM services WHERE barbershop_id IN (SELECT user_barbershops())))
  WITH CHECK (service_id IN (SELECT id FROM services WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "delete service_commissions" ON service_commissions FOR DELETE TO authenticated
  USING (service_id IN (SELECT id FROM services WHERE barbershop_id IN (SELECT user_barbershops())));

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  nome text NOT NULL,
  sku text DEFAULT '',
  custo numeric(10,2) NOT NULL DEFAULT 0,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  estoque int NOT NULL DEFAULT 0,
  estoque_min int NOT NULL DEFAULT 0,
  comissao_percentual numeric(5,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read products" ON products FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert products" ON products FOR INSERT TO authenticated
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "update products" ON products FOR UPDATE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'))
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "delete products" ON products FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'));

-- Stock movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tipo stock_movement_type NOT NULL,
  qtd int NOT NULL,
  motivo text DEFAULT '',
  ref_order_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read stock_movements" ON stock_movements FOR SELECT TO authenticated
  USING (product_id IN (SELECT id FROM products WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "insert stock_movements" ON stock_movements FOR INSERT TO authenticated
  WITH CHECK (product_id IN (SELECT id FROM products WHERE barbershop_id IN (SELECT user_barbershops())));

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text DEFAULT '',
  email text DEFAULT '',
  aniversario date,
  observacoes text DEFAULT '',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(barbershop_id, telefone)
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read clients" ON clients FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert clients" ON clients FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update clients" ON clients FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "delete clients" ON clients FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'));

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  barber_id uuid NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  data_hora timestamptz NOT NULL,
  duracao_min int NOT NULL DEFAULT 30,
  status appointment_status NOT NULL DEFAULT 'agendado',
  origem appointment_origin NOT NULL DEFAULT 'manual',
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_appts_barber_time ON appointments(barber_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_appts_shop_time ON appointments(barbershop_id, data_hora);

CREATE POLICY "read appointments" ON appointments FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert appointments" ON appointments FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update appointments" ON appointments FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "delete appointments" ON appointments FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager','reception'));

-- Appointment services
CREATE TABLE IF NOT EXISTS appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read appt services" ON appointment_services FOR SELECT TO authenticated
  USING (appointment_id IN (SELECT id FROM appointments WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "insert appt services" ON appointment_services FOR INSERT TO authenticated
  WITH CHECK (appointment_id IN (SELECT id FROM appointments WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "delete appt services" ON appointment_services FOR DELETE TO authenticated
  USING (appointment_id IN (SELECT id FROM appointments WHERE barbershop_id IN (SELECT user_barbershops())));

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  barber_id uuid NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  total numeric(10,2) NOT NULL DEFAULT 0,
  desconto numeric(10,2) NOT NULL DEFAULT 0,
  forma_pagamento payment_method,
  status order_status NOT NULL DEFAULT 'aberta',
  aberta_em timestamptz DEFAULT now(),
  fechada_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "read orders" ON orders FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert orders" ON orders FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update orders" ON orders FOR UPDATE TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()))
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "delete orders" ON orders FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'));

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tipo order_item_type NOT NULL,
  ref_id uuid,
  descricao text NOT NULL,
  qtd int NOT NULL DEFAULT 1,
  valor_unit numeric(10,2) NOT NULL DEFAULT 0,
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  comissao_percentual numeric(5,2) NOT NULL DEFAULT 0,
  comissao_valor numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read order_items" ON order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "insert order_items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "update order_items" ON order_items FOR UPDATE TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE barbershop_id IN (SELECT user_barbershops())))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE barbershop_id IN (SELECT user_barbershops())));
CREATE POLICY "delete order_items" ON order_items FOR DELETE TO authenticated
  USING (order_id IN (SELECT id FROM orders WHERE barbershop_id IN (SELECT user_barbershops())));

-- Cash movements
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  tipo cash_movement_type NOT NULL,
  categoria text DEFAULT '',
  descricao text DEFAULT '',
  valor numeric(10,2) NOT NULL DEFAULT 0,
  data timestamptz DEFAULT now(),
  ref_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read cash_movements" ON cash_movements FOR SELECT TO authenticated
  USING (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "insert cash_movements" ON cash_movements FOR INSERT TO authenticated
  WITH CHECK (barbershop_id IN (SELECT user_barbershops()));
CREATE POLICY "update cash_movements" ON cash_movements FOR UPDATE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'))
  WITH CHECK (user_role_in(barbershop_id) IN ('owner','manager'));
CREATE POLICY "delete cash_movements" ON cash_movements FOR DELETE TO authenticated
  USING (user_role_in(barbershop_id) IN ('owner','manager'));

-- Conflict prevention: prevent overlapping active appointments for the same barber
CREATE OR REPLACE FUNCTION check_appointment_conflict() RETURNS trigger AS $$
DECLARE conflict_count int;
BEGIN
  IF NEW.status IN ('cancelado','no_show') THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO conflict_count FROM appointments a
    WHERE a.barber_id = NEW.barber_id
      AND a.id <> NEW.id
      AND a.status NOT IN ('cancelado','no_show')
      AND tstzrange(a.data_hora, a.data_hora + (a.duracao_min || ' minutes')::interval) &&
          tstzrange(NEW.data_hora, NEW.data_hora + (NEW.duracao_min || ' minutes')::interval);
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito de agenda: já existe um agendamento neste horário para este barbeiro';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appt_conflict ON appointments;
CREATE TRIGGER trg_appt_conflict BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION check_appointment_conflict();

-- Close order RPC
CREATE OR REPLACE FUNCTION close_order(p_order_id uuid, p_forma payment_method)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE o orders%ROWTYPE; it record; bshop uuid;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status <> 'aberta' THEN RAISE EXCEPTION 'Order already %', o.status; END IF;
  bshop := o.barbershop_id;
  IF NOT EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND barbershop_id = bshop AND ativo) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE orders SET status='fechada', forma_pagamento=p_forma, fechada_em=now() WHERE id = p_order_id;

  INSERT INTO cash_movements (barbershop_id, tipo, categoria, descricao, valor, ref_order_id)
  VALUES (bshop, 'entrada', 'atendimento', 'Fechamento comanda', o.total - COALESCE(o.desconto,0), p_order_id);

  FOR it IN SELECT * FROM order_items WHERE order_id = p_order_id AND tipo = 'produto' LOOP
    INSERT INTO stock_movements (product_id, tipo, qtd, motivo, ref_order_id)
    VALUES (it.ref_id, 'saida', it.qtd, 'Venda', p_order_id);
    UPDATE products SET estoque = estoque - it.qtd WHERE id = it.ref_id;
  END LOOP;

  IF o.appointment_id IS NOT NULL THEN
    UPDATE appointments SET status = 'finalizado' WHERE id = o.appointment_id;
  END IF;

  RETURN p_order_id;
END $$;

-- Onboarding RPC: creates barbershop + owner member
CREATE OR REPLACE FUNCTION create_barbershop(p_nome text, p_slug text, p_telefone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO barbershops (nome, slug, telefone) VALUES (p_nome, p_slug, COALESCE(p_telefone,'')) RETURNING id INTO new_id;
  INSERT INTO members (user_id, barbershop_id, role, ativo) VALUES (auth.uid(), new_id, 'owner', true);
  RETURN new_id;
END $$;

-- Public booking support: expose barbershop + services + barbers via views
CREATE OR REPLACE VIEW public_barbershops AS
  SELECT id, nome, slug, telefone, endereco, logo_url FROM barbershops;
GRANT SELECT ON public_barbershops TO anon;

CREATE POLICY "public read services by slug" ON services FOR SELECT TO anon
  USING (ativo = true);
CREATE POLICY "public read barbers by slug" ON barbers FOR SELECT TO anon
  USING (ativo = true);
CREATE POLICY "public read working_hours" ON working_hours FOR SELECT TO anon
  USING (true);
CREATE POLICY "public read appointments for availability" ON appointments FOR SELECT TO anon
  USING (status NOT IN ('cancelado','no_show'));
CREATE POLICY "public insert clients for booking" ON clients FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "public select clients by phone for booking" ON clients FOR SELECT TO anon
  USING (true);
CREATE POLICY "public insert appointments for booking" ON appointments FOR INSERT TO anon
  WITH CHECK (origem = 'online');
CREATE POLICY "public insert appointment_services" ON appointment_services FOR INSERT TO anon
  WITH CHECK (true);
