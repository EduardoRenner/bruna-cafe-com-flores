import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { SYSTEM_PROMPT } from "@/lib/chat-system-prompt";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { messages?: IncomingMessage[] };
          const messages = Array.isArray(body.messages) ? body.messages : [];
          if (messages.length === 0) {
            return new Response(JSON.stringify({ error: "Sem mensagens." }), { status: 400 });
          }

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(JSON.stringify({ error: "Chave da IA não configurada." }), { status: 500 });
          }

          const gateway = createLovableAiGatewayProvider(key);
          const { text } = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            system: SYSTEM_PROMPT,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          });

          return new Response(JSON.stringify({ text }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("chat error", err);
          const status = (err as { statusCode?: number })?.statusCode ?? 500;
          const message =
            status === 429
              ? "Estamos com muitos pedidos agora. Tente novamente em instantes."
              : status === 402
                ? "Os créditos da IA acabaram. A lojista precisa recarregar."
                : "Não consegui responder agora. Tente novamente.";
          return new Response(JSON.stringify({ error: message }), {
            status: status === 429 || status === 402 ? status : 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
