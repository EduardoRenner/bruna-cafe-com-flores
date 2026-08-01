// Regras de pagamento. SERVER-ONLY.
//
// O adaptador de gateway (mercadopago.server.ts) só sabe falar com a API de
// fora. As garantias que protegem a loja e o cliente moram aqui:
//
//   1. O valor cobrado vem SEMPRE do pedido no banco, nunca do navegador.
//   2. O corpo do webhook não é fonte de verdade — reconsultamos a API.
//   3. Notificação repetida não gera efeito repetido.
//   4. Valor divergente nunca vira "pago" sozinho.

import { store } from "@/lib/store-info";
import { getPaymentConfig } from "./config.server";
import { createMercadoPagoProvider } from "./mercadopago.server";
import type { GatewayPayment, PaymentProvider } from "./types";

function getProvider(): { provider: PaymentProvider; siteUrl: string } | null {
  let cfg;
  try {
    cfg = getPaymentConfig();
  } catch (err) {
    // getPaymentConfig lança de propósito: configuração pela metade não pode
    // virar cobrança. Mas quem chama aqui precisa tratar "quebrado" como
    // "desligado", e não deixar a exceção subir.
    //
    // Isto já custou caro uma vez: com SITE_URL malformada, o throw subia pela
    // reconciliação até a página /pedido/<token> e derrubava exatamente a tela
    // em que o cliente vai conferir o pagamento que acabou de fazer. Um erro
    // de digitação numa variável de ambiente não pode ter esse alcance.
    console.error("[pagamento] configuração inválida — tratando como desligado:", err);
    return null;
  }
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

    const { resultado, erro } = await aplicarConfirmacao(pago);

    if (erro) {
      await marcarProcessado(eventoId, p.provider.name, erro);
      return "erro";
    }

    await marcarProcessado(eventoId, p.provider.name, null, pago.externalReference);
    return resultado;
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

/**
 * Aplica no banco o que o gateway confirmou.
 *
 * Um único caminho para os dois gatilhos — o webhook e a reconciliação — para
 * que "marcar como pago" signifique exatamente a mesma coisa nos dois. Se
 * fossem implementações separadas, um dia uma delas ganharia uma regra que a
 * outra não tem, e o pedido ficaria diferente dependendo de quem chegou antes.
 */
async function aplicarConfirmacao(
  pago: GatewayPayment,
): Promise<{ resultado: WebhookResultado; erro?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: resultado, error } = await supabaseAdmin.rpc("confirm_payment", {
    _payment_id: pago.externalReference!,
    _provider_payment_id: pago.providerPaymentId,
    _gateway_status: pago.status,
    _gateway_amount_cents: pago.amountCents,
    // A RPC gerada tipa estes como opcionais; null vira ausente.
    _method: pago.method ?? undefined,
    _status_detail: pago.statusDetail ?? undefined,
  });

  if (error) return { resultado: "erro", erro: error.message };

  if (resultado === "valor_divergente") {
    console.error("[pagamento] VALOR DIVERGENTE — conferir manualmente", {
      paymentId: pago.externalReference,
    });
    return { resultado: "valor_divergente" };
  }

  if (resultado === "ja_processado") return { resultado: "ja_processado" };

  // Só avisa quando ESTA chamada foi a que confirmou. A idempotência da RPC
  // garante que uma notificação reenviada devolve "ja_processado" e não gera
  // um segundo WhatsApp para a loja.
  if (pago.status === "pago") {
    await avisarLojaPagamentoConfirmado(pago.externalReference!);
  }

  return { resultado: "aplicado" };
}

/**
 * Avisa a loja no WhatsApp que um pedido foi pago.
 *
 * Nunca propaga erro: falha ao notificar não pode derrubar a confirmação do
 * pagamento. O evento já foi marcado como processado neste ponto, então um
 * throw aqui faria o gateway reenviar a notificação para sempre sem nunca
 * conseguir aplicá-la — o pedido ficaria pendente por causa de uma mensagem.
 */
