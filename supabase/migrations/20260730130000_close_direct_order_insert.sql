-- =============================================================================
-- Fecha o INSERT direto em orders pelas chaves públicas (anon/authenticated).
--
-- A policy "Public can submit orders" (da migration inicial) permitia ao
-- cliente inserir pedidos direto via REST, checando só formato: status,
-- delivery_type, payment_method, items não-vazio. Ela NÃO conferia o preço de
-- cada item contra o catálogo — só o trigger validate_new_order, que soma os
-- preços que vierem no payload para calcular o total, sem cruzar com
-- products.price.
--
-- Resultado: dava para POSTar direto em /rest/v1/orders com item.price=0.01
-- num produto de R$60 e o pedido era aceito com total R$0,01. Confirmado e
-- corrigido em 2026-07-30 (ver docs/integracao-n8n.md).
--
-- A correção de preço em src/lib/order.functions.ts (busca o preço do
-- catálogo no servidor) sempre esteve certa — o problema é que ela não era o
-- ÚNICO caminho para criar pedido. Toda criação de pedido passa por esse
-- server function usando service_role, que ignora RLS; a policy pública
-- nunca foi necessária para o checkout funcionar, só sobrou de um desenho
-- anterior. Fechando o caminho paralelo.
-- =============================================================================
DROP POLICY IF EXISTS "Public can submit orders" ON public.orders;

CREATE POLICY "Deny public insert orders" ON public.orders
  FOR INSERT TO anon, authenticated WITH CHECK (false);
