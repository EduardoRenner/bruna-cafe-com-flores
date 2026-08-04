// Núcleo da criação de pedido. SERVER-ONLY.
//
// Usado por dois chamadores: o checkout do site (src/lib/order.functions.ts,
// via TanStack server function) e a API do n8n
// (src/routes/api/integrations/n8n/pedidos.ts, via REST autenticado por chave).
//
// Existe como módulo único para que a regra mais importante do sistema —
// preço e nome vêm sempre do catálogo, nunca de quem está pedindo — valha
// para os dois caminhos automaticamente. Se cada chamador reimplementasse a
// validação, bastaria um deles esquecer um detalhe para reabrir a mesma
// adulteração de preço que já corrigimos uma vez (ver
// docs/integracao-n8n.md).

export type OrderItemInput = { id?: string; name?: string; quantity: number; price?: number };

export type CreateOrderInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_type: "delivery" | "pickup";
  delivery_address?: Record<string, string> | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  payment_method: string; // 'pix' | 'dinheiro' | 'cartao' | 'boleto'
  /** "Troco para quanto", em reais. Só vale com payment_method 'dinheiro'. */
  change_for?: number | null;
  notes?: string | null;
  delivery_instructions?: string | null;
  card_message?: string | null;
  items: OrderItemInput[];
};

/** Formas aceitas. Espelha o trigger validate_new_order — os dois têm de bater. */
export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao", "boleto"] as const;

/** Só estas podem ser cobradas pelo gateway; dinheiro é acerto na entrega. */
export const FORMAS_ONLINE = ["pix", "cartao", "boleto"] as const;

export type CreateOrderResult = {
  orderNumber: string | null;
  orderToken: string | null;
  items: { id?: string; name: string; quantity: number; price: number }[];
  deliveryFee: number;
  total: number;
  pdfUrl: string | null;
};

// Limite do campo "mensagem do cartão" — cartões físicos não têm espaço para
// textos longos, e evita que a mensagem estoure o bloco reservado no PDF.
const CARD_MESSAGE_MAX_LENGTH = 200;

const DELIVERY_FEE_LABEL = "Taxa de entrega";

/** Erro esperado (mensagem segura para mostrar ao cliente final ou ao agente). */
export class OrderValidationError extends Error {}

/**
 * Troco utilizável.
 *
 * Não confere contra o total aqui de propósito: o total só é conhecido depois
 * de recalculado a partir do catálogo, e quem faz essa conferência é o trigger
 * no banco, onde ela vale para todos os caminhos de criação de pedido.
 */
function trocoValido(valor: number | null | undefined): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

