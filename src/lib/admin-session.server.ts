// Sessão do admin — cookie httpOnly assinado. SERVER-ONLY.
//
// Por que existe: antes, a senha do admin ficava em sessionStorage e era
// reenviada no corpo de TODA chamada do painel. Isso tem três problemas:
//   1. um XSS no painel capturava a senha em si (não um token de vida curta),
//      ou seja, comprometimento permanente até alguém trocar a senha à mão;
//   2. cada clique no admin custava um bcrypt (cost 10) no servidor;
//   3. não existia expiração — a "sessão" durava até fechar a aba.
//
// Agora o login troca a senha por um cookie httpOnly assinado com HMAC e com
// prazo de validade. JavaScript da página não consegue ler esse cookie, então
// um XSS não extrai credencial nenhuma; e mesmo que o token vaze por outro
// caminho, ele morre sozinho.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "admin_session";
const DURACAO_MS = 8 * 60 * 60 * 1000; // 8h — cobre um dia de trabalho na loja

/**
 * Segredo usado para assinar o cookie.
 *
 * Usa ADMIN_SESSION_SECRET quando existir. Se não existir, deriva da service
 * role key do Supabase — que já é obrigatória e já é secreta, então não
 * inventamos mais um item de configuração para o cliente esquecer. Derivar
 * (em vez de usar direto) evita que o valor do cookie tenha qualquer relação
 * reversível com a chave do banco.
 *
 * Trocar a service role key invalida as sessões abertas. Isso é desejável.
 */
function segredo(): Buffer {
  const explicito = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicito && explicito.length >= 16) return Buffer.from(explicito, "utf8");

  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) {
    // Sem isso não há como assinar nada. Falhar alto é melhor do que emitir
    // sessão com segredo previsível.
    throw new Error(
      "Configuração de sessão indisponível: defina ADMIN_SESSION_SECRET ou SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createHmac("sha256", base).update("admin-session-v1").digest();
}

function assinar(payload: string): string {
  return createHmac("sha256", segredo()).update(payload).digest("hex");
}

function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Emite o cookie de sessão. Chamado só depois da senha ser conferida. */
export async function criarSessaoAdmin(): Promise<void> {
  const { setCookie } = await import("@tanstack/react-start/server");

  const exp = Date.now() + DURACAO_MS;
  // O nonce garante que duas sessões emitidas no mesmo milissegundo não
  // produzam o mesmo token, e que o token não seja adivinhável a partir do
  // relógio.
  const nonce = randomBytes(16).toString("hex");
  const payload = `${exp}.${nonce}`;
  const token = `${payload}.${assinar(payload)}`;

  setCookie(COOKIE, token, {
    httpOnly: true, // JS da página não lê — é isso que neutraliza XSS aqui
    secure: process.env.NODE_ENV === "production", // em dev roda em http://localhost
    sameSite: "strict", // principal defesa de CSRF: cookie não vai em request cross-site
    path: "/",
    maxAge: Math.floor(DURACAO_MS / 1000),
  });
}

/** Apaga o cookie (logout). */
export async function encerrarSessaoAdmin(): Promise<void> {
  const { deleteCookie } = await import("@tanstack/react-start/server");
  deleteCookie(COOKIE, { path: "/" });
}

/**
 * Confere a origem da request.
 *
 * SameSite=strict já barra o envio do cookie a partir de outro site, mas
 * navegador antigo/configuração exótica não é algo que queremos apostar
 * quando o custo de checar é uma comparação de string. Requests sem Origin
 * (navegação direta, alguns clientes) passam — o SameSite cobre esses.
 */
async function origemConfere(): Promise<boolean> {
  try {
    const { getRequestHeader, getRequestHost } = await import("@tanstack/react-start/server");
    const origin = getRequestHeader("origin");
    if (!origin) return true;
    return new URL(origin).host === getRequestHost({ xForwardedHost: true });
  } catch {
    return true;
  }
}

/** True se a request atual carrega um cookie de sessão válido e não expirado. */
export async function sessaoAdminValida(): Promise<boolean> {
  try {
    if (!(await origemConfere())) return false;

    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(COOKIE);
    if (!token) return false;

    const partes = token.split(".");
    if (partes.length !== 3) return false;
    const [exp, nonce, assinatura] = partes;

    if (!comparaSegura(assinar(`${exp}.${nonce}`), assinatura)) return false;

    const expiraEm = Number(exp);
    if (!Number.isFinite(expiraEm) || Date.now() > expiraEm) return false;

    return true;
  } catch {
    return false;
  }
}
