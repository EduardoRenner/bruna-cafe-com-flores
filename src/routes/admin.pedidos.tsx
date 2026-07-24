import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Printer, Download, CalendarClock } from "lucide-react";
import { formatBRL } from "@/lib/products";
import { getPassword } from "@/lib/auth";
import { adminListOrders, adminUpdateOrderStatus, adminUpdatePaymentStatus, adminDeleteOrder } from "@/lib/admin.functions";
import { STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderRow, type OrderStatus, type PaymentStatus } from "@/lib/orders";
import { downloadOrderPDF, printOrderPDF } from "@/lib/order-pdf";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({ component: PedidosAdmin });

const STATUSES: OrderStatus[] = ["pendente", "em_preparo", "saiu_entrega", "entregue", "cancelado"];
const filters: (OrderStatus | "Todos")[] = ["Todos", ...STATUSES];
const PAYMENT_STATUSES: PaymentStatus[] = ["pendente", "pago", "estornado"];

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "entregue") return "secondary";
  if (s === "pendente") return "default";
  return "outline";
}

function PaymentBadge({ status }: { status?: string }) {
  const s = status ?? "pendente";
  const cls =
    s === "pago"
      ? "bg-green-100 text-green-800 border-green-200"
      : s === "estornado"
        ? "bg-neutral-200 text-neutral-700 border-neutral-300"
        : "bg-amber-100 text-amber-800 border-amber-200";
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", cls)}>{PAYMENT_STATUS_LABELS[s] ?? s}</span>;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
}
function scheduleBadge(dateISO: string | null) {
  if (!dateISO) return null;
  const today = todayISO();
  const tomorrow = tomorrowISO();
  if (dateISO === today) return <Badge className="bg-rose-deep text-primary-foreground">Hoje</Badge>;
  if (dateISO === tomorrow) return <Badge variant="secondary">Amanhã</Badge>;
  return null;
}
function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function addressToText(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, string>;
  const parts = [a.rua, a.numero].filter(Boolean).join(", ");
  return [parts, a.bairro, a.cep && `CEP ${a.cep}`, a.complemento].filter(Boolean).join(" · ") || "—";
}

