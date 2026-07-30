import { createFileRoute } from "@tanstack/react-router";

// Endpoint que o Mercado Pago chama para avisar o resultado de um pagamento.
//
// É público por natureza — não dá para exigir login de um servidor externo. A
// proteção é a assinatura HMAC conferida em processarWebhook(): sem ela,
// qualquer um que descobrisse esta URL poderia anunciar "pagamento aprovado".
//
// Sempre responde 200 quando a notificação foi recebida e registrada, mesmo se
// nós a rejeitamos. Devolver erro faz o gateway reenviar em loop; o que
// interessa a ele é saber que chegou. O que fizemos com ela fica em
// payment_events.

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const responder = (body: Record<string, unknown>, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json; charset=utf-8" },
          });

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return responder({ recebido: false, motivo: "json_invalido" }, 400);
        }

        const url = new URL(request.url);
        const corpo = (payload ?? {}) as {
          type?: string;
          action?: string;
          data?: { id?: string | number };
        };

        // O id do pagamento pode vir no corpo ou na query, dependendo do tipo
        // de notificação configurada no painel do Mercado Pago.
        const dataId =
          corpo.data?.id != null
            ? String(corpo.data.id)
            : url.searchParams.get("data.id") ?? url.searchParams.get("id");

        const { processarWebhook } = await import("@/lib/payments/service.server");

        const resultado = await processarWebhook({
          signatureHeader: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId,
          eventType: corpo.type ?? corpo.action ?? url.searchParams.get("type"),
          payload,
        });

        // Assinatura inválida devolve 401 de propósito: é a única resposta que
        // não queremos que o remetente interprete como sucesso.
        if (resultado === "assinatura_invalida") {
          return responder({ recebido: false }, 401);
        }

        return responder({ recebido: true, resultado });
      },
    },
  },
});
