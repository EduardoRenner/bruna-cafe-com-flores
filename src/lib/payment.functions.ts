import { createServerFn } from "@tanstack/react-start";

// Ponte entre o checkout (navegador) e a camada de pagamento (servidor).
//
// O navegador só consegue dizer QUAL pedido quer pagar, e mesmo assim através
// de um token aleatório. Quanto cobrar é decidido no servidor a partir do
// pedido gravado — não existe caminho pelo qual o cliente influencie o valor.

export type IniciarPagamentoResposta =
  | { ok: true; redirectUrl: string }
  | { ok: false; mensagem: string };

/** Mensagens genéricas: detalhe de erro interno não vai para o navegador. */
const MENSAGENS: Record<string, string> = {
  desligado: "Pagamento online indisponível no momento. Finalize pelo WhatsApp.",
  pedido_invalido: "Não foi possível localizar este pedido.",
  ja_pago: "Este pedido já está pago.",
  forma_nao_online:
    "Este pedido foi feito para pagamento em dinheiro na entrega. Para pagar online, faça um novo pedido escolhendo Pix, cartão ou boleto.",
  excesso_tentativas:
    "Muitas tentativas de pagamento para este pedido. Fale com a loja pelo WhatsApp.",
  falha_gateway:
    "Não conseguimos abrir o pagamento agora. Tente de novo em instantes ou finalize pelo WhatsApp.",
};

export const iniciarPagamento = createServerFn({ method: "POST" })
  .inputValidator((data: { orderToken: string }) => data)
  .handler(async ({ data }): Promise<IniciarPagamentoResposta> => {
    const token = typeof data?.orderToken === "string" ? data.orderToken.trim() : "";
    // O token é hex de 24 bytes; qualquer coisa fora disso nem chega ao banco.
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return { ok: false, mensagem: MENSAGENS.pedido_invalido };
    }

    const { criarPagamentoParaPedido } = await import("@/lib/payments/service.server");
    const r = await criarPagamentoParaPedido(token);

    if (r.ok) return { ok: true, redirectUrl: r.redirectUrl };
    return { ok: false, mensagem: MENSAGENS[r.motivo] ?? MENSAGENS.falha_gateway };
  });

/** O checkout usa isto para só mostrar "pagar agora" quando há gateway configurado. */
export const pagamentoDisponivel = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ habilitado: boolean }> => {
    const { isPaymentEnabled } = await import("@/lib/payments/config.server");
    return { habilitado: isPaymentEnabled() };
  },
);

export type StatusPublico = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
} | null;

/**
 * Consulta pública do pedido, pelo token aleatório.
 *
 * Devolve só o que o dono do link precisa ver — nada de telefone, endereço ou
 * itens. Token inválido devolve null sem distinguir "não existe" de "não é
 * seu", para não virar ferramenta de sondagem.
 */
export const consultarPedidoPublico = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<StatusPublico> => {
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (!/^[a-f0-9]{48}$/.test(token)) return null;

    // Antes de responder, pergunta ao gateway se o pagamento saiu do lugar.
    // É aqui que o cliente cai voltando do checkout, então é o momento mais
    // barato para consertar um webhook que não chegou — e sem isso o pedido
    // ficaria pendente indefinidamente, mesmo pago. A função é interna e não
    // lança: se o gateway estiver fora, a página carrega igual.
    const { reconciliarPagamentoDoPedido } = await import(
      "@/lib/payments/service.server"
    );
    await reconciliarPagamentoDoPedido(token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linhas, error } = await supabaseAdmin.rpc("get_order_public_status", {
      _token: token,
    });
    if (error || !linhas || linhas.length === 0) return null;

    const o = linhas[0];
    return {
      orderNumber: o.order_number,
      status: o.status,
      paymentStatus: o.payment_status,
      total: Number(o.total),
    };
  });
