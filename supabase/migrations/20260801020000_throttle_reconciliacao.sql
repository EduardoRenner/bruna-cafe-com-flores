-- Freio na reconciliação.
--
-- A página do pedido consulta o gateway a cada carregamento. Quem tem o token
-- do próprio pedido (48 hex) pode repetir a chamada num laço e consumir a
-- nossa cota na API do Mercado Pago -- não é roubo de dado, mas derruba o
-- pagamento para todo mundo, e a página do pedido é pública por natureza.
--
-- Guardar quando cada tentativa foi conferida pela última vez resolve sem
-- estado em memória, que em serverless não sobrevive entre requisições.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

-- Reconciliação só toca em pagamento ainda em aberto; o índice cobre
-- exatamente essa busca.
CREATE INDEX IF NOT EXISTS idx_payments_reconciliacao
  ON public.payments (order_id, status, last_reconciled_at);
