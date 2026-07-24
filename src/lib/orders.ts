// Tipos de pedido (Supabase). Os pedidos são criados pelo checkout via server
// function e lidos no admin com service role.
export type OrderStatus = "pendente" | "em_preparo" | "saiu_entrega" | "entregue" | "cancelado";

export const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_preparo: "Em preparo",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export type PaymentStatus = "pendente" | "pago" | "estornado";

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendente: "Pagamento pendente",
  pago: "Pago",
  estornado: "Estornado",
};

export type OrderItem = { id?: string; name: string; quantity: number; price: number };

export interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_type: "delivery" | "pickup" | string;
  delivery_address: Record<string, string> | null;
  delivery_date: string | null;
  delivery_time: string | null;
  payment_method: string;
  notes: string | null;
  status: string;
  payment_status?: string;
  total: number;
  items: OrderItem[] | unknown;
  created_at: string;
  updated_at: string;
}
