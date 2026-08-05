// Guardas de configuração do pagamento.
//
// O que se protege aqui: (a) segredo nunca chega ao navegador, (b) configuração
// pela metade não vira checkout que aceita dinheiro sem conseguir validar
// webhook, (c) o resumo que vai para o log não vaza o segredo que resume.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  descreverConfigParaLog,
  getPaymentConfig,
  isPaymentEnabled,
  verificarCoerenciaAmbiente,
  type PaymentConfig,
} from "./config.server";

const TOKEN_PROD = "APP_USR-1234567890123456-073101-abcdef-123456789";
const TOKEN_TESTE = "TEST-1234567890123456-073101-abcdef-123456789";
const SEGREDO = "segredo-do-webhook";

/** Variáveis que cada teste zera, para um não vazar no outro. */
const VARS = [
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "SITE_URL",
  "VITE_SITE_URL",
  "VITE_MP_ACCESS_TOKEN",
  "VITE_MP_WEBHOOK_SECRET",
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

let original: Record<string, string | undefined>;

beforeEach(() => {
  original = {};
  for (const v of VARS) {
    original[v] = process.env[v];
    delete process.env[v];
  }
});

afterEach(() => {
  for (const v of VARS) {
    if (original[v] === undefined) delete process.env[v];
    else process.env[v] = original[v];
  }
  vi.restoreAllMocks();
});

function configurar(over: Partial<Record<string, string>> = {}) {
  process.env.MP_ACCESS_TOKEN = TOKEN_PROD;
  process.env.MP_WEBHOOK_SECRET = SEGREDO;
  process.env.SITE_URL = "https://loja.exemplo.com.br";
  for (const [k, v] of Object.entries(over)) process.env[k] = v;
}

describe("getPaymentConfig — pagamento desligado", () => {
  it("devolve null quando nada foi configurado", () => {
    expect(getPaymentConfig()).toBeNull();
  });

  it("null é o estado normal, não erro: o site segue só com WhatsApp", () => {
    expect(isPaymentEnabled()).toBe(false);
  });
});

describe("getPaymentConfig — configuração pela metade", () => {
  it("recusa token sem segredo de webhook", () => {
    process.env.MP_ACCESS_TOKEN = TOKEN_PROD;
    process.env.SITE_URL = "https://loja.exemplo.com.br";
    expect(() => getPaymentConfig()).toThrow(/MP_WEBHOOK_SECRET/);
  });

  it("recusa segredo sem token", () => {
    process.env.MP_WEBHOOK_SECRET = SEGREDO;
    process.env.SITE_URL = "https://loja.exemplo.com.br";
    expect(() => getPaymentConfig()).toThrow(/MP_ACCESS_TOKEN/);
  });

  it("recusa credenciais sem SITE_URL", () => {
    process.env.MP_ACCESS_TOKEN = TOKEN_PROD;
    process.env.MP_WEBHOOK_SECRET = SEGREDO;
    expect(() => getPaymentConfig()).toThrow(/SITE_URL/);
  });

  it("configuração quebrada desliga o botão de pagar em vez de vazar erro ao cliente", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.MP_ACCESS_TOKEN = TOKEN_PROD;
    expect(isPaymentEnabled()).toBe(false);
    // Mas não em silêncio — sumiço silencioso do checkout já custou caro.
    expect(erro).toHaveBeenCalled();
  });
});

describe("getPaymentConfig — SITE_URL", () => {
  it("exige https, senão retorno e webhook trafegariam em texto puro", () => {
    configurar({ SITE_URL: "http://loja.exemplo.com.br" });
    expect(() => getPaymentConfig()).toThrow(/https/);
  });

  it("recusa URL inválida", () => {
    configurar({ SITE_URL: "isto-nao-e-url" });
    expect(() => getPaymentConfig()).toThrow(/SITE_URL inválida/);
  });

  it("normaliza para a origem, descartando caminho e query", () => {
    configurar({ SITE_URL: "https://loja.exemplo.com.br/checkout?a=1" });
    expect(getPaymentConfig()!.siteUrl).toBe("https://loja.exemplo.com.br");
  });

  it("aceita VITE_SITE_URL como alternativa (a URL pública não é segredo)", () => {
    process.env.MP_ACCESS_TOKEN = TOKEN_PROD;
    process.env.MP_WEBHOOK_SECRET = SEGREDO;
    process.env.VITE_SITE_URL = "https://loja.exemplo.com.br";
    expect(getPaymentConfig()!.siteUrl).toBe("https://loja.exemplo.com.br");
  });
});

describe("getPaymentConfig — segredo não pode ir para o navegador", () => {
  it.each([
    "VITE_MP_ACCESS_TOKEN",
    "VITE_MP_WEBHOOK_SECRET",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
  ])("derruba o servidor se %s existir", (nome) => {
    configurar({ [nome]: "valor-qualquer" });
    expect(() => getPaymentConfig()).toThrow(new RegExp(nome));
  });

  it("string vazia não conta como exposta", () => {
    configurar({ VITE_MP_ACCESS_TOKEN: "" });
    expect(() => getPaymentConfig()).not.toThrow();
  });
});

