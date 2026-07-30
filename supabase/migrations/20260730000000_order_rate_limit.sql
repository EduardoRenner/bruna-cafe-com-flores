-- Limite de pedidos por IP: protege o checkout público contra spam/flood de
-- pedidos falsos. Mesmo padrão do rate limit de login do admin
-- (admin_login_attempts / verify_admin_login), aplicado à criação de pedidos.
CREATE TABLE public.order_rate_limit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_rate_limit_ip_time ON public.order_rate_limit (ip, created_at);
ALTER TABLE public.order_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_rate_limit FROM anon, authenticated;
GRANT ALL ON public.order_rate_limit TO service_role;

CREATE OR REPLACE FUNCTION public.check_order_rate_limit(_ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ip_key text := COALESCE(NULLIF(_ip, ''), 'unknown');
  window_start timestamptz := now() - interval '10 minutes';
  recent_count int;
  max_orders int := 8;
BEGIN
  DELETE FROM public.order_rate_limit WHERE created_at < now() - interval '1 hour';

  SELECT count(*) INTO recent_count
    FROM public.order_rate_limit
    WHERE ip = ip_key AND created_at >= window_start;

  IF recent_count >= max_orders THEN
    RETURN false;
  END IF;

  INSERT INTO public.order_rate_limit(ip) VALUES (ip_key);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_order_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_order_rate_limit(text) TO service_role;