async function avisarLojaPagamentoConfirmado(paymentId: string): Promise<void> {
  try {
    const { getWhatsAppConfig } = await import("@/lib/whatsapp/config.server");
    const cfg = getWhatsAppConfig();
    if (!cfg) return; // Agente desligado: nada a fazer.

    const destino =
      process.env.WHATSAPP_NOTIFICACAO_TO?.trim() || store.whatsappDigits;
    if (!destino) return;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pagamento } = await supabaseAdmin
      .from("payments")
      .select("amount_cents, method, orders(order_number, customer_name, delivery_type)")
      .eq("id", paymentId)
      .maybeSingle();

    const pedido = pagamento?.orders as
      | { order_number: string; customer_name: string; delivery_type: string | null }
      | null
      | undefined;
    if (!pedido) return;

    const valor = ((pagamento?.amount_cents ?? 0) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const { sendWhatsAppText } = await import("@/lib/whatsapp/meta.server");
    await sendWhatsAppText(
      cfg,
      destino,
      `💐 Pagamento confirmado\n\n` +
        `Pedido ${pedido.order_number}\n` +
        `Cliente: ${pedido.customer_name}\n` +
        `Valor: ${valor}\n` +
        (pagamento?.method ? `Forma: ${pagamento.method}\n` : "") +
        (pedido.delivery_type === "retirada" ? `Retirada na loja\n` : "") +
        `\nO pedido já entrou em preparo no painel.`,
    );
  } catch (err) {
    console.error("[pagamento] falha ao avisar a loja (pagamento segue confirmado):", err);
  }
}

export type ReconciliacaoResultado =
  | "aplicado"
  | "sem_mudanca"
  | "nao_encontrado"
  | "desligado"
  | "erro";

/**
 * Pergunta ao gateway como está o pagamento deste pedido e aplica o resultado.
 *
 * Rede de segurança para quando o webhook não resolve — e ele falha de formas
 * silenciosas: URL de notificação apontando para outro ambiente, assinatura
 * que não confere, notificação simplesmente perdida. Sem isto, um pagamento
 * aprovado de verdade fica pendente até alguém conferir na mão.
 *
 * Consulta pelo nosso `payments.id`, que mandamos ao gateway como referência
 * externa — então não depende de ter recebido nenhum id do lado deles.
 */
export async function reconciliarPagamentoDoPedido(
  orderPublicToken: string,
): Promise<ReconciliacaoResultado> {
  // NUNCA lança. Quem chama isto está no meio de servir uma página ao cliente;
  // reconciliar é um bônus oportunista, e nenhum problema aqui — gateway fora,
  // banco lento, variável de ambiente errada — pode impedir o pedido de
  // aparecer na tela. O try envolve tudo, inclusive a leitura de configuração,
  // porque foi justamente ela que escapou da primeira versão.
  try {
    return await reconciliar(orderPublicToken);
  } catch (err) {
    console.error("[pagamento] falha ao reconciliar:", err);
    return "erro";
  }
}

async function reconciliar(
  orderPublicToken: string,
): Promise<ReconciliacaoResultado> {
  const p = getProvider();
  if (!p) return "desligado";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pedido } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status")
    .eq("public_token", orderPublicToken)
    .maybeSingle();

  if (!pedido) return "nao_encontrado";
  // Já resolvido: não custa nada ao gateway perguntar de novo.
  if (pedido.payment_status === "pago") return "sem_mudanca";

  // Só tentativas ainda em aberto. Uma recusada continua recusada; reconsultar
  // todas transformaria cada visita à página numa rajada de chamadas.
  const { data: pagamentos } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("order_id", pedido.id)
    .eq("status", "iniciado");

  if (!pagamentos || pagamentos.length === 0) return "sem_mudanca";

  try {
    for (const pagamento of pagamentos) {
      const doGateway = await p.provider.findPaymentByReference(pagamento.id);
      // Sem pagamento do lado deles = cliente abriu o checkout e não pagou.
      if (!doGateway) continue;
      if (doGateway.status === "iniciado") continue;

      const { resultado } = await aplicarConfirmacao({
        ...doGateway,
        externalReference: pagamento.id,
      });
      if (resultado === "aplicado" || resultado === "valor_divergente") {
        console.info("[pagamento] reconciliação aplicou status do gateway", {
          paymentId: pagamento.id,
          status: doGateway.status,
          resultado,
        });
        return "aplicado";
      }
    }
    return "sem_mudanca";
  } catch (err) {
    // Reconciliação é oportunista: se o gateway está fora do ar, a página do
    // pedido ainda precisa carregar.
    console.error("[pagamento] falha ao reconciliar:", err);
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
