// Configuração de pagamento. SERVER-ONLY.
//
// Se este arquivo algum dia aparecer no grafo do cliente, o build quebra — é
// `.server.ts` e a import-protection do Vite bloqueia. Isso é proposital: o
// token do gateway dá acesso a movimentar dinheiro da conta da loja.

/**
 * Variáveis que NUNCA podem existir com prefixo VITE_.
 *
 * Tudo que começa com VITE_ é substituído literalmente dentro do JavaScript que
 * vai para o navegador. Um `VITE_MP_ACCESS_TOKEN` publicaria a chave de
 * movimentação da conta para qualquer visitante que abrisse o código-fonte.
 * Preferimos derrubar o servidor a subir com o segredo exposto.
 */
import { createHash } from "node:crypto";

const NUNCA_EXPOR = [
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function garantirSegredosNaoExpostos(): void {
  const expostas = NUNCA_EXPOR.filter((nome) => {
    const valor = process.env[`VITE_${nome}`];
    return typeof valor === "string" && valor.length > 0;
  });

  if (expostas.length > 0) {
    throw new Error(
      `Segredo exposto ao navegador: ${expostas
        .map((n) => `VITE_${n}`)
        .join(", ")}. Variáveis VITE_ são embutidas no bundle do cliente. ` +
        `Remova o prefixo VITE_ dessas variáveis no painel do deploy.`,
    );
  }
}

/**
 * Ambiente deduzido do prefixo do access token.
 *
 * Atenção: as credenciais de TESTE da própria aplicação começam com `TEST-`,
 * mas as credenciais de um USUÁRIO DE TESTE (criado em /users/test_user)
 * começam com `APP_USR-`, iguais às de produção. Ou seja: "producao" aqui
 * significa apenas "não é um token TEST-", não é prova de conta real.
 */
export type TokenEnvironment = "teste" | "producao" | "desconhecido";

function classificarToken(token: string): TokenEnvironment {
  if (token.startsWith("TEST-")) return "teste";
  if (token.startsWith("APP_USR-")) return "producao";
  return "desconhecido";
}

/**
 * Identifica um segredo sem revelá-lo.
 *
 * Permite responder "o token que está rodando é o mesmo que colei no Vercel?"
 * comparando 8 hex, sem que o valor apareça no log — logs de deploy são lidos
 * por mais gente do que as variáveis de ambiente.
 */
function impressaoDigital(segredo: string): string {
  return createHash("sha256").update(segredo).digest("hex").slice(0, 8);
}

export type PaymentConfig = {
  accessToken: string;
  webhookSecret: string;
  /** Token de teste do Mercado Pago começa com TEST-. */
  sandbox: boolean;
  /** Ambiente deduzido do prefixo do token. Ver TokenEnvironment. */
  tokenEnvironment: TokenEnvironment;
  /** Origem pública do site, para montar as URLs de retorno e de webhook. */
  siteUrl: string;
};

/** Resumo seguro da configuração, para log de servidor. Nunca inclui segredo. */
export function descreverConfigParaLog(
  cfg: PaymentConfig,
): Record<string, string | boolean> {
  return {
    tokenPrefixo: cfg.accessToken.split("-")[0] || "(sem prefixo)",
    tokenAmbiente: cfg.tokenEnvironment,
    tokenFingerprint: impressaoDigital(cfg.accessToken),
    webhookSecretFingerprint: impressaoDigital(cfg.webhookSecret),
    siteUrl: cfg.siteUrl,
    initPointUsado: cfg.sandbox ? "sandbox_init_point" : "init_point",
  };
}

/**
 * Incoerências de configuração, para log de servidor.
 *
 * Deliberadamente NÃO adivinha o ambiente pelo formato do domínio. A primeira
 * versão disto tratava todo `*.vercel.app` como preview e acusava a própria
 * produção deste projeto — que não tem domínio próprio — de estar incoerente.
 * Um aviso que dispara sempre vira ruído e deixa de ser lido. Aqui só entram
 * checagens que o Vercel responde com certeza, pelas variáveis que ele injeta
 * em cada deploy.
 *
 * Devolve avisos em vez de lançar: combinação estranha ainda pode ser
 * intencional, e derrubar o checkout por heurística seria pior que o problema.
 */
export function verificarCoerenciaAmbiente(cfg: PaymentConfig): string[] {
  const avisos: string[] = [];
  const host = new URL(cfg.siteUrl).hostname;
  const vercelEnv = process.env.VERCEL_ENV;
  const hostDeProducao = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (cfg.tokenEnvironment === "desconhecido") {
    avisos.push(
      "MP_ACCESS_TOKEN não começa com TEST- nem com APP_USR- — o token pode " +
        "estar truncado ou não ser um access token do Mercado Pago.",
    );
  }

  if (vercelEnv === "production" && cfg.tokenEnvironment === "teste") {
    avisos.push(
      "Deploy de PRODUÇÃO rodando com credencial de teste (TEST-). Nenhum " +
        "cliente real consegue pagar — o checkout recusa comprador real " +
        "contra vendedor de teste.",
    );
  }

  // O caso que já nos mordeu: a preview monta returnUrl e notificationUrl a
  // partir de SITE_URL, então SITE_URL apontando para produção faz o webhook
  // do teste cair no site real, que roda outro código e outros segredos.
  if (vercelEnv === "preview" && hostDeProducao && host === hostDeProducao) {
    avisos.push(
      `Deploy de PREVIEW com SITE_URL apontando para o domínio de produção ` +
        `(${host}). O retorno do pagamento e o webhook deste teste vão para o ` +
        `site real, não para esta preview. Defina SITE_URL no escopo Preview ` +
        `e redeploy — variável de ambiente não entra em deploy já existente.`,
    );
  }

  return avisos;
}

/**
 * Lê e valida a configuração.
 *
 * Devolve `null` quando o pagamento online simplesmente não foi configurado —
 * esse é o estado normal enquanto a conta do gateway não existe, e nele o site
 * segue funcionando só com WhatsApp. Já configuração PELA METADE lança erro: um
 * checkout que aceita dinheiro sem conseguir validar webhook é pior do que
 * checkout nenhum.
 */
export function getPaymentConfig(): PaymentConfig | null {
  garantirSegredosNaoExpostos();

  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  const webhookSecret = process.env.MP_WEBHOOK_SECRET?.trim();
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL)?.trim();

  const nenhum = !accessToken && !webhookSecret;
  if (nenhum) return null;

  const faltando: string[] = [];
  if (!accessToken) faltando.push("MP_ACCESS_TOKEN");
  if (!webhookSecret) faltando.push("MP_WEBHOOK_SECRET");
  if (!siteUrl) faltando.push("SITE_URL");

  if (faltando.length > 0) {
    throw new Error(
      `Pagamento configurado pela metade — faltam: ${faltando.join(", ")}. ` +
        `Configure todas ou remova todas para desligar o pagamento online.`,
    );
  }

  let origem: string;
  try {
    const u = new URL(siteUrl!);
    // Retorno de pagamento e webhook em texto puro permitiriam interceptação.
    if (u.protocol !== "https:") {
      throw new Error(`SITE_URL precisa ser https, veio "${u.protocol}//"`);
    }
    origem = u.origin;
  } catch (err) {
    throw new Error(
      `SITE_URL inválida: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const tokenEnvironment = classificarToken(accessToken!);

  return {
    accessToken: accessToken!,
    webhookSecret: webhookSecret!,
    sandbox: tokenEnvironment === "teste",
    tokenEnvironment,
    siteUrl: origem,
  };
}

/** O checkout só oferece "pagar agora" quando isto é verdadeiro. */
export function isPaymentEnabled(): boolean {
  try {
    return getPaymentConfig() !== null;
  } catch (err) {
    // Configuração quebrada não pode virar botão de pagar na cara do cliente.
    // Mas desligar em silêncio é como o pagamento some sem ninguém perceber.
    console.error("[pagamento] configuração inválida — pagamento desligado:", err);
    return false;
  }
}
