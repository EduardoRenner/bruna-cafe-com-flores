import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatBRL } from "@/lib/products";
import { STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderRow } from "@/lib/orders";
import { store } from "@/lib/store-info";

function addrText(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, string>;
  const parts = [a.rua, a.numero].filter(Boolean).join(", ");
  return [parts, a.bairro, a.cep && `CEP ${a.cep}`, a.complemento].filter(Boolean).join(" · ") || "—";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export type GenerateOrderPdfOptions = {
  // Origem pública do site, usada para montar o link do QR code de
  // confirmação de entrega. No navegador, o padrão é `window.location.origin`;
  // rodando no servidor é obrigatório informar (ver orderPdf.server.ts).
  baseUrl?: string;
};

export async function generateOrderPDF(
  order: OrderRow,
  opts: GenerateOrderPdfOptions = {},
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(store.name, pageW / 2, y + 4, { align: "center" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(store.address, pageW / 2, y, { align: "center" });
  y += 4;
  doc.text(`WhatsApp: ${store.whatsapp}`, pageW / 2, y, { align: "center" });
  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Pedido
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Pedido ${order.order_number}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Emitido em ${new Date(order.created_at).toLocaleString("pt-BR")}`,
    pageW - margin,
    y,
    { align: "right" },
  );
  y += 8;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(value || "—", pageW - margin * 2);
    doc.text(lines, margin, y + 5);
    y += 5 + lines.length * 5 + 2;
  };

  row("Cliente", order.customer_name);
  row("Telefone", order.customer_phone);
  if (order.customer_email) row("E-mail", order.customer_email);
  row("Tipo de entrega", order.delivery_type === "delivery" ? "Entrega" : "Retirada na loja");
  if (order.delivery_type === "delivery") row("Endereço", addrText(order.delivery_address));
  if (order.delivery_date || order.delivery_time) {
    row(
      "Agendado para",
      `${fmtDate(order.delivery_date)}${order.delivery_time ? " · " + order.delivery_time : ""}`,
    );
  }

  y += 2;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Itens
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Itens", margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Qtd", margin, y);
  doc.text("Produto", margin + 15, y);
  doc.text("Unitário", pageW - margin - 40, y, { align: "right" });
  doc.text("Subtotal", pageW - margin, y, { align: "right" });
  y += 2;
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const items = Array.isArray(order.items) ? (order.items as { name: string; quantity: number; price: number }[]) : [];
  let subtotal = 0;
  let deliveryFee = 0;
  for (const it of items) {
    const isFee = it.name?.toLowerCase() === "taxa de entrega";
    const sub = it.price * it.quantity;
    if (isFee) {
      deliveryFee += sub;
      continue;
    }
    subtotal += sub;
    if (y > 260) {
      doc.addPage();
      y = margin;
    }
    const nameLines = doc.splitTextToSize(it.name, pageW - margin * 2 - 70);
    doc.text(String(it.quantity), margin, y);
    doc.text(nameLines, margin + 15, y);
    doc.text(formatBRL(it.price), pageW - margin - 40, y, { align: "right" });
    doc.text(formatBRL(sub), pageW - margin, y, { align: "right" });
    y += Math.max(5, nameLines.length * 5) + 1;
  }

  y += 3;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const totalsRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.text(label, pageW - margin - 45, y, { align: "right" });
    doc.text(value, pageW - margin, y, { align: "right" });
    y += bold ? 7 : 5;
  };
  totalsRow("Subtotal", formatBRL(subtotal));
  totalsRow("Frete", deliveryFee > 0 ? formatBRL(deliveryFee) : "—");
  totalsRow("Total", formatBRL(Number(order.total)), true);

  y += 4;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  row("Forma de pagamento", (order.payment_method || "—").toUpperCase());
  row(
    "Status do pagamento",
    PAYMENT_STATUS_LABELS[order.payment_status ?? "pendente"] ?? (order.payment_status ?? "—"),
  );
  row("Status do pedido", STATUS_LABELS[order.status] ?? order.status);

  if (order.delivery_instructions) row("Instruções de entrega", order.delivery_instructions);
  // Pedido antigo (anterior à separação de campos): mostra o texto único
  // como estava, sem tentar decidir o que era instrução e o que era cartão.
  if (!order.delivery_instructions && !order.card_message && order.notes) {
    row("Observações", order.notes);
  }

  if (order.card_message) {
    y += 2;
    const boxW = pageW - margin * 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const linhasCartao = doc.splitTextToSize(order.card_message, boxW - 10);
    const boxHeight = 12 + linhasCartao.length * 6;

    doc.setFillColor(250, 245, 235);
    doc.setDrawColor(200, 170, 120);
    doc.roundedRect(margin, y, boxW, boxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(120, 90, 40);
    doc.text("CARTÃO DE MENSAGEM", margin + 5, y + 7);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(linhasCartao, margin + 5, y + 14);
    doc.setTextColor(0);

    y += boxHeight + 8;
  }

  const baseUrl = opts.baseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  await addDeliveryConfirmationBlock(doc, order, y, margin, pageW, baseUrl);

  return doc;
}

const QR_SIZE = 28; // mm

/**
 * Bloco "COMPROVANTE DE ENTREGA": dados de quem recebe + canhoto de
 * confirmação (data/hora, nome, assinatura, checkboxes) + QR code que abre
 * `/confirmar-entrega/{token}` — o entregador confirma pelo celular, sem
 * precisar de painel admin. Usa `public_token` (não `order_number`) no link,
 * mesmo motivo já documentado em pedido.$orderNumber.tsx: o número
 * sequencial deixaria qualquer um adivinhar/trocar pedidos de outros
 * clientes trocando o número na barra de endereço.
 */
async function addDeliveryConfirmationBlock(
  doc: jsPDF,
  order: OrderRow,
  startY: number,
  margin: number,
  pageW: number,
  baseUrl: string,
): Promise<void> {
  const largura = pageW - margin * 2;
  let y = startY;
  if (y > 227) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, largura, 68);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COMPROVANTE DE ENTREGA", margin + 5, y + 8);
  doc.setDrawColor(180);
  doc.line(margin + 5, y + 10, pageW - margin - 5, y + 10);

  const textX = margin + 5;
  const qrX = pageW - margin - 5 - QR_SIZE;
  let ty = y + 17;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Destinatário: ${order.customer_name || "—"}`, textX, ty);
  ty += 5.5;

  if (order.delivery_type === "delivery" && order.delivery_address) {
    const linhasEndereco = doc.splitTextToSize(
      `Endereço: ${addrText(order.delivery_address)}`,
      largura - QR_SIZE - 15,
    ) as string[];
    doc.text(linhasEndereco, textX, ty);
    ty += linhasEndereco.length * 5.5;
  } else {
    doc.text(`Retirada na loja — ${store.address}`, textX, ty);
    ty += 5.5;
  }

  doc.text(`Telefone: ${order.customer_phone || "—"} (ligar somente se necessário)`, textX, ty);
  ty += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Data/hora da entrega: _____/_____/________  às  _______", textX, ty);
  ty += 7;
  doc.text("Nome legível de quem recebeu: ____________________________________", textX, ty);
  ty += 9;

  const checkboxes: Array<[string, number]> = [
    ["Em mãos", textX],
    ["Familiar", textX + 35],
    ["Portaria", textX + 70],
    ["Vizinho", textX + 105],
  ];
  for (const [label, cx] of checkboxes) {
    doc.rect(cx, ty - 3.5, 3.5, 3.5);
    doc.text(label, cx + 5, ty);
  }
  ty += 10;

  doc.text("Assinatura: ________________________________________", textX, ty);

  try {
    if (!baseUrl) throw new Error("sem baseUrl");
    if (!order.public_token) throw new Error("sem public_token");
    const confirmUrl = `${baseUrl}/confirmar-entrega/${encodeURIComponent(order.public_token)}`;
    const qrDataUrl = await QRCode.toDataURL(confirmUrl, { margin: 0, width: 256 });
    doc.addImage(qrDataUrl, "PNG", qrX, y + 15, QR_SIZE, QR_SIZE);
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text("Confirmar entrega", qrX + QR_SIZE / 2, y + 15 + QR_SIZE + 4, { align: "center" });
    doc.setTextColor(0);
  } catch {
    // QR não gerado (ex.: sem baseUrl/token disponível) — comprovante segue
    // funcional só com o canhoto de assinatura manual.
  }
}

export async function downloadOrderPDF(order: OrderRow) {
  const doc = await generateOrderPDF(order);
  doc.save(`pedido-${order.order_number}.pdf`);
}

/**
 * `preview` é uma janela JÁ ABERTA (via `window.open("", "_blank")`) que o
 * chamador precisa criar de forma síncrona, na mesma pilha de chamada do
 * clique — geração do PDF agora é assíncrona (QR code), então abrir a aba
 * depois perderia o gesto do usuário e o navegador bloquearia o pop-up.
 */
export async function printOrderPDF(order: OrderRow, preview: Window | null) {
  try {
    const doc = await generateOrderPDF(order);
    doc.autoPrint();
    const url = doc.output("bloburl") as unknown as string;
    if (preview) preview.location.href = url;
  } catch (err) {
    preview?.close();
    throw err;
  }
}