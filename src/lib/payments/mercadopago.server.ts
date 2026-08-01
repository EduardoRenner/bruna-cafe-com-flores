// Adaptador do Mercado Pago. SERVER-ONLY.
//
// Usa Checkout Pro (página hospedada por eles). O cliente é redirecionado, digita
// o cartão no domínio do Mercado Pago e volta. Nenhum dado de cartão passa por
// este servidor em momento algum — o que reduz drasticamente o que pode vazar.

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  GatewayPayment,
  PaymentProvider,
  PaymentStatus,
} from "./types";
import {
  descreverConfigParaLog,
  fingerprintSegredo,
  verificarCoerenciaAmbiente,
  type PaymentConfig,
} from "./config.server";

const API = "https://api.mercadopago.com";

/** Vocabulário do Mercado Pago traduzido para o nosso. */
function traduzirStatus(mp: string): PaymentStatus {
  switch (mp) {
    case "approved":
      return "pago";
    case "pending":
    case "in_process":
    case "in_mediation":
    case "authorized":
      return "iniciado";
    case "rejected":
      return "recusado";
    case "refunded":
    case "charged_back":
      return "estornado";
    case "cancelled":
      return "cancelado";
    default:
      // Status novo/desconhecido nunca vira "pago" por engano.
      return "iniciado";
  }
}

/**
 * Reais (float) para centavos (inteiro).
 *
 * `65.10 * 100` dá 6509.999... em ponto flutuante. Sem o arredondamento a
 * conferência de valor recusaria um pagamento correto.
 */
function paraCentavos(valor: number): number {
  return Math.round(valor * 100);
}

/** Formato do pagamento na API do Mercado Pago, igual na consulta e na busca. */
type RespPagamento = {
  id: number | string;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  external_reference?: string | null;
  payment_method_id?: string | null;
};

function traduzirPagamento(p: RespPagamento): GatewayPayment {
  return {
    providerPaymentId: String(p.id),
    status: traduzirStatus(p.status),
    amountCents: paraCentavos(p.transaction_amount),
    externalReference: p.external_reference ?? null,
    method: p.payment_method_id ?? null,
    statusDetail: p.status_detail ?? null,
  };
}

function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual exige mesmo tamanho; comparar o tamanho antes já vaza essa
  // informação, mas o tamanho do hash é público (SHA-256 hex = 64 chars).
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * E-mail identificável o suficiente para conferir "é o comprador que eu usei?",
 * sem despejar o e-mail do cliente no log de deploy.
 */
function mascararEmail(email: string | null | undefined): string {
  if (!email) return "(sem e-mail)";
  const [local, dominio] = email.split("@");
  if (!dominio) return "(inválido)";
  return `${local.slice(0, 2)}***@${dominio}`;
}

/** Janela de tolerância do timestamp do webhook, contra reenvio de notificação antiga. */
const TOLERANCIA_TIMESTAMP_S = 15 * 60;

