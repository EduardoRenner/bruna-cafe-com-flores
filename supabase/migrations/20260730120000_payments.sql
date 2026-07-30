-- =============================================================================
-- Pagamento online — estrutura de dados.
--
-- Premissa central: NENHUM dado de cartão passa por aqui. O cliente digita o
-- cartão no checkout hospedado do gateway; deste lado guardamos só o id da
-- transação, o valor e o status. Assim não há dado de cartão para vazar mesmo
-- num cenário de comprometimento total do banco.
--
-- Valores em CENTAVOS (bigint). Dinheiro em float/numeric convertido de um lado
-- para outro acumula erro de arredondamento, e em conferência de pagamento uma
-- diferença de um centavo é a diferença entre aceitar e recusar.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Token público do pedido
--
-- O order_number é sequencial (BCF-1000, BCF-1001...). Qualquer página que
-- permita consultar um pedido por esse número deixa o cliente trocar o número
-- na URL e ler o pedido de outra pessoa. O token aleatório existe para ser o
-- identificador usado em link público; o número sequencial continua só para
-- leitura humana no admin e no WhatsApp.
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_token TEXT;

UPDATE public.orders
  SET public_token = encode(gen_random_bytes(24), 'hex')
  WHERE public_token IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN public_token SET NOT NULL,
  ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_token
  ON public.orders (public_token);

-- ----------------------------------------------------------------------------
-- PAYMENTS — uma linha por tentativa de pagamento
-- ----------------------------------------------------------------------------
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  provider TEXT NOT NULL,
  -- Id da preferência/checkout criado no gateway (antes de existir pagamento).
  provider_preference_id TEXT,
  -- Id do pagamento em si no gateway (só existe depois que o cliente paga).
  provider_payment_id TEXT,

  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',

  -- iniciado: link gerado, cliente ainda não pagou
  -- pago:     confirmado pelo gateway
  -- recusado: gateway rejeitou
  -- estornado / cancelado / expirado: estados finais sem dinheiro
  -- divergente: gateway confirmou valor diferente do nosso — exige conferência
  --             humana, nunca é tratado como pago automaticamente
  status TEXT NOT NULL DEFAULT 'iniciado'
    CHECK (status IN ('iniciado','pago','recusado','estornado','cancelado','expirado','divergente')),
  status_detail TEXT,

  -- Método efetivamente usado (pix, credit_card...), preenchido pelo gateway.
  method TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_order ON public.payments (order_id);
-- Parcial: vários pagamentos podem estar com provider_payment_id nulo
-- (iniciados e nunca concluídos), mas um id de pagamento do gateway não pode
-- ser processado em duas linhas diferentes.
CREATE UNIQUE INDEX idx_payments_provider_payment
  ON public.payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fechado para o público. O checkout e o webhook rodam no servidor com service
-- role (que ignora RLS); o navegador do cliente não tem nada que fazer aqui.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments FROM anon, authenticated;
GRANT ALL ON public.payments TO service_role;

CREATE POLICY "Deny public select payments" ON public.payments
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert payments" ON public.payments
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update payments" ON public.payments
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete payments" ON public.payments
  FOR DELETE TO anon, authenticated USING (false);

-- ----------------------------------------------------------------------------
-- PAYMENT_EVENTS — log bruto de notificações do gateway
--
-- Serve para duas coisas: idempotência (gateways reenviam a mesma notificação
-- várias vezes, e processar duas vezes não pode gerar efeito duplicado) e
-- perícia — se um dia houver contestação, aqui está o que o gateway mandou e
-- quando.
-- ----------------------------------------------------------------------------
CREATE TABLE public.payment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  -- Chave de idempotência: id da notificação no gateway.
  provider_event_id TEXT NOT NULL,
  event_type TEXT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  -- Corpo recebido. Não contém dado de cartão (o gateway não devolve isso),
  -- mas pode conter nome/e-mail do pagador — por isso a tabela é fechada.
  payload JSONB,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_payment_events_dedupe
  ON public.payment_events (provider, provider_event_id);
CREATE INDEX idx_payment_events_received ON public.payment_events (received_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM anon, authenticated;
GRANT ALL ON public.payment_events TO service_role;

CREATE POLICY "Deny public select payment_events" ON public.payment_events
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert payment_events" ON public.payment_events
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update payment_events" ON public.payment_events
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete payment_events" ON public.payment_events
  FOR DELETE TO anon, authenticated USING (false);

-- ----------------------------------------------------------------------------
-- Confirmação de pagamento — atômica e com conferência de valor
--
-- Roda como uma transação só para não existir estado intermediário onde o
-- pagamento está pago mas o pedido não. Recusa silenciosa não existe: valor
-- divergente vira status 'divergente' e o pedido NÃO é marcado como pago.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_payment(
  _payment_id UUID,
  _provider_payment_id TEXT,
  _gateway_status TEXT,
  _gateway_amount_cents BIGINT,
  _method TEXT DEFAULT NULL,
  _status_detail TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay        public.payments%ROWTYPE;
  novo_status text;
BEGIN
  -- FOR UPDATE: duas notificações do gateway chegando juntas não podem
  -- confirmar o mesmo pagamento em paralelo.
  SELECT * INTO pay FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'pagamento_desconhecido';
  END IF;

  -- Já finalizado: reentrega da mesma notificação não refaz nada.
  IF pay.status IN ('pago','estornado','divergente') AND pay.provider_payment_id IS NOT NULL THEN
    RETURN 'ja_processado';
  END IF;

  IF _gateway_status = 'pago' AND _gateway_amount_cents IS DISTINCT FROM pay.amount_cents THEN
    UPDATE public.payments
      SET status = 'divergente',
          provider_payment_id = _provider_payment_id,
          status_detail = format(
            'Valor do gateway (%s) difere do pedido (%s)',
            _gateway_amount_cents, pay.amount_cents
          ),
          method = COALESCE(_method, method)
      WHERE id = pay.id;
    -- De propósito: o pedido NÃO vira pago. Alguém confere antes.
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

  -- Espelha no pedido só o que a loja precisa ver na listagem.
  IF novo_status = 'pago' THEN
    UPDATE public.orders SET payment_status = 'pago' WHERE id = pay.order_id;
  ELSIF novo_status = 'estornado' THEN
    UPDATE public.orders SET payment_status = 'estornado' WHERE id = pay.order_id;
  END IF;

  RETURN 'aplicado';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT)
  TO service_role;

-- ----------------------------------------------------------------------------
-- Consulta pública de status pelo token
--
-- Devolve o mínimo para o cliente acompanhar o pedido dele: nada de endereço,
-- telefone ou dados de outras pessoas. Recebe o token aleatório, não o número
-- sequencial, então não dá para varrer pedidos alheios.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_public_status(_token TEXT)
RETURNS TABLE (
  order_number TEXT,
  status TEXT,
  payment_status TEXT,
  total NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.order_number, o.status, o.payment_status, o.total, o.created_at
    FROM public.orders o
   WHERE o.public_token = _token
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_order_public_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_public_status(TEXT) TO service_role;
