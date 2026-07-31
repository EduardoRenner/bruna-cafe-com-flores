// Adaptador da WhatsApp Cloud API (Meta), direto — sem BSP/intermediário.
// SERVER-ONLY.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsAppConfig } from "./config.server";

const API = "https://graph.facebook.com/v21.0";

function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Confere a assinatura do webhook (header X-Hub-Signature-256).
 *
 * Sem isso, qualquer um que descobrisse a URL do webhook poderia mandar
 * mensagens falsas em nome de um cliente, fazendo o agente "conversar" com um
 * atacante se passando por número de outra pessoa, ou gerar custo enviando
 * respostas para números arbitrários.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const recebida = signatureHeader.slice("sha256=".length);
  const esperada = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return comparaSegura(esperada, recebida);
}

/** Handshake de verificação do webhook (GET, feito uma vez ao cadastrar a URL no painel da Meta). */
export function verifyWebhookChallenge(
  params: { mode: string | null; token: string | null; challenge: string | null },
  verifyToken: string,
): string | null {
  if (params.mode === "subscribe" && params.token && comparaSegura(params.token, verifyToken)) {
    return params.challenge;
  }
  return null;
}

export async function sendWhatsAppText(cfg: WhatsAppConfig, to: string, text: string): Promise<void> {
  const res = await fetch(`${API}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text, preview_url: false },
    }),
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    // Detalhe fica só no log do servidor — pode conter dado da conta da Meta.
    throw new Error(`Meta respondeu ${res.status} ao enviar mensagem: ${corpo.slice(0, 400)}`);
  }
}

/** Formato que a Meta manda em cada notificação de mensagem recebida. */
export type IncomingWhatsAppMessage = {
  messageId: string;
  from: string;
  text: string;
  timestamp: string;
};

/** Extrai as mensagens de texto do corpo bruto do webhook. Ignora status de entrega, mídia, etc. — v1 só texto. */
export function parseIncomingMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const out: IncomingWhatsAppMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const m of messages) {
        const msg = m as { id?: string; from?: string; type?: string; text?: { body?: string }; timestamp?: string };
        if (msg.type !== "text" || !msg.id || !msg.from || !msg.text?.body) continue;
        out.push({ messageId: msg.id, from: msg.from, text: msg.text.body, timestamp: msg.timestamp ?? "" });
      }
    }
  }
  return out;
}
