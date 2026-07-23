import { createServerFn } from "@tanstack/react-start";

// Cria um pedido a partir do checkout do site. Roda no servidor com service role:
// insere na tabela `orders` (o trigger valida/recalcula o total e gera o número
// sequencial BCF-xxxx) e devolve o número — assim o número no WhatsApp bate com
// o do painel admin.

type OrderItem = { id?: string; name: string; quantity: number; price: number };

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
  items: OrderItem[];
};

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: CreateOrderInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("Pedido sem itens");
    }
    if (!data.customer_name?.trim() || !data.customer_phone?.trim()) {
      throw new Error("Nome e telefone são obrigatórios");
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
        total: 0, // recalculado pelo trigger a partir dos itens
        items: data.items,
      })
      .select("order_number")
      .single();

    if (error) throw new Error(error.message);
    return { orderNumber: (row?.order_number as string) ?? null };
  });
