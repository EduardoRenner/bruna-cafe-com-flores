import { createServerFn } from "@tanstack/react-start";

// Cria um pedido a partir do checkout do site. Roda no servidor com service role:
// insere na tabela `orders` (o trigger valida/recalcula o total e gera o número
// sequencial BCF-xxxx) e devolve o número — assim o número no WhatsApp bate com
// o do painel admin.

// O cliente diz O QUE quer e QUANTO quer. Nunca quanto custa.
// `name` e `price` são aceitos no payload por compatibilidade, mas ignorados.
type OrderItemInput = { id?: string; name?: string; quantity: number; price?: number };

type CreateOrderInput = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_type: "delivery" | "pickup";
  delivery_address?: Record<string, string> | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  payment_method: string; // 'pix' | 'dinheiro' | 'cartao'
  notes?: string | null;
  items: OrderItemInput[];
};

const DELIVERY_FEE_LABEL = "Taxa de entrega";

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: CreateOrderInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getClientIp } = await import("@/lib/request.server");

    // Protege o checkout público contra spam/flood de pedidos falsos — mesmo
    // padrão do rate limit de login do admin, aplicado por IP.
    const ip = await getClientIp();
    const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc(
      "check_order_rate_limit",
      { _ip: ip },
    );
    if (rateLimitError) throw new Error("Não foi possível processar o pedido");
    if (!allowed) {
      throw new Error("Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente.");
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("Pedido sem itens");
    }
    if (!data.customer_name?.trim() || !data.customer_phone?.trim()) {
      throw new Error("Nome e telefone são obrigatórios");
    }
    if (data.delivery_type !== "delivery" && data.delivery_type !== "pickup") {
      throw new Error("Tipo de entrega inválido");
    }

    // Consolida por id: se o mesmo produto vier repetido, soma as quantidades
    // em vez de virar duas linhas no pedido.
    const wanted = new Map<string, number>();
    for (const it of data.items) {
      const id = typeof it?.id === "string" ? it.id.trim() : "";
      if (!id) continue; // itens sem id (ex.: taxa de entrega enviada pelo cliente) são ignorados — recalculados abaixo
      const qty = Math.floor(Number(it?.quantity));
      if (!Number.isFinite(qty) || qty <= 0 || qty > 999) {
        throw new Error("Quantidade inválida");
      }
      wanted.set(id, (wanted.get(id) ?? 0) + qty);
    }
    if (wanted.size === 0) throw new Error("Pedido sem itens válidos");
    if (wanted.size > 100) throw new Error("Pedido com itens demais");

    // O PONTO CENTRAL: nome e preço vêm do catálogo, nunca do payload.
    // Sem isto, quem editasse o carrinho no localStorage escolheria o próprio
    // preço — o trigger no banco recalcula o total, mas a partir dos preços
    // que ele recebe, então sozinho ele não protege contra adulteração.
    const { data: rows, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id,name,price,active")
      .in("id", [...wanted.keys()]);
    if (prodError) throw new Error("Não foi possível validar os itens do pedido");

    const items: { id?: string; name: string; quantity: number; price: number }[] = [];
    for (const [id, quantity] of wanted) {
      const p = (rows ?? []).find((r) => r.id === id);
      // Produto inativo cai aqui junto com inexistente: se saiu do catálogo,
      // não pode ser comprado por quem tinha a página aberta.
      if (!p || !p.active) throw new Error("Produto indisponível no catálogo");
      items.push({ id, name: p.name, quantity, price: Number(p.price) });
    }

    let deliveryFee = 0;
    if (data.delivery_type === "delivery") {
      const bairro = data.delivery_address?.bairro?.trim();
      if (!bairro) throw new Error("Bairro é obrigatório para entrega");
      const { data: zone, error: zoneError } = await supabaseAdmin
        .from("delivery_zones")
        .select("fee,active")
        .eq("bairro", bairro)
        .maybeSingle();
      if (zoneError || !zone || !zone.active) {
        throw new Error("Bairro de entrega inválido");
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
        notes: data.notes?.slice(0, 2000) || null,
        status: "pendente",
        total: 0, // recalculado pelo trigger a partir dos itens acima
        items,
      })
      .select("order_number, public_token")
      .single();

    if (error) throw new Error(error.message);
    // Devolve os itens já precificados pelo servidor para o checkout montar a
    // mensagem do WhatsApp com os valores que realmente foram gravados.
    //
    // `orderToken` é o identificador aleatório do pedido: é com ele que o
    // cliente inicia o pagamento e acompanha o status, em vez do número
    // sequencial, que qualquer um conseguiria adivinhar.
    return {
      orderNumber: (row?.order_number as string) ?? null,
      orderToken: (row?.public_token as string) ?? null,
      items,
      deliveryFee,
      total: items.reduce((s, i) => s + i.price * i.quantity, 0),
    };
  });
