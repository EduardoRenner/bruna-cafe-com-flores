-- =============================================================================
-- Mesma mudança já feita na Bem Me Quer (floricultura-bem-me-quer,
-- 20260802140000): separa a "mensagem do cartão" e a "instrução de entrega"
-- do campo único `notes`, e adiciona os campos de confirmação de entrega
-- usados pelo comprovante com QR code no PDF do pedido.
--
-- Pedidos antigos continuam só com `notes` preenchido (não dá para separar
-- retroativamente um texto livre) — o PDF mostra esses como estavam antes.
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_instructions text,
  ADD COLUMN IF NOT EXISTS card_message text,
  ADD COLUMN IF NOT EXISTS delivered_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_received_by text,
  ADD COLUMN IF NOT EXISTS delivered_received_type text;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivered_received_type_check
  CHECK (delivered_received_type IS NULL OR delivered_received_type IN ('em_maos', 'familiar', 'portaria', 'vizinho'));

COMMENT ON COLUMN public.orders.delivery_instructions IS 'Instrução de entrega (ex.: horário preferido, referência) — campo livre do checkout.';
COMMENT ON COLUMN public.orders.card_message IS 'Mensagem do cartão, separada da instrução de entrega desde 2026-08-02.';
COMMENT ON COLUMN public.orders.delivered_confirmed_at IS 'Preenchido quando o entregador confirma a entrega via QR code do comprovante.';
