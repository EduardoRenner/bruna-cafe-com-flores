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
