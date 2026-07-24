import jsPDF from "jspdf";
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

export function generateOrderPDF(order: OrderRow): jsPDF {
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
  if (order.notes) row("Observações", order.notes);

  return doc;
}

export function downloadOrderPDF(order: OrderRow) {
  const doc = generateOrderPDF(order);
  doc.save(`pedido-${order.order_number}.pdf`);
}

export function printOrderPDF(order: OrderRow) {
  const doc = generateOrderPDF(order);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url, "_blank");
}