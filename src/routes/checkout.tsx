import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MapPin, MessageCircle, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/products";
import { store, whatsappLink } from "@/lib/store-info";
import { fetchActiveZones } from "@/lib/delivery";
import { createOrder } from "@/lib/order.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Finalizar pedido — Bruna Café com Flores" }] }),
  component: CheckoutPage,
});

// Converte YYYY-MM-DD para DD/MM/AAAA.
function formatDateBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const PAYMENT_DB: Record<string, string> = { Dinheiro: "dinheiro", Pix: "pix", "Cartão": "cartao" };

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const createOrderFn = useServerFn(createOrder);

  const { data: zones } = useQuery({ queryKey: ["delivery-zones"], queryFn: fetchActiveZones });

  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [zoneId, setZoneId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const selectedZone = useMemo(() => zones?.find((z) => z.id === zoneId) ?? null, [zones, zoneId]);
  const deliveryFee = deliveryType === "delivery" ? selectedZone?.fee ?? 0 : 0;
  const total = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen pt-24">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl">Seu carrinho está vazio</h1>
          <p className="mt-3 text-muted-foreground">Adicione produtos antes de finalizar o pedido.</p>
          <Link to="/catalogo" className="mt-6 inline-block">
            <Button className="bg-rose-deep text-primary-foreground">Ver produtos</Button>
          </Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);

    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const email = (fd.get("email") as string)?.trim() || "";

    if (name.length < 2) {
      toast.error("Por favor, informe seu nome completo.");
      setSubmitting(false);
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um telefone válido com DDD.");
      setSubmitting(false);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      setSubmitting(false);
      return;
    }

    const rua = String(fd.get("rua") ?? "").trim();
    const numero = String(fd.get("numero") ?? "").trim();
    const bairro = selectedZone?.bairro ?? "";

    if (deliveryType === "delivery" && (!rua || !numero || !bairro)) {
      toast.error("Preencha o endereço e escolha o bairro para entrega.");
      setSubmitting(false);
      return;
    }

    const cep = String(fd.get("cep") ?? "").trim();
    const complemento = String(fd.get("complemento") ?? "").trim();
    const dateRaw = String(fd.get("date") ?? "").trim();
    const timeRaw = String(fd.get("time") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();
    const paymentLabel = String(fd.get("payment") ?? "Pix");
    const paymentDb = PAYMENT_DB[paymentLabel] ?? "pix";

    let orderNumber = "BCF-" + Date.now().toString().slice(-6);

    const productsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const recalculatedTotal = productsTotal + deliveryFee;

    const dbItems: { id?: string; name: string; quantity: number; price: number }[] = items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    }));
    if (deliveryType === "delivery" && deliveryFee > 0) {
      dbItems.push({ name: "Taxa de entrega", quantity: 1, price: deliveryFee });
    }

    // Abre a aba do WhatsApp já dentro do clique (evita bloqueio de popup).
    const waWindow = window.open("", "_blank");

    try {
      const res = await createOrderFn({
        data: {
          customer_name: name,
          customer_phone: phone,
          customer_email: email || null,
          delivery_type: deliveryType,
          delivery_address:
            deliveryType === "delivery" ? { rua, numero, bairro, cep, complemento } : null,
          delivery_date: dateRaw || null,
          delivery_time: timeRaw || null,
          payment_method: paymentDb,
          notes: notes || null,
          items: dbItems,
        },
      });
      if (res?.orderNumber) orderNumber = res.orderNumber;
    } catch (err) {
      console.error("Falha ao salvar o pedido:", err);
    }

    const itemLines = items
      .map((i) => `  - ${i.quantity}x ${i.name} — ${formatBRL(i.price * i.quantity)}`)
      .join("\n");

    const deliveryLine =
      deliveryType === "delivery"
        ? `*Entrega*\n  Endereço: ${rua}, ${numero} - ${bairro}${cep ? " · CEP " + cep : ""}${complemento ? " · " + complemento : ""}\n  Frete: ${formatBRL(deliveryFee)}`
        : `*Retirada na loja*`;

    const dateLine = dateRaw
      ? `*Data desejada:* ${formatDateBR(dateRaw)}${timeRaw ? " às " + timeRaw : ""}`
      : "";
    const paymentLine = `*Pagamento:* ${paymentLabel}`;
    const notesLine = notes ? `*Observações:* ${notes}` : "";

    const message = [
      `*Novo Pedido — ${orderNumber}*`,
      ``,
      `*Cliente:* ${name}`,
      `*Telefone:* ${phone}`,
      email ? `*E-mail:* ${email}` : "",
      ``,
      `*Itens:*`,
      itemLines,
      ``,
      deliveryLine,
      dateLine,
      paymentLine,
      notesLine,
      ``,
      `*Total: ${formatBRL(recalculatedTotal)}*`,
      ``,
      `Pedido feito pelo site — Bruna Café com Flores`,
    ]
      .filter((l) => l !== "")
      .join("\n");

    const whatsappUrl = whatsappLink(message);

    try { clear(); } catch { /* noop */ }
    toast.success("Pedido registrado! Abrindo o WhatsApp…");

    if (waWindow) {
      waWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }
    navigate({ to: "/pedido/$orderNumber", params: { orderNumber } });
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="font-display text-3xl md:text-4xl">Finalizar pedido</h1>
        <p className="mt-2 text-muted-foreground">Preencha seus dados para concluir a compra.</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <form onSubmit={submit} className="space-y-8">
            {/* Cliente */}
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card-soft">
              <h2 className="font-display text-xl">Seus dados</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nome completo *</Label>
                  <Input required name="name" />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input required name="phone" placeholder="(49) 9 9999-9999" />
                </div>
                <div className="md:col-span-2">
                  <Label>E-mail</Label>
                  <Input type="email" name="email" />
                </div>
              </div>
            </section>

            {/* Entrega */}
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card-soft">
              <h2 className="font-display text-xl">Entrega</h2>
              <RadioGroup
                value={deliveryType}
                onValueChange={(v) => setDeliveryType(v as "delivery" | "pickup")}
                className="mt-4 grid gap-3 md:grid-cols-2"
              >
                <label
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 " +
                    (deliveryType === "delivery" ? "border-rose-deep bg-rose-deep/5" : "border-border")
                  }
                >
                  <RadioGroupItem value="delivery" className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Truck className="h-4 w-4" /> Entrega
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {deliveryType === "delivery" && selectedZone
                        ? `Frete: ${formatBRL(selectedZone.fee)}`
                        : "Frete conforme o bairro"}
                    </div>
                  </div>
                </label>
                <label
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 " +
                    (deliveryType === "pickup" ? "border-rose-deep bg-rose-deep/5" : "border-border")
                  }
                >
                  <RadioGroupItem value="pickup" className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Store className="h-4 w-4" /> Retirada na loja
                    </div>
                    <div className="text-sm text-muted-foreground">Sem taxa adicional</div>
                  </div>
                </label>
              </RadioGroup>

              {deliveryType === "delivery" ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Bairro *</Label>
                    <Select value={zoneId} onValueChange={setZoneId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        {(zones ?? []).map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.bairro} — {formatBRL(z.fee)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Rua *</Label>
                    <Input required name="rua" />
                  </div>
                  <div>
                    <Label>Número *</Label>
                    <Input required name="numero" />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input name="cep" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Complemento</Label>
                    <Input name="complemento" />
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-lg bg-secondary/50 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-rose-deep" />
                    <span>{store.address}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {store.hours.map((h) => `${h.day}: ${h.time}`).join(" · ")}
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Data desejada</Label>
                  <Input type="date" name="date" />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input type="time" name="time" />
                </div>
              </div>
            </section>

            {/* Observações */}
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card-soft">
              <h2 className="font-display text-xl">Observações</h2>
              <Textarea
                name="notes"
                className="mt-4"
                rows={3}
                placeholder="Mensagem no cartão, preferências, referências…"
              />
            </section>

            {/* Pagamento */}
            <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-card-soft">
              <h2 className="font-display text-xl">Pagamento</h2>
              <RadioGroup name="payment" defaultValue="Pix" className="mt-4 grid gap-3 md:grid-cols-3">
                {["Dinheiro", "Pix", "Cartão"].map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-4 hover:border-rose-deep/50"
                  >
                    <RadioGroupItem value={m} />
                    <span>{m}</span>
                  </label>
                ))}
              </RadioGroup>
            </section>

            <Button type="submit" size="lg" className="w-full bg-rose-deep text-primary-foreground" disabled={submitting}>
              {submitting ? (
                "Preparando pedido…"
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" /> Finalizar pelo WhatsApp
                </>
              )}
            </Button>
          </form>

          {/* Resumo */}
          <aside className="h-fit space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-card-soft lg:sticky lg:top-24">
            <h2 className="font-display text-xl">Resumo</h2>
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-3 text-sm">
                  <span className="flex-1">
                    {i.name} <span className="text-muted-foreground">× {i.quantity}</span>
                  </span>
                  <span>{formatBRL(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega</span>
                <span>
                  {deliveryType === "delivery"
                    ? selectedZone
                      ? formatBRL(deliveryFee)
                      : "Escolha o bairro"
                    : "Retirada"}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="text-rose-deep">{formatBRL(total)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-accent/10 p-3 text-xs text-accent-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Seu pedido será enviado pelo WhatsApp para confirmarmos os detalhes.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
