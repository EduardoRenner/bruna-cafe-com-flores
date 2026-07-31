-- rate limit de pedidos
CREATE TABLE IF NOT EXISTS public.order_rate_limit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_rate_limit_ip_time ON public.order_rate_limit (ip, created_at);
ALTER TABLE public.order_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_rate_limit FROM anon, authenticated;
GRANT ALL ON public.order_rate_limit TO service_role;

CREATE OR REPLACE FUNCTION public.check_order_rate_limit(_ip text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ip_key text := COALESCE(NULLIF(_ip, ''), 'unknown');
  window_start timestamptz := now() - interval '10 minutes';
  recent_count int;
  max_orders int := 8;
BEGIN
  DELETE FROM public.order_rate_limit WHERE created_at < now() - interval '1 hour';
  SELECT count(*) INTO recent_count FROM public.order_rate_limit
    WHERE ip = ip_key AND created_at >= window_start;
  IF recent_count >= max_orders THEN RETURN false; END IF;
  INSERT INTO public.order_rate_limit(ip) VALUES (ip_key);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_order_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_order_rate_limit(text) TO service_role;

-- token público do pedido
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS public_token TEXT;
UPDATE public.orders SET public_token = encode(gen_random_bytes(24), 'hex') WHERE public_token IS NULL;
ALTER TABLE public.orders
  ALTER COLUMN public_token SET NOT NULL,
  ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(24), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_token ON public.orders (public_token);

-- pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_preference_id TEXT,
  provider_payment_id TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'iniciado'
    CHECK (status IN ('iniciado','pago','recusado','estornado','cancelado','expirado','divergente')),
  status_detail TEXT,
  method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment
  ON public.payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments FROM anon, authenticated;
GRANT ALL ON public.payments TO service_role;
CREATE POLICY "Deny public select payments" ON public.payments FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert payments" ON public.payments FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update payments" ON public.payments FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete payments" ON public.payments FOR DELETE TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  payload JSONB,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_dedupe ON public.payment_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_received ON public.payment_events (received_at DESC);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM anon, authenticated;
GRANT ALL ON public.payment_events TO service_role;
CREATE POLICY "Deny public select payment_events" ON public.payment_events FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert payment_events" ON public.payment_events FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update payment_events" ON public.payment_events FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete payment_events" ON public.payment_events FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.confirm_payment(
  _payment_id UUID,
  _provider_payment_id TEXT,
  _gateway_status TEXT,
  _gateway_amount_cents BIGINT,
  _method TEXT DEFAULT NULL,
  _status_detail TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pay public.payments%ROWTYPE;
  novo_status text;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'pagamento_desconhecido'; END IF;
  IF pay.status = 'divergente' THEN RETURN 'ja_processado'; END IF;
  IF pay.provider_payment_id = _provider_payment_id AND pay.status = _gateway_status THEN
    RETURN 'ja_processado';
  END IF;
  IF _gateway_status = 'pago' AND _gateway_amount_cents IS DISTINCT FROM pay.amount_cents THEN
    UPDATE public.payments
      SET status = 'divergente',
          provider_payment_id = _provider_payment_id,
          status_detail = format('Valor do gateway (%s) difere do pedido (%s)', _gateway_amount_cents, pay.amount_cents),
          method = COALESCE(_method, method)
      WHERE id = pay.id;
    RETURN 'valor_divergente';
  END IF;
  novo_status := _gateway_status;
  UPDATE public.payments
    SET status = novo_status,
        provider_payment_id = _provider_payment_id,
        status_detail = _status_detail,
        method = COALESCE(_method, method),
        paid_at = CASE WHEN novo_status = 'pago' THEN now() ELSE paid_at END
    WHERE id = pay.id;
  IF novo_status = 'pago' THEN
    UPDATE public.orders SET payment_status = 'pago' WHERE id = pay.order_id;
  ELSIF novo_status = 'estornado' THEN
    UPDATE public.orders SET payment_status = 'estornado' WHERE id = pay.order_id;
  END IF;
  RETURN 'aplicado';
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_payment(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_order_public_status(_token TEXT)
RETURNS TABLE (order_number TEXT, status TEXT, payment_status TEXT, total NUMERIC, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT o.order_number, o.status, o.payment_status, o.total, o.created_at
    FROM public.orders o WHERE o.public_token = _token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_order_public_status(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_public_status(TEXT) TO service_role;

-- fecha insert direto de pedidos
DROP POLICY IF EXISTS "Public can submit orders" ON public.orders;
DROP POLICY IF EXISTS "Deny public insert orders" ON public.orders;
CREATE POLICY "Deny public insert orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (false);

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.orders FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.products FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.settings FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.delivery_zones FROM anon, authenticated;

-- agente de whatsapp
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_order JSONB,
  human_takeover BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message ON public.whatsapp_conversations (last_message_at DESC);
DROP TRIGGER IF EXISTS trg_whatsapp_conversations_updated ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_updated BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
CREATE POLICY "Deny public select whatsapp_conversations" ON public.whatsapp_conversations FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert whatsapp_conversations" ON public.whatsapp_conversations FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update whatsapp_conversations" ON public.whatsapp_conversations FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete whatsapp_conversations" ON public.whatsapp_conversations FOR DELETE TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_events_received ON public.whatsapp_message_events (received_at DESC);
ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_message_events FROM anon, authenticated;
GRANT ALL ON public.whatsapp_message_events TO service_role;
CREATE POLICY "Deny public select whatsapp_message_events" ON public.whatsapp_message_events FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert whatsapp_message_events" ON public.whatsapp_message_events FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update whatsapp_message_events" ON public.whatsapp_message_events FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete whatsapp_message_events" ON public.whatsapp_message_events FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.check_whatsapp_rate_limit(_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  window_start timestamptz := now() - interval '2 minutes';
  recent_count int;
  max_msgs int := 12;
BEGIN
  DELETE FROM public.whatsapp_message_events WHERE received_at < now() - interval '1 hour';
  SELECT count(*) INTO recent_count FROM public.whatsapp_message_events
    WHERE phone = _phone AND received_at >= window_start;
  RETURN recent_count < max_msgs;
END;
$$;
REVOKE ALL ON FUNCTION public.check_whatsapp_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_whatsapp_rate_limit(text) TO service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.whatsapp_message_events FROM anon, authenticated;