-- Pedido pago entra em preparo sozinho.
--
-- Até aqui confirm_payment mexia só em orders.payment_status. O resultado no
-- admin era um pedido com "Pago" numa coluna e "Pendente" na outra, para
-- sempre, até alguém mudar na mão -- e como a mudança manual é o único jeito
-- de o pedido sair de "Pendente", um pagamento confirmado de madrugada ficava
-- parado até alguém abrir o painel.
--
-- A guarda importante é o CASE: só avança quem ainda está em 'pendente'. Sem
-- ele, uma notificação de pagamento atrasada (ou uma reconciliação rodando
-- depois) empurraria de volta para 'em_preparo' um pedido que já saiu para
-- entrega, ou pior, ressuscitaria um pedido cancelado.

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
    UPDATE public.orders
      SET payment_status = 'pago',
          -- Só de 'pendente' para frente. Nunca retrocede um pedido que já
          -- avançou, nunca reabre um cancelado.
          status = CASE WHEN status = 'pendente' THEN 'em_preparo' ELSE status END
      WHERE id = pay.order_id;
  ELSIF novo_status = 'estornado' THEN
    -- Estorno NÃO mexe no status operacional: se o arranjo já foi montado ou
    -- entregue, cancelar sozinho apagaria trabalho real do painel. Fica para
    -- decisão humana, com payment_status sinalizando.
    UPDATE public.orders SET payment_status = 'estornado' WHERE id = pay.order_id;
  END IF;
  RETURN 'aplicado';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT) TO service_role;
