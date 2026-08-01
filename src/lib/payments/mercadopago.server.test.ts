// Adaptador do Mercado Pago.
//
// O teste que mais importa aqui é o da assinatura do webhook: sem ela,
// qualquer um que descubra a URL manda "pagamento aprovado" e recebe flores
// de graça. Os demais cobrem a tradução de status e a conversão de valor, que
// são onde um pagamento correto poderia ser recusado (ou o contrário).

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMercadoPagoProvider } from "./mercadopago.server";
import type { PaymentConfig } from "./config.server";

const SEGREDO = "segredo-do-webhook";

const CFG: PaymentConfig = {
  accessToken: "APP_USR-1234567890123456-073101-abcdef-123456789",
  webhookSecret: SEGREDO,
  sandbox: false,
  tokenEnvironment: "producao",
  siteUrl: "https://loja.exemplo.com.br",
};

const provider = createMercadoPagoProvider(CFG);

/** Monta uma assinatura como o Mercado Pago monta. */
function assinar(args: {
  dataId: string;
  requestId?: string | null;
  ts?: number;
  segredo?: string;
}): string {
  const ts = args.ts ?? Math.floor(Date.now() / 1000);
  const id = /^[a-zA-Z0-9]+$/.test(args.dataId)
    ? args.dataId.toLowerCase()
    : args.dataId;
  const manifesto = `id:${id};request-id:${args.requestId ?? ""};ts:${ts};`;
  const v1 = createHmac("sha256", args.segredo ?? SEGREDO)
    .update(manifesto)
    .digest("hex");
  return `ts=${ts},v1=${v1}`;
}

// Os logs de diagnóstico são ruído no output do teste.
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("verifyWebhookSignature", () => {
  it("aceita assinatura legítima", () => {
    const dataId = "123456789";
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1" }),
        requestId: "req-1",
        dataId,
      }),
    ).toBe(true);
  });

  it("recusa assinatura feita com outro segredo", () => {
    const dataId = "123456789";
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1", segredo: "outro" }),
        requestId: "req-1",
        dataId,
      }),
    ).toBe(false);
  });

  it("recusa quando o dataId foi trocado depois de assinar", () => {
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId: "111", requestId: "req-1" }),
        requestId: "req-1",
        dataId: "222",
      }),
    ).toBe(false);
  });

  it("recusa quando o request-id foi trocado depois de assinar", () => {
    const dataId = "123456789";
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1" }),
        requestId: "req-2",
        dataId,
      }),
    ).toBe(false);
  });

  it("recusa notificação antiga reenviada (fora da janela de 15 min)", () => {
    const dataId = "123456789";
    const velho = Math.floor(Date.now() / 1000) - 16 * 60;
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1", ts: velho }),
        requestId: "req-1",
        dataId,
      }),
    ).toBe(false);
  });

  it("recusa timestamp no futuro além da tolerância", () => {
    const dataId = "123456789";
    const futuro = Math.floor(Date.now() / 1000) + 16 * 60;
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1", ts: futuro }),
        requestId: "req-1",
        dataId,
      }),
    ).toBe(false);
  });

  it("aceita dentro da janela", () => {
    const dataId = "123456789";
    const recente = Math.floor(Date.now() / 1000) - 14 * 60;
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1", ts: recente }),
        requestId: "req-1",
        dataId,
      }),
    ).toBe(true);
  });

  it.each([
    ["header ausente", null, "123"],
    ["dataId ausente", "ts=1,v1=abc", null],
    ["header sem v1", "ts=1", "123"],
    ["header sem ts", "v1=abc", "123"],
    ["header vazio", "", "123"],
    ["lixo", "nada-a-ver", "123"],
  ])("recusa por %s", (_nome, header, dataId) => {
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: header,
        requestId: "req-1",
        dataId,
      }),
    ).toBe(false);
  });

  it("recusa ts não numérico", () => {
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: "ts=abc,v1=" + "0".repeat(64),
        requestId: "req-1",
        dataId: "123",
      }),
    ).toBe(false);
  });

  it("normaliza dataId alfanumérico para minúsculas, como o Mercado Pago faz", () => {
    const dataId = "ABC123";
    // assinar() aplica a mesma normalização; o teste garante que a
    // verificação aceita o id vindo em maiúsculas no header.
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: assinar({ dataId, requestId: "req-1" }),
        requestId: "req-1",
        dataId,
      }),
    ).toBe(true);
  });

  it("aceita o hex do v1 em maiúsculas", () => {
    const dataId = "123456789";
    const header = assinar({ dataId, requestId: "req-1" });
    // Só o VALOR em maiúsculas. A chave é sempre "v1" minúsculo no header do
    // Mercado Pago, e o parser procura por ela literalmente.
    const [ts, v1] = header.split(",");
    const hexMaiusculo = v1.slice("v1=".length).toUpperCase();
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: `${ts},v1=${hexMaiusculo}`,
        requestId: "req-1",
        dataId,
      }),
    ).toBe(true);
  });

  it("recusa v1 de tamanho errado sem estourar", () => {
    expect(
      provider.verifyWebhookSignature({
        signatureHeader: "ts=" + Math.floor(Date.now() / 1000) + ",v1=abc",
        requestId: "req-1",
        dataId: "123",
      }),
    ).toBe(false);
  });
});