function PedidosAdmin() {
  const qc = useQueryClient();
  const password = getPassword();
  const listFn = useServerFn(adminListOrders);
  const statusFn = useServerFn(adminUpdateOrderStatus);
  const paymentFn = useServerFn(adminUpdatePaymentStatus);
  const deleteFn = useServerFn(adminDeleteOrder);

  const [f, setF] = useState<OrderStatus | "Todos">("Todos");
  const [scheduledOnly, setScheduledOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"created" | "scheduled">("created");
  const [sel, setSel] = useState<OrderRow | null>(null);
  const [deleting, setDeleting] = useState<OrderRow | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn({ data: { password } }) as Promise<OrderRow[]>,
  });

  const list = useMemo(() => {
    let l = f === "Todos" ? orders : orders.filter((o) => o.status === f);
    if (scheduledOnly) l = l.filter((o) => !!o.delivery_date);
    if (sortBy === "scheduled") {
      l = [...l].sort((a, b) => {
        const av = a.delivery_date ?? "9999-99-99";
        const bv = b.delivery_date ?? "9999-99-99";
        return av.localeCompare(bv);
      });
    }
    return l;
  }, [orders, f, scheduledOnly, sortBy]);

  async function updateStatus(o: OrderRow, status: string) {
    try {
      await statusFn({ data: { password, id: o.id, status } });
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setSel((prev) => (prev && prev.id === o.id ? { ...prev, status } : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  async function updatePayment(o: OrderRow, payment_status: string) {
    try {
      await paymentFn({ data: { password, id: o.id, payment_status } });
      toast.success("Pagamento atualizado");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setSel((prev) => (prev && prev.id === o.id ? { ...prev, payment_status } : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar pagamento");
    }
  }

  async function removeOrder(o: OrderRow) {
    try {
      await deleteFn({ data: { password, id: o.id } });
      toast.success(`Pedido ${o.order_number} excluído`);
      setDeleting(null);
      setSel(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir pedido");
    }
  }

  const items = (o: OrderRow) => (Array.isArray(o.items) ? (o.items as { name: string; quantity: number; price: number }[]) : []);

  return (
    <AdminShell title="Pedidos">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", f === x ? "border-rose-deep bg-rose-deep text-primary-foreground" : "border-border hover:bg-secondary")}
          >
            {x === "Todos" ? "Todos" : STATUS_LABELS[x]}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => setScheduledOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              scheduledOnly ? "border-rose-deep bg-rose-deep text-primary-foreground" : "border-border hover:bg-secondary",
            )}
          >
            <CalendarClock className="h-4 w-4" /> Somente agendados
          </button>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "created" | "scheduled")}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Mais recentes</SelectItem>
              <SelectItem value="scheduled">Data agendada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card className="border-none p-0 shadow-card-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 text-left">Pedido</th>
                <th className="p-4 text-left">Cliente</th>
                <th className="p-4 text-left">Itens</th>
                <th className="p-4 text-left">Agendado</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-left">Pagamento</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} onClick={() => setSel(o)} className="cursor-pointer border-b border-border/50 hover:bg-secondary/40">
                  <td className="p-4 font-medium">{o.order_number}</td>
                  <td className="p-4">{o.customer_name}</td>
                  <td className="p-4 text-muted-foreground">{items(o).reduce((s, i) => s + i.quantity, 0)} item(ns)</td>
                  <td className="p-4">
                    {o.delivery_date ? (
                      <div className="flex items-center gap-2">
                        <span>{fmtDateBR(o.delivery_date)}{o.delivery_time ? ` · ${o.delivery_time}` : ""}</span>
                        {scheduleBadge(o.delivery_date)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">{formatBRL(Number(o.total))}</td>
                  <td className="p-4"><PaymentBadge status={o.payment_status} /></td>
                  <td className="p-4"><Badge variant={statusVariant(o.status)}>{STATUS_LABELS[o.status] ?? o.status}</Badge></td>
                  <td className="p-4 text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {!isLoading && list.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum pedido neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center justify-between gap-3">
              <span>Pedido {sel?.order_number}</span>
              {sel && <PaymentBadge status={sel.payment_status} />}
            </SheetTitle>
          </SheetHeader>
          {sel && (
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => printOrderPDF(sel)}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadOrderPDF(sel)}>
                  <Download className="mr-2 h-4 w-4" /> Baixar PDF
                </Button>
              </div>
              <div><div className="text-xs uppercase text-muted-foreground">Cliente</div><div className="font-medium">{sel.customer_name}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Telefone</div><div>{sel.customer_phone}</div></div>
              {sel.customer_email && <div><div className="text-xs uppercase text-muted-foreground">E-mail</div><div>{sel.customer_email}</div></div>}
              <div>
                <div className="text-xs uppercase text-muted-foreground">Itens</div>
                <ul className="mt-1 space-y-1">
                  {items(sel).map((i, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{i.quantity}× {i.name}</span>
                      <span>{formatBRL(i.price * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div><div className="text-xs uppercase text-muted-foreground">Total</div><div className="font-display text-2xl text-rose-deep">{formatBRL(Number(sel.total))}</div></div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Entrega</div>
                <div>{sel.delivery_type === "delivery" ? "Entrega" : "Retirada na loja"}</div>
                {sel.delivery_type === "delivery" && <div className="text-muted-foreground">{addressToText(sel.delivery_address)}</div>}
              </div>
              {(sel.delivery_date || sel.delivery_time) && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Agendado</div>
                  <div className="flex items-center gap-2">
                    <span>{fmtDateBR(sel.delivery_date)} {sel.delivery_time ?? ""}</span>
                    {scheduleBadge(sel.delivery_date)}
                  </div>
                </div>
              )}
              <div><div className="text-xs uppercase text-muted-foreground">Pagamento</div><div className="capitalize">{sel.payment_method}</div></div>
              <div>
                <div className="mb-1 text-xs uppercase text-muted-foreground">Status do pagamento</div>
                <Select value={sel.payment_status ?? "pendente"} onValueChange={(v) => updatePayment(sel, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {sel.notes && <div><div className="text-xs uppercase text-muted-foreground">Observações</div><div>{sel.notes}</div></div>}
              <div>
                <div className="mb-1 text-xs uppercase text-muted-foreground">Status</div>
                <Select value={sel.status} onValueChange={(v) => updateStatus(sel, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleting(sel)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir pedido
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido <strong>{deleting?.order_number}</strong> de{" "}
              <strong>{deleting?.customer_name}</strong>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && removeOrder(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
