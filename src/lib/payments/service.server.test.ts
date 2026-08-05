// Regras de pagamento.
//
// O foco aqui é uma garantia que já falhou em produção: reconciliar é um bônus
// oportunista, e nada nele pode derrubar a página em que o cliente confere o
// pagamento. Um SITE_URL com erro de digitação chegou a esvaziar essa tela.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O módulo de banco não existe fora do servidor; a reconciliação nem chega a
// usá-lo nos casos testados aqui, mas o import dinâmico precisa resolver.
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {},
}));

const VARS = ["MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET", "SITE_URL", "VITE_SITE_URL"] as const;
let original: Record<string, string | undefined>;

beforeEach(() => {
  original = {};
  for (const v of VARS) {
    original[v] = process.env[v];
    delete process.env[v];
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const v of VARS) {
    if (original[v] === undefined) delete process.env[v];
    else process.env[v] = original[v];
  }
  vi.restoreAllMocks();
});

async function reconciliar(token = "a".repeat(48)) {
  const { reconciliarPagamentoDoPedido } = await import("./service.server");
  return reconciliarPagamentoDoPedido(token);
}

describe("reconciliarPagamentoDoPedido — nunca derruba quem chama", () => {
  it("REGRESSÃO: SITE_URL malformada não lança, devolve 'desligado'", async () => {
    // O caso real: SITE_URL colada sem o https:// na frente. getPaymentConfig
    // lança de propósito, e a primeira versão deixava o throw subir até a
    // página /pedido/<token>, que ficava vazia logo depois de o cliente pagar.
    process.env.MP_ACCESS_TOKEN = "APP_USR-123";
    process.env.MP_WEBHOOK_SECRET = "segredo";
    process.env.SITE_URL = "bruna-cafe-com-flores.vercel.app";

    await expect(reconciliar()).resolves.toBe("desligado");
  });

  it("SITE_URL http (não https) também não lança", async () => {
    process.env.MP_ACCESS_TOKEN = "APP_USR-123";
    process.env.MP_WEBHOOK_SECRET = "segredo";
    process.env.SITE_URL = "http://loja.exemplo.com.br";

    await expect(reconciliar()).resolves.toBe("desligado");
  });

  it("configuração pela metade não lança", async () => {
    process.env.MP_ACCESS_TOKEN = "APP_USR-123";

    await expect(reconciliar()).resolves.toBe("desligado");
  });

  it("pagamento simplesmente desligado devolve 'desligado'", async () => {
    await expect(reconciliar()).resolves.toBe("desligado");
  });

  it("registra a causa no log em vez de engolir em silêncio", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.MP_ACCESS_TOKEN = "APP_USR-123";
    process.env.MP_WEBHOOK_SECRET = "segredo";
    process.env.SITE_URL = "nao-e-url";

    await reconciliar();
    expect(erro).toHaveBeenCalled();
  });
});
