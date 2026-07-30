// Regras de pagamento. SERVER-ONLY.
//
// O adaptador de gateway (mercadopago.server.ts) só sabe falar com a API de
// fora. As garantias que protegem a loja e o cliente moram aqui:
//
//   1. O valor cobrado vem SEMPRE do pedido no banco, nunca do navegador.
//   2. O corpo do webhook não é fonte de verdade — reconsultamos a API.
//   3. Notificação repetida não gera efeito repetido.
//   4. Valor divergente nunca vira "pago" sozinho.

import { getPaymentConfig } from "./config.server";
import { createMercadoPagoProvider } from "./mercadopago.server";
import type { PaymentProvider } from "./types";

function getProvider(): { provider: PaymentProvider; siteUrl: string } | null {
  const cfg = getPaymentConfig();
  if (!cfg) return null;
  return { provider: createMercadoPagoProvider(cfg), siteUrl: cfg.siteUrl };
}

/** Teto de tentativas por pedido, para o endpoint não virar gerador infinito de cobranças. */
const MAX_TENTATIVAS_POR_PEDIDO = 10;

export type CriarPagamentoResultado =
  | { ok: true; redirectUrl: string }
  | { ok: false; motivo: "desligado" | "pedido_invalido" | "ja_pago" | "excesso_tentativas" | "falha_gateway" };

/**
 * Cria um checkout para um pedido existente.
 *
 * Recebe o token público do pedido (aleatório), não o número sequencial: assim
 * ninguém consegue gerar cobrança para o pedido de outra pessoa trocando um
 * número na requisição.
 */
export async function criarPagamentoParaPedido(
  orderPublicToken: string,
): Promise<CriarPagamentoResultado> {
  const p = getProvider();
  if (!p) return { ok: false, motivo: "desligado" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, status, payment_status, customer_name, customer_email")
    .eq("public_token", orderPublicToken)
    .maybeSingle();

  if (erroPedido || !pedido) return { ok: false, motivo: "pedido_invalido" };
  if (pedido.payment_status === "pago") return { ok: false, motivo: "ja_pago" };
  if (pedido.status === "cancelado") return { ok: false, motivo: "pedido_invalido" };

  const { count } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", pedido.id);
  if ((count ?? 0) >= MAX_TENTATIVAS_POR_PEDIDO) {
    return { ok: false, motivo: "excesso_tentativas" };
  }

  // A fonte de verdade do valor. O cliente não manda preço em lugar nenhum
  // deste fluxo — o total já foi calculado no servidor a partir do catálogo.
  const amountCents = Math.round(Number(pedido.total) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, motivo: "pedido_invalido" };
  }

  const { data: pagamento, error: erroPagamento } = await supabaseAdmin
    .from("payments")
    .insert({
      order_id: pedido.id,
      provider: p.provider.name,
      amount_cents: amountCents,
      status: "iniciado",
    })
    .select("id")
    .single();

  if (erroPagamento || !pagamento) return { ok: false, motivo: "falha_gateway" };

  try {
    const sessao = await p.provider.createCheckout({
      paymentId: pagamento.id,
      orderNumber: pedido.order_number,
      amountCents,
      description: `Pedido ${pedido.order_number} — Bruna Café com Flores`,
      payer: {
        name: pedido.customer_name,
        email: pedido.customer_email,
      },
      returnUrl: `${p.siteUrl}/pedido/${orderPublicToken}`,
      notificationUrl: `${p.siteUrl}/api/webhooks/mercadopago`,
    });

    await supabaseAdmin
      .from("payments")
      .update({ provider_preference_id: sessao.providerPreferenceId })
      .eq("id", pagamento.id);

    return { ok: true, redirectUrl: sessao.redirectUrl };
  } catch (err) {
    // Detalhe do gateway fica no log do servidor; o cliente recebe texto genérico.
    console.error("[pagamento] falha ao criar checkout:", err);
    await supabaseAdmin
      .from("payments")
      .update({ status: "cancelado", status_detail: "falha ao criar checkout" })
      .eq("id", pagamento.id);
    return { ok: false, motivo: "falha_gateway" };
  }
}