export async function criarPedido(
  data: CreateOrderInput,
  opts: { clientIp: string },
): Promise<CreateOrderResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Protege contra spam/flood de pedidos falsos — mesmo padrão do rate limit
  // de login do admin, aplicado por IP. Vale igualmente para o site e para o
  // agente do n8n: um IP não pode gerar dezenas de pedidos por minuto.
  const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc(
    "check_order_rate_limit",
    { _ip: opts.clientIp },
  );
  if (rateLimitError) throw new OrderValidationError("Não foi possível processar o pedido");
  if (!allowed) {
    throw new OrderValidationError(
      "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente.",
    );
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new OrderValidationError("Pedido sem itens");
  }
  if (!data.customer_name?.trim() || !data.customer_phone?.trim()) {
    throw new OrderValidationError("Nome e telefone são obrigatórios");
  }
  if (data.delivery_type !== "delivery" && data.delivery_type !== "pickup") {
    throw new OrderValidationError("Tipo de entrega inválido");
  }
  if (!(FORMAS_PAGAMENTO as readonly string[]).includes(data.payment_method)) {
    throw new OrderValidationError("Forma de pagamento inválida");
  }

  // Consolida por id: se o mesmo produto vier repetido, soma as quantidades
  // em vez de virar duas linhas no pedido.
  const wanted = new Map<string, number>();
  for (const it of data.items) {
    const id = typeof it?.id === "string" ? it.id.trim() : "";
    if (!id) continue; // itens sem id (ex.: taxa de entrega) são ignorados — recalculados abaixo
    const qty = Math.floor(Number(it?.quantity));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 999) {
      throw new OrderValidationError("Quantidade inválida");
    }
    wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }
  if (wanted.size === 0) throw new OrderValidationError("Pedido sem itens válidos");
  if (wanted.size > 100) throw new OrderValidationError("Pedido com itens demais");

  // O PONTO CENTRAL: nome e preço vêm do catálogo, nunca do payload.
  // Vale tanto para o carrinho do navegador (que pode ser editado no
  // localStorage) quanto para o agente do n8n (que pode ter conversado com
  // um preço desatualizado ou ter recebido instrução maliciosa do cliente).
  const { data: rows, error: prodError } = await supabaseAdmin
    .from("products")
    .select("id,name,price,active")
    .in("id", [...wanted.keys()]);
  if (prodError) throw new OrderValidationError("Não foi possível validar os itens do pedido");

  const items: { id?: string; name: string; quantity: number; price: number }[] = [];
  for (const [id, quantity] of wanted) {
    const p = (rows ?? []).find((r) => r.id === id);
    // Produto inativo cai aqui junto com inexistente: se saiu do catálogo,
    // não pode ser comprado por quem tinha a página (ou a conversa) aberta.
    if (!p || !p.active) throw new OrderValidationError("Produto indisponível no catálogo");
    items.push({ id, name: p.name, quantity, price: Number(p.price) });
  }

  let deliveryFee = 0;
  if (data.delivery_type === "delivery") {
    const bairro = data.delivery_address?.bairro?.trim();
    if (!bairro) throw new OrderValidationError("Bairro é obrigatório para entrega");
    const { data: zone, error: zoneError } = await supabaseAdmin
      .from("delivery_zones")
      .select("fee,active")
      .eq("bairro", bairro)
      .maybeSingle();
    if (zoneError || !zone || !zone.active) {
      throw new OrderValidationError("Bairro de entrega inválido");
    }
    deliveryFee = Number(zone.fee);
    items.push({ name: DELIVERY_FEE_LABEL, quantity: 1, price: deliveryFee });
  }

  const { data: row, error } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "", // gerado pelo trigger no banco
      customer_name: data.customer_name.trim().slice(0, 200),
      customer_phone: data.customer_phone.trim().slice(0, 40),
      customer_email: data.customer_email?.trim().slice(0, 200) || null,
      delivery_type: data.delivery_type,
      delivery_address: data.delivery_address ?? null,
      delivery_date: data.delivery_date || null,
      delivery_time: data.delivery_time || null,
      payment_method: data.payment_method,
      // Só faz sentido com dinheiro; o trigger zera nos demais casos de
      // qualquer forma, mas mandar já limpo evita ruído no que é gravado.
      change_for:
        data.payment_method === "dinheiro" && trocoValido(data.change_for)
          ? data.change_for
          : null,
      // `notes` continua aceito por compatibilidade (ex.: agente do n8n que
      // ainda não separa os dois campos); o checkout do site já manda os
      // campos novos direto.
      notes: data.notes?.slice(0, 2000) || null,
      delivery_instructions: data.delivery_instructions?.trim().slice(0, 2000) || null,
      card_message: data.card_message?.trim().slice(0, CARD_MESSAGE_MAX_LENGTH) || null,
      status: "pendente",
      total: 0, // recalculado pelo trigger a partir dos itens acima
      items,
    })
    .select("order_number, public_token, created_at")
    .single();

  if (error) throw new Error(error.message);

  const orderNumber = (row?.order_number as string) ?? null;
  const orderToken = (row?.public_token as string) ?? null;
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // Gera o PDF (dados do pedido + cartão + comprovante com QR) e sobe no
  // bucket privado, devolvendo uma signed URL para ir na mensagem do
  // WhatsApp. Best-effort: se falhar, o pedido já está gravado e o checkout
  // segue sem o link — não pode travar o fechamento do pedido nem o caminho
  // do n8n.
  let pdfUrl: string | null = null;
  if (orderNumber && orderToken) {
    const { generateAndStoreOrderPdf } = await import("@/lib/orderPdf.server");
    pdfUrl = await generateAndStoreOrderPdf({
      id: "",
      order_number: orderNumber,
      public_token: orderToken,
      customer_name: data.customer_name.trim(),
      customer_phone: data.customer_phone.trim(),
      customer_email: data.customer_email?.trim() || null,
      delivery_type: data.delivery_type,
      delivery_address: data.delivery_address ?? null,
      delivery_date: data.delivery_date || null,
      delivery_time: data.delivery_time || null,
      payment_method: data.payment_method,
      notes: data.notes?.trim() || null,
      delivery_instructions: data.delivery_instructions?.trim() || null,
      card_message: data.card_message?.trim() || null,
      status: "pendente",
      total,
      items,
      created_at: (row?.created_at as string) ?? new Date().toISOString(),
      updated_at: (row?.created_at as string) ?? new Date().toISOString(),
    });
  }

  return {
    orderNumber,
    orderToken,
    items,
    deliveryFee,
    total,
    pdfUrl,
  };
}