export function createMercadoPagoProvider(cfg: PaymentConfig): PaymentProvider {
  async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      // A mensagem sobe para o log do servidor, nunca para o cliente — pode
      // conter detalhe da conta. Quem chama devolve texto genérico ao usuário.
      throw new Error(
        `Mercado Pago respondeu ${res.status} em ${caminho}: ${corpo.slice(0, 400)}`,
      );
    }
    return (await res.json()) as T;
  }

  return {
    name: "mercadopago",

    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
      type Resp = { id: string; init_point: string; sandbox_init_point: string };

      // O erro "uma das partes é de teste" é decidido dentro do checkout do
      // Mercado Pago, depois do redirect — daqui a criação da preferência
      // parece um sucesso. Este log é o que sobra para reconstruir o que foi
      // enviado: qual token (por impressão digital), qual ambiente e qual
      // comprador. Sem ele, o único sintoma é a tela de erro no navegador.
      console.info("[pagamento] criando preferência", {
        ...descreverConfigParaLog(cfg),
        paymentId: input.paymentId,
        orderNumber: input.orderNumber,
        amountCents: input.amountCents,
        payerEmail: mascararEmail(input.payer.email),
        notificationUrl: input.notificationUrl,
        returnUrl: input.returnUrl,
      });

      for (const aviso of verificarCoerenciaAmbiente(cfg)) {
        console.warn("[pagamento] ambiente possivelmente incoerente:", aviso);
      }

      const pref = await chamar<Resp>("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id: input.orderNumber,
              title: input.description,
              quantity: 1,
              currency_id: "BRL",
              // O gateway trabalha em reais; nossa fonte de verdade é centavos.
              unit_price: input.amountCents / 100,
            },
          ],
          payer: {
            name: input.payer.name,
            ...(input.payer.email ? { email: input.payer.email } : {}),
          },
          // Como reencontramos nosso pagamento quando a notificação chegar.
          external_reference: input.paymentId,
          notification_url: input.notificationUrl,
          back_urls: {
            success: input.returnUrl,
            pending: input.returnUrl,
            failure: input.returnUrl,
          },
          auto_return: "approved",
          statement_descriptor: "BRUNACAFEFLORES",
        }),
      });

      const redirectUrl = cfg.sandbox ? pref.sandbox_init_point : pref.init_point;

      console.info("[pagamento] preferência criada", {
        preferenceId: pref.id,
        paymentId: input.paymentId,
        // O prefixo do id da preferência é o user id da conta vendedora. É o
        // jeito mais direto de conferir para QUAL conta a cobrança foi criada.
        contaVendedora: pref.id.split("-")[0] ?? "(desconhecida)",
        initPointUsado: cfg.sandbox ? "sandbox_init_point" : "init_point",
        // Se o campo escolhido vier vazio, o cliente é redirecionado para
        // lugar nenhum — vale saber antes de investigar o navegador.
        redirectVazio: !redirectUrl,
      });

      return {
        providerPreferenceId: pref.id,
        redirectUrl,
      };
    },

    async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
      const p = await chamar<RespPagamento>(
        `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      );
      return traduzirPagamento(p);
    },

    async findPaymentByReference(
      externalReference: string,
    ): Promise<GatewayPayment | null> {
      type Resp = { results?: RespPagamento[] };

      const busca = await chamar<Resp>(
        `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`,
      );
      const resultados = busca.results ?? [];
      if (resultados.length === 0) return null;

      // Uma mesma referência pode ter várias tentativas (cartão recusado e
      // depois aprovado, por exemplo). O aprovado é o que importa; sem
      // nenhum aprovado, vale o mais recente.
      const aprovado = resultados.find((p) => p.status === "approved");
      return traduzirPagamento(aprovado ?? resultados[0]);
    },

    /**
     * Confere a assinatura HMAC do webhook.
     *
     * Sem isto, qualquer pessoa que descubra a URL do webhook poderia mandar
     * "pagamento aprovado" e receber flores de graça. O Mercado Pago assina
     * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com o segredo da conta.
     */
    verifyWebhookSignature({
      signatureHeader,
      requestId,
      dataId,
      dataIdAlternativo,
    }): boolean {
      if (!signatureHeader || !dataId) return false;

      // Formato: "ts=1704908010,v1=abc123..."
      let ts: string | null = null;
      let v1: string | null = null;
      for (const parte of signatureHeader.split(",")) {
        const [k, ...resto] = parte.split("=");
        const valor = resto.join("=").trim();
        if (k?.trim() === "ts") ts = valor;
        else if (k?.trim() === "v1") v1 = valor;
      }
      if (!ts || !v1) return false;

      // Notificação antiga reenviada por um atacante não vale.
      const tsNum = Number(ts);
      if (!Number.isFinite(tsNum)) return false;
      const agora = Math.floor(Date.now() / 1000);
      // O ts do MP vem em segundos; toleramos relógio adiantado por 1 min.
      if (Math.abs(agora - tsNum) > TOLERANCIA_TIMESTAMP_S) return false;

      const confere = (candidato: string): boolean => {
        // O Mercado Pago normaliza id alfanumérico para minúsculas no manifesto.
        const id = /^[a-zA-Z0-9]+$/.test(candidato)
          ? candidato.toLowerCase()
          : candidato;
        const manifesto = `id:${id};request-id:${requestId ?? ""};ts:${ts};`;
        const esperado = createHmac("sha256", cfg.webhookSecret)
          .update(manifesto)
          .digest("hex");
        return comparaSegura(esperado, v1!.toLowerCase());
      };

      if (confere(dataId)) return true;

      // Corpo e query podem trazer data.id diferentes. Tentar o segundo
      // candidato custa um HMAC e evita rejeitar notificação legítima.
      if (dataIdAlternativo && dataIdAlternativo !== dataId) {
        if (confere(dataIdAlternativo)) {
          console.warn(
            "[pagamento] assinatura confere com o data.id alternativo, não com o principal",
            { usado: dataIdAlternativo, principal: dataId },
          );
          return true;
        }
      }

      // Nenhum candidato bateu. A causa quase sempre é o segredo errado, e sem
      // a impressão digital não há como saber QUAL segredo está rodando.
      console.warn("[pagamento] nenhum candidato de assinatura conferiu", {
        webhookSecretFingerprint: fingerprintSegredo(cfg.webhookSecret),
        dataId,
        dataIdAlternativo: dataIdAlternativo ?? "(ausente)",
        requestId: requestId ?? "(ausente)",
        ts,
      });
      return false;
    },
  };
}
