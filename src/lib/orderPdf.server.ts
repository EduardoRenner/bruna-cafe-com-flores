import type { OrderRow } from "@/lib/orders";

export const ORDER_PDFS_BUCKET = "order-pdfs";
// Curta duração: o link vai numa mensagem de WhatsApp que pode ser lida dias
// depois, mas o PDF tem endereço e telefone do cliente — não vale a pena
// deixar a URL válida por mais tempo do que o necessário para organizar a
// entrega. 7 dias cobre pedidos programados com data futura.
const SIGNED_EXPIRES_IN = 60 * 60 * 24 * 7;

/**
 * Origem pública do site, usada para montar o link do QR code de confirmação
 * de entrega dentro do PDF gerado no servidor. O pagamento online (Mercado
 * Pago) já exige SITE_URL configurada — reaproveitamos a mesma variável, com
 * o mesmo fallback para as URLs que a Vercel injeta caso ela não esteja
 * definida (ex.: ambiente sem pagamento online configurado ainda).
 */
function resolveSiteUrl(): string {
  const explicit = process.env.SITE_URL || process.env.VITE_SITE_URL;
  if (explicit) return explicit.trim().replace(/\/$/, "");
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "";
}

/**
 * Gera o PDF do pedido no servidor (mesmo layout do botão manual do admin) e
 * devolve os bytes prontos para subir no Storage.
 */
export async function generateOrderPdfBuffer(order: OrderRow): Promise<Uint8Array> {
  const { generateOrderPDF } = await import("@/lib/order-pdf");
  const baseUrl = resolveSiteUrl();
  const doc = await generateOrderPDF(order, { baseUrl });
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

/**
 * Gera e salva o PDF do pedido no bucket privado, devolvendo uma signed URL
 * de curta duração para ir na mensagem do WhatsApp. Nunca lança: falha na
 * geração/upload do PDF não pode derrubar a criação do pedido (nem pelo
 * checkout, nem pelo agente do n8n) — devolve `null` e quem chamou decide
 * como lidar com a ausência do link.
 */
export async function generateAndStoreOrderPdf(order: OrderRow): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buffer = await generateOrderPdfBuffer(order);
    const path = `${order.order_number}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(ORDER_PDFS_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      console.error("Falha ao subir PDF do pedido:", uploadError.message);
      return null;
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(ORDER_PDFS_BUCKET)
      .createSignedUrl(path, SIGNED_EXPIRES_IN);
    if (signError) {
      console.error("Falha ao assinar URL do PDF do pedido:", signError.message);
      return null;
    }
    return signed.signedUrl;
  } catch (err) {
    console.error("Falha ao gerar PDF do pedido:", err);
    return null;
  }
}
