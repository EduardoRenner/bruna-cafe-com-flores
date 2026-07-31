import { createFileRoute } from "@tanstack/react-router";

// Criação de pedido pelo agente de IA do n8n (WhatsApp).
//
// Usa o MESMO núcleo de validação do checkout do site
// (src/lib/orders/createOrderCore.server.ts): o preço de cada item vem do
// catálogo no banco, nunca do que o agente mandar no corpo da requisição. Se
// a conversa no WhatsApp gerar um payload com preço errado — desatualizado,
// ou por um cliente tentando induzir o agente a aceitar um valor menor — o
// servidor ignora e usa o preço real do produto.

export const Route = createFileRoute("/api/integrations/n8n/pedidos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const responder = (body: Record<string, unknown>, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json; charset=utf-8" },
          });

        const { isN8nIntegrationEnabled, verificarAutenticacaoN8n } = await import(
          "@/lib/integrations/n8n.server"
        );

        if (!isN8nIntegrationEnabled()) return new Response(null, { status: 404 });
        if (!verificarAutenticacaoN8n(request.headers.get("authorization"))) {
          return responder({ erro: "não autorizado" }, 401);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return responder({ erro: "corpo da requisição não é JSON válido" }, 400);
        }
        if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
          return responder({ erro: "corpo da requisição precisa ser um objeto" }, 400);
        }

        const { criarPedido, OrderValidationError } = await import(
          "@/lib/orders/createOrderCore.server"
        );

        // IP de quem chama é o servidor do n8n, não o cliente final do
        // WhatsApp — mas o rate limit ainda protege contra uma automação com
        // bug (ou comprometida) tentando criar pedidos em loop.
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "n8n-desconhecido";

        try {
          const resultado = await criarPedido(payload as never, { clientIp: ip });
          return responder({ ok: true, pedido: resultado });
        } catch (err) {
          if (err instanceof OrderValidationError) {
            return responder({ ok: false, erro: err.message }, 422);
          }
          console.error("[n8n] falha ao criar pedido:", err);
          return responder({ ok: false, erro: "não foi possível registrar o pedido" }, 500);
        }
      },
    },
  },
});
