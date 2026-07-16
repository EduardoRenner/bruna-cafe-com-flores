import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatBRL } from "@/lib/products";
import { mockOrders, type Order, type OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/pedidos")({ component: PedidosAdmin });

const filters: (OrderStatus | "Todos")[] = ["Todos", "Novo", "Em preparo", "Entregue"];

function PedidosAdmin() {
  const [f, setF] = useState<OrderStatus | "Todos">("Todos");
  const [sel, setSel] = useState<Order | null>(null);
  const list = useMemo(() => (f === "Todos" ? mockOrders : mockOrders.filter((o) => o.status === f)), [f]);
  return (
    <AdminShell title="Pedidos">
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((x) => (
          <button
            key={x}
            onClick={() => setF(x)}
            className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", f === x ? "border-rose-deep bg-rose-deep text-primary-foreground" : "border-border hover:bg-secondary")}
          >
            {x}
          </button>
        ))}
      </div>
      <Card className="border-none p-0 shadow-card-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-4 text-left">ID</th>
              <th className="p-4 text-left">Cliente</th>
              <th className="p-4 text-left">Produto</th>
              <th className="p-4 text-right">Valor</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Data</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} onClick={() => setSel(o)} className="cursor-pointer border-b border-border/50 hover:bg-secondary/40">
                <td className="p-4 font-medium">{o.id}</td>
                <td className="p-4">{o.customer}</td>
                <td className="p-4 text-muted-foreground">{o.product}</td>
                <td className="p-4 text-right">{formatBRL(o.value)}</td>
                <td className="p-4"><Badge variant={o.status === "Entregue" ? "secondary" : o.status === "Novo" ? "default" : "outline"}>{o.status}</Badge></td>
                <td className="p-4 text-muted-foreground">{new Date(o.date).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle className="font-display">Pedido {sel?.id}</SheetTitle></SheetHeader>
          {sel && (
            <div className="mt-6 space-y-4 text-sm">
              <div><div className="text-xs uppercase text-muted-foreground">Cliente</div><div className="font-medium">{sel.customer}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Produto</div><div>{sel.product}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Valor</div><div className="font-display text-2xl text-rose-deep">{formatBRL(sel.value)}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Status</div><Badge>{sel.status}</Badge></div>
              <div><div className="text-xs uppercase text-muted-foreground">Telefone</div><div>{sel.phone}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Endereço</div><div>{sel.address}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Data</div><div>{new Date(sel.date).toLocaleDateString("pt-BR")}</div></div>
              <Button className="w-full bg-rose-deep text-primary-foreground">Atualizar status</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}
