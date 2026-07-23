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
import { Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/products";
import { getPassword } from "@/lib/auth";
import { adminListOrders, adminUpdateOrderStatus, adminDeleteOrder } from "@/lib/admin.functions";
import { STATUS_LABELS, type OrderRow, type OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({ component: PedidosAdmin });

const STATUSES: OrderStatus[] = ["pendente", "em_preparo", "saiu_entrega", "entregue", "cancelado"];
const filters: (OrderStatus | "Todos")[] = ["Todos", ...STATUSES];

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "entregue") return "secondary";
  if (s === "pendente") return "default";
  return "outline";
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
  const deleteFn = useServerFn(adminDeleteOrder);

  const [f, setF] = useState<OrderStatus | "Todos">("Todos");
  const [sel, setSel] = useState<OrderRow | null>(null);
  const [deleting, setDeleting] = useState<OrderRow | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn({ data: { password } }) as Promise<OrderRow[]>,
  });

  const list = useMemo(() => (f === "Todos" ? orders : orders.filter((o) => o.status === f)), [orders, f]);

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
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", f === x ? "border-rose-deep bg-rose-deep text-primary-foreground" : "border-border hover:bg-secondary")}
          >
            {x === "Todos" ? "Todos" : STATUS_LABELS[x]}
          </button>
        ))}
      </div>
      <Card className="border-none p-0 shadow-card-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 text-left">Pedido</th>
                <th className="p-4 text-left">Cliente</th>
                <th className="p-4 text-left">Itens</th>
                <th className="p-4 text-right">Total</th>
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
                  <td className="p-4 text-right">{formatBRL(Number(o.total))}</td>
                  <td className="p-4"><Badge variant={statusVariant(o.status)}>{STATUS_LABELS[o.status] ?? o.status}</Badge></td>
                  <td className="p-4 text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {!isLoading && list.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum pedido neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-display">Pedido {sel?.order_number}</SheetTitle></SheetHeader>
          {sel && (
            <div className="mt-6 space-y-4 text-sm">
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
                <div><div className="text-xs uppercase text-muted-foreground">Agendado</div><div>{sel.delivery_date ? new Date(sel.delivery_date + "T00:00").toLocaleDateString("pt-BR") : ""} {sel.delivery_time ?? ""}</div></div>
              )}
              <div><div className="text-xs uppercase text-muted-foreground">Pagamento</div><div className="capitalize">{sel.payment_method}</div></div>
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
