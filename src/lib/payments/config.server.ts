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

export type PaymentConfig = {
  accessToken: string;
  webhookSecret: string;
  /** Token de teste do Mercado Pago começa com TEST-. */
  sandbox: boolean;
  /** Origem pública do site, para montar as URLs de retorno e de webhook. */
  siteUrl: string;
};

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

  return {
    accessToken: accessToken!,
    webhookSecret: webhookSecret!,
    sandbox: accessToken!.startsWith("TEST-"),
    siteUrl: origem,
  };
}

/** O checkout só oferece "pagar agora" quando isto é verdadeiro. */
export function isPaymentEnabled(): boolean {
  try {
    return getPaymentConfig() !== null;
  } catch {
    // Configuração quebrada não pode virar botão de pagar na cara do cliente.
    return false;
  }
}
