// Configuração do agente de WhatsApp. SERVER-ONLY.
//
// Mesmo padrão do módulo de pagamento: enquanto as variáveis abaixo não
// existirem, o agente fica desligado e o webhook só responde "ignorado" —
// nada quebra, nada expõe segredo pela metade.

const NUNCA_EXPOR = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "GEMINI_API_KEY",
] as const;

function garantirSegredosNaoExpostos(): void {
  const expostas = NUNCA_EXPOR.filter((nome) => {
    const valor = process.env[`VITE_${nome}`];
    return typeof valor === "string" && valor.length > 0;
  });
  if (expostas.length > 0) {
    throw new Error(
      `Segredo exposto ao navegador: ${expostas.map((n) => `VITE_${n}`).join(", ")}. ` +
        `Variáveis VITE_ são embutidas no bundle do cliente. Remova o prefixo VITE_ ` +
        `dessas variáveis no painel do deploy.`,
    );
  }
}

export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  geminiApiKey: string;
};

/**
 * `null` = agente desligado (estado normal enquanto a conta da Meta não
 * existe). Configuração pela metade lança erro — melhor derrubar o build do
 * que responder mensagem de WhatsApp de verdade sem conseguir validar
 * assinatura ou gerar resposta direito.
 */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  garantirSegredosNaoExpostos();

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

  const nenhum = !accessToken && !phoneNumberId && !appSecret && !verifyToken && !geminiApiKey;
  if (nenhum) return null;

  const faltando: string[] = [];
  if (!accessToken) faltando.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) faltando.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!appSecret) faltando.push("WHATSAPP_APP_SECRET");
  if (!verifyToken) faltando.push("WHATSAPP_VERIFY_TOKEN");
  if (!geminiApiKey) faltando.push("GEMINI_API_KEY");
  if (faltando.length > 0) {
    throw new Error(
      `Agente de WhatsApp configurado pela metade — faltam: ${faltando.join(", ")}. ` +
        `Configure todas ou remova todas para desligar o agente.`,
    );
  }

  return { accessToken: accessToken!, phoneNumberId: phoneNumberId!, appSecret: appSecret!, verifyToken: verifyToken!, geminiApiKey: geminiApiKey! };
}

export function isWhatsAppAgentEnabled(): boolean {
  try {
    return getWhatsAppConfig() !== null;
  } catch {
    return false;
  }
}
