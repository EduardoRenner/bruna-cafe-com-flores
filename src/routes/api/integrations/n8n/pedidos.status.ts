import { createFileRoute } from "@tanstack/react-router";

// Consulta de status para o agente do n8n responder "onde está meu pedido?".
//
// Recebe o token público do pedido (devolvido na criação em
// /api/integrations/n8n/pedidos), não o número sequencial nem o telefone —
// assim o agente nunca precisa (nem consegue) varrer pedidos de outros
// clientes trocando um parâmetro.

export const Route = createFileRoute("/api/integrations/n8n/pedidos/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
        if (!/^[a-f0-9]{48}$/.test(token)) {
          return responder({ erro: "token inválido" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("get_order_public_status", {
          _token: token,
        });

        if (error) return responder({ erro: "falha ao consultar pedido" }, 500);
        if (!data || data.length === 0) return responder({ erro: "pedido não encontrado" }, 404);

        const o = data[0];
        return responder({
          numeroPedido: o.order_number,
          status: o.status,
          statusPagamento: o.payment_status,
          total: Number(o.total),
          criadoEm: o.created_at,
        });
      },
    },
  },
});
