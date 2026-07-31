// Integração com o agente de IA no n8n. SERVER-ONLY.
//
// O n8n roda fora deste projeto (outro servidor, mantido por vocês) e conversa
// com o site por HTTP, autenticado por uma chave compartilhada — não por login
// de usuário, porque quem chama é uma automação, não uma pessoa.

import { timingSafeEqual } from "node:crypto";

/**
 * Vale a mesma regra do módulo de pagamento: nunca com prefixo VITE_. Isso
 * publicaria a chave no JavaScript do navegador, e qualquer visitante do site
 * conseguiria criar pedidos e ler dados de clientes pela API do n8n.
 */
function garantirNaoExposta(): void {
  const exposta = process.env.VITE_N8N_API_KEY;
  if (typeof exposta === "string" && exposta.length > 0) {
    throw new Error(
      "Segredo exposto ao navegador: VITE_N8N_API_KEY. Remova o prefixo VITE_ " +
        "dessa variável no painel do deploy.",
    );
  }
}

/**
 * `null` quando a integração não foi configurada — nesse estado os endpoints
 * do n8n devolvem 404, como se não existissem, em vez de 401. Menos
 * informação para quem estiver sondando URLs às cegas.
 */
export function getN8nApiKey(): string | null {
  garantirNaoExposta();
  const key = process.env.N8N_API_KEY?.trim();
  return key && key.length >= 20 ? key : null;
}

export function isN8nIntegrationEnabled(): boolean {
  try {
    return getN8nApiKey() !== null;
  } catch {
    return false;
  }
}

function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Confere o header `Authorization: Bearer <chave>` de uma requisição do n8n.
 *
 * Comparação em tempo constante: comparar caractere a caractere com `===`
 * vaza, por timing, quantos caracteres iniciais acertaram — um jeito lento
 * mas real de adivinhar a chave por tentativa e erro.
 */
export function verificarAutenticacaoN8n(authHeader: string | null): boolean {
  const key = getN8nApiKey();
  if (!key || !authHeader) return false;

  const prefixo = "Bearer ";
  if (!authHeader.startsWith(prefixo)) return false;
  const recebida = authHeader.slice(prefixo.length).trim();
  if (!recebida) return false;

  return comparaSegura(key, recebida);
}