describe("fetchPayment", () => {
  function responder(corpo: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })),
    );
  }

  it.each([
    ["approved", "pago"],
    ["pending", "iniciado"],
    ["in_process", "iniciado"],
    ["authorized", "iniciado"],
    ["rejected", "recusado"],
    ["refunded", "estornado"],
    ["charged_back", "estornado"],
    ["cancelled", "cancelado"],
  ])("traduz %s para %s", async (mp, nosso) => {
    responder({ id: 1, status: mp, transaction_amount: 10 });
    expect((await provider.fetchPayment("1")).status).toBe(nosso);
  });

  it("status desconhecido nunca vira 'pago' por engano", async () => {
    responder({ id: 1, status: "status_que_nao_existe_ainda", transaction_amount: 10 });
    expect((await provider.fetchPayment("1")).status).toBe("iniciado");
  });

  it("converte reais para centavos sem erro de ponto flutuante", async () => {
    // 65.10 * 100 dá 6509.999... em float; sem arredondar, a conferência de
    // valor recusaria um pagamento correto.
    responder({ id: 1, status: "approved", transaction_amount: 65.1 });
    expect((await provider.fetchPayment("1")).amountCents).toBe(6510);
  });

  it("preserva a referência externa, que é como reencontramos o pagamento", async () => {
    responder({
      id: 99,
      status: "approved",
      transaction_amount: 10,
      external_reference: "uuid-do-pagamento",
    });
    const p = await provider.fetchPayment("99");
    expect(p.externalReference).toBe("uuid-do-pagamento");
    expect(p.providerPaymentId).toBe("99");
  });

  it("erro da API sobe com status e corpo, para o log do servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("conta bloqueada", { status: 403 })),
    );
    await expect(provider.fetchPayment("1")).rejects.toThrow(/403/);
  });
});

describe("createCheckout", () => {
  /** Responde uma preferência e guarda os corpos enviados, já tipados. */
  function responderPreferencia() {
    const corpos: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        corpos.push(String(init?.body ?? ""));
        return new Response(
          JSON.stringify({
            id: "3579991113-abc",
            init_point: "https://mp/producao",
            sandbox_init_point: "https://mp/sandbox",
          }),
          { status: 200 },
        );
      }),
    );
    return corpos;
  }

  const entrada = {
    paymentId: "uuid-do-pagamento",
    orderNumber: "BCF-1000",
    amountCents: 6000,
    description: "Pedido BCF-1000",
    payer: { name: "Fulana", email: "fulana@exemplo.com" },
    returnUrl: "https://loja.exemplo.com.br/pedido/tok",
    notificationUrl: "https://loja.exemplo.com.br/api/webhooks/mercadopago",
  };

  it("manda o valor em reais, a partir dos centavos que são nossa fonte de verdade", async () => {
    const corpos = responderPreferencia();
    await provider.createCheckout(entrada);
    const corpo = JSON.parse(corpos[0]);
    expect(corpo.items[0].unit_price).toBe(60);
    expect(corpo.external_reference).toBe("uuid-do-pagamento");
    expect(corpo.notification_url).toBe(entrada.notificationUrl);
  });

  it("token de produção usa init_point", async () => {
    responderPreferencia();
    const s = await provider.createCheckout(entrada);
    expect(s.redirectUrl).toBe("https://mp/producao");
  });

  it("token de teste usa sandbox_init_point", async () => {
    responderPreferencia();
    const sandbox = createMercadoPagoProvider({
      ...CFG,
      sandbox: true,
      tokenEnvironment: "teste",
    });
    const s = await sandbox.createCheckout(entrada);
    expect(s.redirectUrl).toBe("https://mp/sandbox");
  });

  it("devolve o id da preferência, cujo prefixo identifica a conta vendedora", async () => {
    responderPreferencia();
    const s = await provider.createCheckout(entrada);
    expect(s.providerPreferenceId).toBe("3579991113-abc");
  });

  it("não manda email do pagador quando não existe", async () => {
    const corpos = responderPreferencia();
    await provider.createCheckout({
      ...entrada,
      payer: { name: "Fulana", email: null },
    });
    const corpo = JSON.parse(corpos[0]);
    expect(corpo.payer).not.toHaveProperty("email");
  });

  it("o log de diagnóstico não vaza o access token nem o e-mail inteiro", async () => {
    responderPreferencia();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await provider.createCheckout(entrada);
    const texto = JSON.stringify(info.mock.calls);
    expect(texto).not.toContain(CFG.accessToken);
    expect(texto).not.toContain("fulana@exemplo.com");
    expect(texto).toContain("fu***@exemplo.com");
  });
});
