-- =============================================================================
-- Bruna Café com Flores — schema inicial da loja (catálogo, pedidos, settings).
-- Estrutura portada da Floricultura Bem Me Quer, consolidada e ajustada para a
-- Bruna: prefixo de pedido BCF-, valores de delivery_type/payment consistentes.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active products" ON public.products FOR SELECT USING (active = true);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('pickup','delivery')),
  delivery_address JSONB,
  delivery_date DATE,
  delivery_time TEXT,
  payment_method TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  total NUMERIC(10,2) NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Número sequencial do pedido — prefixo BCF (Bruna Café com Flores)
CREATE SEQUENCE public.order_number_seq START 1000;
GRANT USAGE ON SEQUENCE public.order_number_seq TO anon, authenticated;

-- Nada de leitura pública de pedidos (service_role ignora RLS; admin usa service_role)
CREATE POLICY "No public read of orders" ON public.orders FOR SELECT USING (false);

-- ----------------------------------------------------------------------------
-- SETTINGS (config editável no admin; admin_password fica aqui como hash)
-- ----------------------------------------------------------------------------
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public settings are readable" ON public.settings FOR SELECT USING (is_public = true);

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Validação/segurança do pedido no INSERT:
--  - força status 'pendente' e gera order_number BCF-xxxx
--  - recalcula o total a partir dos itens (impede adulteração pelo cliente)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_new_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  computed_total numeric := 0;
  item jsonb;
  qty numeric;
  price numeric;
BEGIN
  NEW.status := 'pendente';
  NEW.order_number := 'BCF-' || nextval('order_number_seq');

  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;
  IF jsonb_array_length(NEW.items) > 100 THEN
    RAISE EXCEPTION 'Too many items in order';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    price := COALESCE((item->>'price')::numeric, 0);
    qty := COALESCE((item->>'quantity')::numeric, 0);
    IF price < 0 OR qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item price or quantity';
    END IF;
    computed_total := computed_total + (price * qty);
  END LOOP;

  NEW.total := computed_total;
  IF NEW.total <= 0 THEN
    RAISE EXCEPTION 'Order total must be positive';
  END IF;

  IF length(COALESCE(NEW.customer_name, '')) > 200
     OR length(COALESCE(NEW.customer_phone, '')) > 40
     OR length(COALESCE(NEW.customer_email, '')) > 200
     OR length(COALESCE(NEW.notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Field length exceeds limit';
  END IF;

  IF NEW.delivery_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid delivery_type';
  END IF;
  IF NEW.payment_method NOT IN ('pix', 'dinheiro', 'cartao') THEN
    RAISE EXCEPTION 'Invalid payment_method';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_new_order_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_new_order();

CREATE POLICY "Public can submit orders" ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendente'
    AND jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) > 0
    AND delivery_type IN ('pickup', 'delivery')
    AND payment_method IN ('pix', 'dinheiro', 'cartao')
  );

-- ----------------------------------------------------------------------------
-- Senha do admin (bcrypt) + rate limiting por IP
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_admin_password(_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _new_password IS NULL OR length(_new_password) < 8 THEN
    RAISE EXCEPTION 'Password too short';
  END IF;
  UPDATE public.settings
    SET value = to_jsonb(crypt(_new_password, gen_salt('bf', 10))),
        updated_at = now()
    WHERE key = 'admin_password';
  IF NOT FOUND THEN
    INSERT INTO public.settings(key, value, is_public)
    VALUES ('admin_password', to_jsonb(crypt(_new_password, gen_salt('bf', 10))), false);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_admin_password(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_password(text) TO service_role;

CREATE TABLE public.admin_login_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_login_attempts_ip_time
  ON public.admin_login_attempts (ip, attempted_at);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_attempts FROM anon, authenticated;
GRANT ALL ON public.admin_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.verify_admin_login(_password text, _ip text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored        text;
  ip_key        text := COALESCE(NULLIF(_ip, ''), 'unknown');
  window_start  timestamptz := now() - interval '15 minutes';
  fail_count    int;
  max_attempts  int := 8;
  ok            boolean;
BEGIN
  DELETE FROM public.admin_login_attempts WHERE attempted_at < now() - interval '1 hour';

  SELECT count(*) INTO fail_count
    FROM public.admin_login_attempts
    WHERE ip = ip_key AND attempted_at >= window_start;

  IF fail_count >= max_attempts THEN
    RETURN 'locked';
  END IF;

  SELECT value #>> '{}' INTO stored FROM public.settings WHERE key = 'admin_password';
  IF stored IS NULL THEN
    RETURN 'invalid';
  END IF;

  ok := (stored = crypt(_password, stored));

  IF ok THEN
    DELETE FROM public.admin_login_attempts WHERE ip = ip_key;
    RETURN 'ok';
  ELSE
    INSERT INTO public.admin_login_attempts(ip) VALUES (ip_key);
    RETURN 'invalid';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_admin_login(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- Bucket público de imagens de produtos (upload só via service role no admin)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- ----------------------------------------------------------------------------
-- Seeds iniciais
-- ----------------------------------------------------------------------------
-- Senha de admin provisória: "brunacafe2024" (bcrypt). TROQUE no admin depois.
INSERT INTO public.settings (key, value, is_public)
VALUES ('admin_password', to_jsonb(crypt('brunacafe2024', gen_salt('bf', 10))), false)
ON CONFLICT (key) DO NOTHING;

-- Nome público da loja (exemplo de setting público)
INSERT INTO public.settings (key, value, is_public)
VALUES ('store_name', to_jsonb('Bruna Café com Flores'::text), true)
ON CONFLICT (key) DO NOTHING;
