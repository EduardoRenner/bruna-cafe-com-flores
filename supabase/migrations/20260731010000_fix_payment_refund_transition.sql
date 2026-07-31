-- =============================================================================
-- Corrige confirm_payment: reembolso/chargeback depois de "pago" era ignorado.
--
-- A trava de idempotência original bloqueava QUALQUER atualização assim que o
-- pagamento chegava a 'pago' (ou 'estornado'/'divergente):
--
--   IF pay.status IN ('pago','estornado','divergente') AND pay.provider_payment_id IS NOT NULL THEN
--     RETURN 'ja_processado';
--   END IF;
--
-- Isso significa que um reembolso ou chargeback processado pelo Mercado Pago
-- DEPOIS da aprovação — cenário normal, não um caso raro — nunca chegava a
-- atualizar orders.payment_status. O pedido ficava marcado "pago" para
-- sempre, mesmo com o dinheiro devolvido ao cliente. Achado em auditoria de
-- 2026-07-31, sem exploração — bug de lógica, não brecha de acesso.
--
-- A nova trava é idempotência de verdade: só considera "já processado" quando
-- é exatamente a MESMA notificação (mesmo id de pagamento do gateway E mesmo
-- status) que já tínhamos gravado. Isso permite a transição legítima
-- pago -> estornado, e continua descartando reentregas da mesma notificação.
--
-- 'divergente' continua congelado: uma vez que um pagamento cai em
-- divergência de valor, nenhuma automação mexe mais nele — exige conferência
-- humana, como já era a intenção original.
-- =============================================================================
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

  -- Divergência de valor é definitiva: exige um humano olhando antes de
  -- qualquer outra automação mexer nesse pagamento.
  IF pay.status = 'divergente' THEN
    RETURN 'ja_processado';
  END IF;

  -- Idempotência real: só é "já processado" se for exatamente a mesma
  -- notificação que já aplicamos (mesmo id do gateway, mesmo status). Uma
  -- transição de status real (ex.: pago -> estornado) tem que passar.
  IF pay.provider_payment_id = _provider_payment_id AND pay.status = _gateway_status THEN
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