describe("getPaymentConfig — classificação do token", () => {
  it("TEST- é teste e usa o init point de sandbox", () => {
    configurar({ MP_ACCESS_TOKEN: TOKEN_TESTE });
    const cfg = getPaymentConfig()!;
    expect(cfg.tokenEnvironment).toBe("teste");
    expect(cfg.sandbox).toBe(true);
  });

  it("APP_USR- não é teste", () => {
    configurar();
    const cfg = getPaymentConfig()!;
    expect(cfg.tokenEnvironment).toBe("producao");
    expect(cfg.sandbox).toBe(false);
  });

  it("prefixo desconhecido não vira 'producao' por omissão", () => {
    configurar({ MP_ACCESS_TOKEN: "sei-la-o-que-e-isso" });
    expect(getPaymentConfig()!.tokenEnvironment).toBe("desconhecido");
  });

  it("usuário de teste usa APP_USR-, então 'producao' não prova conta real", () => {
    // Documenta a armadilha: o prefixo não distingue conta real de usuário de
    // teste. Só o User ID do vendedor responde isso.
    configurar();
    expect(getPaymentConfig()!.sandbox).toBe(false);
  });
});

describe("descreverConfigParaLog", () => {
  function cfg(): PaymentConfig {
    configurar();
    return getPaymentConfig()!;
  }

  it("nunca inclui o valor de nenhum segredo", () => {
    const texto = JSON.stringify(descreverConfigParaLog(cfg()));
    expect(texto).not.toContain(TOKEN_PROD);
    expect(texto).not.toContain(SEGREDO);
    // Nem um pedaço reconhecível dele.
    expect(texto).not.toContain("1234567890123456");
  });

  it("mostra o prefixo, que identifica o ambiente sem identificar a conta", () => {
    expect(descreverConfigParaLog(cfg()).tokenPrefixo).toBe("APP_USR");
  });

  it("a impressão digital é estável para o mesmo segredo", () => {
    const a = descreverConfigParaLog(cfg()).tokenFingerprint;
    const b = descreverConfigParaLog(cfg()).tokenFingerprint;
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("segredos diferentes dão impressões diferentes", () => {
    const comum = descreverConfigParaLog(cfg());
    configurar({ MP_ACCESS_TOKEN: TOKEN_TESTE });
    const outro = descreverConfigParaLog(getPaymentConfig()!);
    expect(outro.tokenFingerprint).not.toBe(comum.tokenFingerprint);
  });

  it("token e webhook secret têm impressões independentes", () => {
    const d = descreverConfigParaLog(cfg());
    expect(d.tokenFingerprint).not.toBe(d.webhookSecretFingerprint);
  });
});

describe("verificarCoerenciaAmbiente", () => {
  function cfgCom(over: Partial<Record<string, string>> = {}): PaymentConfig {
    configurar(over);
    return getPaymentConfig()!;
  }

  it("avisa quando o prefixo do token não é reconhecido", () => {
    const avisos = verificarCoerenciaAmbiente(cfgCom({ MP_ACCESS_TOKEN: "xyz" }));
    expect(avisos.join(" ")).toMatch(/MP_ACCESS_TOKEN/);
  });

  it("avisa produção rodando com credencial de teste", () => {
    const cfg = cfgCom({ MP_ACCESS_TOKEN: TOKEN_TESTE, VERCEL_ENV: "production" });
    expect(verificarCoerenciaAmbiente(cfg).join(" ")).toMatch(/PRODUÇÃO/);
  });

  it("avisa preview com SITE_URL apontando para o domínio de produção", () => {
    const cfg = cfgCom({
      SITE_URL: "https://loja.vercel.app",
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "loja.vercel.app",
    });
    expect(verificarCoerenciaAmbiente(cfg).join(" ")).toMatch(/PREVIEW/);
  });

  it("preview com SITE_URL própria não gera aviso", () => {
    const cfg = cfgCom({
      SITE_URL: "https://loja-git-branch.vercel.app",
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "loja.vercel.app",
    });
    expect(verificarCoerenciaAmbiente(cfg)).toEqual([]);
  });

  it("REGRESSÃO: produção num domínio .vercel.app não é incoerência", () => {
    // A primeira versão tratava todo *.vercel.app como preview e acusava a
    // produção deste projeto — que não tem domínio próprio — todo request.
    const cfg = cfgCom({
      SITE_URL: "https://loja.vercel.app",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "loja.vercel.app",
    });
    expect(verificarCoerenciaAmbiente(cfg)).toEqual([]);
  });

  it("sem as variáveis do Vercel, não inventa aviso", () => {
    expect(verificarCoerenciaAmbiente(cfgCom())).toEqual([]);
  });
});
