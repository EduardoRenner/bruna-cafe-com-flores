// Helpers que dependem da request HTTP em curso. Server-only.
//
// Mora num `.server.ts` separado porque importa `@tanstack/react-start/server`,
// que a import-protection do Vite bloqueia no ambiente do cliente. Deixar esse
// import dentro de `admin.functions.ts`/`order.functions.ts` quebra o dev
// server, porque rotas que importam esses arquivos para referenciar os server
// functions acabam arrastando o import proibido para o grafo do cliente.
import { getRequest } from "@tanstack/react-start/server";

/**
 * IP do cliente, para rate limiting (login admin e criação de pedidos).
 *
 * A ordem é por confiabilidade, não por preferência de plataforma: só valem
 * headers que a borda REESCREVE, porque esses o cliente não consegue forjar.
 * `x-forwarded-for` é o último recurso — qualquer um pode mandá-lo numa
 * request direta, e aceitá-lo cedo demais deixaria um atacante trocar de "IP"
 * a cada tentativa e escapar do bloqueio.
 *
 *   x-vercel-forwarded-for -> Vercel (produção atual)
 *   cf-connecting-ip       -> Cloudflare (preview do Lovable)
 *   x-real-ip              -> definido pela borda nas duas
 */
export async function getClientIp(): Promise<string> {
  try {
    const headers = getRequest()?.headers;
    if (!headers) return "unknown";
    return (
      headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("cf-connecting-ip")?.trim() ||
      headers.get("x-real-ip")?.trim() ||
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}
