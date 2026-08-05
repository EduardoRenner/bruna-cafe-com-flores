-- Boleto como forma de pagamento, e troco para pagamento em dinheiro.
--
-- O trigger validate_new_order recusa payment_method fora de
-- ('pix','dinheiro','cartao'). Sem atualizá-lo, um pedido com 'boleto' seria
-- rejeitado pelo Postgres mesmo passando pela validação em TypeScript -- a
-- checagem do banco é a que vale, e é ela que impede pedido adulterado
-- entrando por qualquer outro caminho.
--
-- change_for guarda "troco para quanto" e só faz sentido com 'dinheiro'. A
-- regra fica aqui, no banco, junto das outras: validação só no navegador não
-- protege nada, e validação só no TypeScript deixa de fora o agente de
-- WhatsApp e a API do n8n, que criam pedido pelo mesmo caminho.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS change_for NUMERIC;

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
  IF NEW.payment_method NOT IN ('pix', 'dinheiro', 'cartao', 'boleto') THEN
    RAISE EXCEPTION 'Invalid payment_method';
  END IF;

  -- Troco só existe para dinheiro. Em qualquer outra forma o campo é ruído
  -- que confundiria quem monta o pedido, então é zerado em vez de recusado.
  IF NEW.payment_method <> 'dinheiro' THEN
    NEW.change_for := NULL;
  ELSIF NEW.change_for IS NOT NULL THEN
    IF NEW.change_for < NEW.total THEN
      RAISE EXCEPTION 'change_for must be at least the order total';
    END IF;
    -- Teto defensivo: "troco para R$ 999.999" é erro de digitação, e o valor
    -- vai impresso no pedido que a loja usa para separar dinheiro.
    IF NEW.change_for > NEW.total + 100000 THEN
      RAISE EXCEPTION 'change_for is implausibly large';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
