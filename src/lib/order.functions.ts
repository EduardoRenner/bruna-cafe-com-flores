import { createServerFn } from "@tanstack/react-start";
import type { CreateOrderInput } from "@/lib/orders/createOrderCore.server";

// Ponte entre o checkout do navegador e o núcleo de criação de pedido
// (src/lib/orders/createOrderCore.server.ts), que também é usado pela API do
// n8n. Toda a validação — preço vindo do catálogo, rate limit, taxa de
// entrega — mora lá, para os dois caminhos se comportarem exatamente igual.
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: CreateOrderInput) => data)
  .handler(async ({ data }) => {
    const { criarPedido, OrderValidationError } = await import(
      "@/lib/orders/createOrderCore.server"
    );
    const { getClientIp } = await import("@/lib/request.server");

    try {
      return await criarPedido(data, { clientIp: await getClientIp() });
    } catch (err) {
      // Mensagem de validação já é segura para o cliente ver; qualquer outro
      // erro (banco, rede) vira mensagem genérica — não expõe detalhe interno.
      if (err instanceof OrderValidationError) throw err;
      console.error("[pedido] falha ao criar:", err);
      throw new Error("Não foi possível registrar o pedido. Tente novamente.");
    }
  });

const RECEIVED_TYPE_LABELS: Record<string, string> = {
  em_maos: "Em mãos",
  familiar: "Familiar",
  portaria: "Portaria",
  vizinho: "Vizinho",
};

// Página pública que o entregador abre pelo QR code do comprovante — sem
// senha, identificada pelo `public_token` (não pelo order_number sequencial:
// mesmo motivo já documentado em pedido.$orderNumber.tsx, um número
// adivinhável deixaria qualquer um mexer no pedido de outro cliente).
//
// Devolve `{ found: false }` em vez de lançar erro quando o token não bate —
// testado ao vivo na Bem Me Quer que uma server function chamada via
// useServerFn + useQuery não propaga o erro lançado como `error` do lado do
// cliente (o resultado chega undefined, sem estado de loading nem de erro).
// Um discriminador explícito no retorno evita depender desse comportamento.
export const getOrderForDeliveryConfirmation = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = data.token?.trim();
    if (!token) return { found: false as const };

    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number,customer_name,delivery_type,delivery_address,delivered_confirmed_at,delivered_received_by,delivered_received_type",
      )
      .eq("public_token", token)
      .maybeSingle();
    if (error || !row) return { found: false as const };

    return {
      found: true as const,
      orderNumber: row.order_number as string,
      customerName: row.customer_name as string,
      deliveryType: row.delivery_type as string,
      deliveryAddress: row.delivery_address as Record<string, string> | null,
      confirmed: Boolean(row.delivered_confirmed_at),
      confirmedAt: row.delivered_confirmed_at as string | null,
      receivedBy: row.delivered_received_by as string | null,
      receivedTypeLabel: row.delivered_received_type
        ? (RECEIVED_TYPE_LABELS[row.delivered_received_type as string] ?? null)
        : null,
    };
  });

// Devolve `{ ok: false, error }` em vez de lançar — mesmo motivo do
// discriminador em getOrderForDeliveryConfirmation acima.
export const confirmDelivery = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; receivedBy: string; receivedType: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = data.token?.trim();
    const receivedBy = data.receivedBy?.trim();
    const receivedType = data.receivedType?.trim();

    if (!token) return { ok: false as const, error: "Pedido inválido" };
    if (!receivedBy) return { ok: false as const, error: "Informe o nome de quem recebeu" };
    if (!RECEIVED_TYPE_LABELS[receivedType]) {
      return { ok: false as const, error: "Selecione quem recebeu o pedido" };
    }

    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("delivered_confirmed_at")
      .eq("public_token", token)
      .maybeSingle();
    if (existing?.delivered_confirmed_at) {
      return { ok: false as const, error: "Esta entrega já foi confirmada" };
    }

    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .update({
        delivered_confirmed_at: new Date().toISOString(),
        delivered_received_by: receivedBy.slice(0, 200),
        delivered_received_type: receivedType,
        status: "entregue",
      })
      .eq("public_token", token)
      .select("order_number")
      .maybeSingle();
    if (error) return { ok: false as const, error: "Não foi possível confirmar a entrega" };
    if (!row) return { ok: false as const, error: "Pedido não encontrado" };

    return { ok: true as const };
  });
