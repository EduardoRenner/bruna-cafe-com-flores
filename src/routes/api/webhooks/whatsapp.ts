import { createFileRoute } from "@tanstack/react-router";

// Webhook da WhatsApp Cloud API — recebe mensagens e responde com o agente.
//
// GET: handshake de verificação (a Meta chama uma vez ao cadastrar a URL).
// POST: mensagens de verdade chegam aqui. Sempre responde 200 rápido — a Meta
// reenvia em loop se não receber 200 a tempo, então processamos e só depois
// respondemos, aceitando o pequeno risco de reprocessar (mitigado pela
// idempotência via message_id).

export const Route = createFileRoute("/api/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getWhatsAppConfig } = await import("@/lib/whatsapp/config.server");
        const cfg = getWhatsAppConfig();
        if (!cfg) return new Response(null, { status: 404 });

        const { verifyWebhookChallenge } = await import("@/lib/whatsapp/meta.server");
        const url = new URL(request.url);
        const challenge = verifyWebhookChallenge(
          {
            mode: url.searchParams.get("hub.mode"),
            token: url.searchParams.get("hub.verify_token"),
            challenge: url.searchParams.get("hub.challenge"),
          },
          cfg.verifyToken,
        );
        if (challenge === null) return new Response(null, { status: 403 });
        return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
      },

      POST: async ({ request }) => {
        const { getWhatsAppConfig } = await import("@/lib/whatsapp/config.server");
        const cfg = getWhatsAppConfig();
        // Responde 200 mesmo desligado: não é a Meta que decide se o agente
        // está ativo, e não queremos reenvio em loop por uma conta ainda não
        // configurada.
        if (!cfg) return new Response(JSON.stringify({ recebido: true, resultado: "desligado" }), { status: 200 });

        const rawBody = await request.text();
        const { verifyMetaSignature, parseIncomingMessages, sendWhatsAppText } = await import(
          "@/lib/whatsapp/meta.server"
        );

        const assinaturaOk = verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), cfg.appSecret);
        if (!assinaturaOk) {
          console.warn("[whatsapp] webhook com assinatura inválida — ignorado");
          return new Response(JSON.stringify({ recebido: false }), { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ recebido: false, motivo: "json_invalido" }), { status: 400 });
        }

        const mensagens = parseIncomingMessages(payload);
        if (mensagens.length === 0) {
          // Notificação de status de entrega, ou tipo de mídia que não tratamos ainda.
          return new Response(JSON.stringify({ recebido: true, resultado: "sem_mensagem_de_texto" }), { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processarMensagem } = await import("@/lib/whatsapp/agent.server");

        for (const msg of mensagens) {
          // Idempotência: a Meta reenvia a mesma notificação se demorarmos a
          // responder. message_id é único por mensagem no WhatsApp.
          const { error: erroIdempotencia } = await supabaseAdmin
            .from("whatsapp_message_events")
            .insert({ message_id: msg.messageId, phone: msg.from });
          if (erroIdempotencia) {
            // 23505 = já processamos esta mensagem antes.
            if ((erroIdempotencia as { code?: string }).code === "23505") continue;
            console.error("[whatsapp] falha ao registrar evento:", erroIdempotencia);
            continue;
          }

          const { data: podeResponder } = await supabaseAdmin.rpc("check_whatsapp_rate_limit", { _phone: msg.from });
          if (!podeResponder) {
            console.warn("[whatsapp] rate limit atingido para", msg.from);
            continue;
          }

          const { data: conversa } = await supabaseAdmin
            .from("whatsapp_conversations")
            .select("history,human_takeover")
            .eq("phone", msg.from)
            .maybeSingle();

          // A Bruna assumiu a conversa manualmente: o agente fica quieto até
          // alguém reativar (via admin — ver TODO em docs/agente-whatsapp.md).
          if (conversa?.human_takeover) continue;

          const historico = Array.isArray(conversa?.history) ? conversa.history : [];

          try {
            const resposta = await processarMensagem(cfg, msg.from, msg.text, historico as never);

            await supabaseAdmin.from("whatsapp_conversations").upsert(
              {
                phone: msg.from,
                history: resposta.novoHistorico as never,
                human_takeover: resposta.encerrarParaHumano,
                last_message_at: new Date().toISOString(),
              },
              { onConflict: "phone" },
            );

            await sendWhatsAppText(cfg, msg.from, resposta.texto);
          } catch (err) {
            console.error("[whatsapp] falha ao processar mensagem:", err);
            // Mesmo em erro, tenta avisar o cliente em vez de deixar sem resposta.
            try {
              await sendWhatsAppText(
                cfg,
                msg.from,
                "Deu uma travadinha aqui do meu lado, um instante que já te respondo!",
              );
            } catch {
              /* se nem isso funcionar, só loga e segue — não pode derrubar o webhook */
            }
          }
        }

        return new Response(JSON.stringify({ recebido: true }), { status: 200 });
      },
    },
  },
});