export type WebhookResultado =
  | "aplicado"
  | "ja_processado"
  | "assinatura_invalida"
  | "ignorado"
  | "valor_divergente"
  | "erro";

/**
 * Processa uma notificação do gateway.
 *
 * Toda notificação é registrada em payment_events ANTES de qualquer decisão,
 * inclusive as com assinatura inválida — se um dia alguém tentar forjar
 * confirmação de pagamento, a tentativa fica gravada.
 */
export async function processarWebhook(args: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  eventType: string | null;
  payload: unknown;
}): Promise<WebhookResultado> {
  const p = getProvider();
  if (!p) return "ignorado";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const assinaturaOk = p.provider.verifyWebhookSignature({
    signatureHeader: args.signatureHeader,
    requestId: args.requestId,
    dataId: args.dataId,
  });

  // Chave de idempotência. Sem data.id não há o que processar.
  const eventoId = args.dataId ?? `sem-id-${Date.now()}`;

  const { error: erroInsert } = await supabaseAdmin.from("payment_events").insert({
    provider: p.provider.name,
    provider_event_id: eventoId,
    event_type: args.eventType,
    payload: args.payload as never,
    signature_valid: assinaturaOk,
    processed: false,
  });

  if (erroInsert) {
    // 23505 = violação de índice único: já recebemos esta notificação antes.
    if ((erroInsert as { code?: string }).code === "23505") return "ja_processado";
    console.error("[pagamento] falha ao registrar evento:", erroInsert);
    return "erro";
  }

  if (!assinaturaOk) {
    console.warn("[pagamento] webhook com assinatura inválida — ignorado", {
      dataId: args.dataId,
    });
    return "assinatura_invalida";
  }

  // Só notificação de pagamento interessa; MP manda outros tipos.
  if (args.eventType && !args.eventType.startsWith("payment")) {
    await marcarProcessado(eventoId, p.provider.name, null);
    return "ignorado";
  }

  try {
    // Fonte de verdade: a API do gateway, não o corpo que chegou.
    const pago = await p.provider.fetchPayment(args.dataId!);

    if (!pago.externalReference) {
      await marcarProcessado(eventoId, p.provider.name, "sem external_reference");
      return "ignorado";
    }

    const { data: resultado, error } = await supabaseAdmin.rpc("confirm_payment", {
      _payment_id: pago.externalReference,
      _provider_payment_id: pago.providerPaymentId,
      _gateway_status: pago.status,
      _gateway_amount_cents: pago.amountCents,
      // A RPC gerada tipa estes como opcionais; null vira ausente.
      _method: pago.method ?? undefined,
      _status_detail: pago.statusDetail ?? undefined,
    });

    if (error) {
      await marcarProcessado(eventoId, p.provider.name, error.message);
      return "erro";
    }

    await marcarProcessado(eventoId, p.provider.name, null, pago.externalReference);

    if (resultado === "valor_divergente") {
      console.error("[pagamento] VALOR DIVERGENTE — conferir manualmente", {
        paymentId: pago.externalReference,
      });
      return "valor_divergente";
    }
    return resultado === "ja_processado" ? "ja_processado" : "aplicado";
  } catch (err) {
    console.error("[pagamento] falha ao processar webhook:", err);
    await marcarProcessado(
      eventoId,
      p.provider.name,
      err instanceof Error ? err.message : String(err),
    );
    return "erro";
  }
}

async function marcarProcessado(
  eventoId: string,
  provider: string,
  erro: string | null,
  paymentId?: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("payment_events")
    .update({
      processed: erro === null,
      error: erro,
      ...(paymentId ? { payment_id: paymentId } : {}),
    })
    .eq("provider", provider)
    .eq("provider_event_id", eventoId);
}
