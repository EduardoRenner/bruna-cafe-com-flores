import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/products";
import { getPassword } from "@/lib/auth";
import { adminListOrders } from "@/lib/admin.functions";
import type { OrderRow } from "@/lib/orders";

export const Route = createFileRoute("/admin/clientes")({ component: Clientes });

type Cliente = {
  nome: string;
  telefone: string;
  email: string | null;
  pedidos: number;
  total: number;
  ultimoPedido: string;
};

// Deriva a lista de clientes a partir dos pedidos reais, agrupando pelo telefone
// (só dígitos). O total considera pedidos não cancelados.
function agregarClientes(orders: OrderRow[]): Cliente[] {
  const map = new Map<string, Cliente>();
  for (const o of orders) {
    const key = (o.customer_phone || "").replace(/\D/g, "") || o.customer_name;
    const gasto = o.status === "cancelado" ? 0 : Number(o.total) || 0;
    const existing = map.get(key);
    if (existing) {
      existing.pedidos += 1;
      existing.total += gasto;
      if (o.created_at > existing.ultimoPedido) {
        existing.ultimoPedido = o.created_at;
        existing.nome = o.customer_name;
        existing.telefone = o.customer_phone;
      }
      if (!existing.email && o.customer_email) existing.email = o.customer_email;
    } else {
      map.set(key, {
        nome: o.customer_name,
        telefone: o.customer_phone,
        email: o.customer_email,
        pedidos: 1,
        total: gasto,
        ultimoPedido: o.created_at,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function Clientes() {
  const password = getPassword();
  const listFn = useServerFn(adminListOrders);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn({ data: { password } }) as Promise<OrderRow[]>,
  });

  const clientes = useMemo(() => agregarClientes(orders), [orders]);

  return (
    <AdminShell title="Clientes">
      <p className="mb-4 text-sm text-muted-foreground">
        {isLoading ? "Carregando…" : `${clientes.length} cliente(s) — a partir dos pedidos recebidos`}
      </p>
      <Card className="border-none p-0 shadow-card-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4 text-left">Cliente</th>
                <th className="p-4 text-left">Telefone</th>
                <th className="p-4 text-left">E-mail</th>
                <th className="p-4 text-right">Pedidos</th>
                <th className="p-4 text-right">Total gasto</th>
                <th className="p-4 text-left">Último pedido</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.telefone + c.nome} className="border-b border-border/50">
                  <td className="p-4 font-medium">{c.nome}</td>
                  <td className="p-4 text-muted-foreground">{c.telefone}</td>
                  <td className="p-4 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="p-4 text-right">{c.pedidos}</td>
                  <td className="p-4 text-right">{formatBRL(c.total)}</td>
                  <td className="p-4 text-muted-foreground">{new Date(c.ultimoPedido).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {!isLoading && clientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum cliente ainda. Os clientes aparecem aqui conforme os pedidos chegam.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
