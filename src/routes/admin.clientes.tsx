import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/products";

export const Route = createFileRoute("/admin/clientes")({ component: Clientes });

const clientes = [
  { nome: "Maria Souza", telefone: "(49) 99123-4567", pedidos: 5, total: 890.5 },
  { nome: "Carlos Mendes", telefone: "(49) 99987-6543", pedidos: 3, total: 420 },
  { nome: "Ana Beatriz", telefone: "(47) 99845-1122", pedidos: 4, total: 780 },
  { nome: "Felipe Almeida", telefone: "(49) 99230-4567", pedidos: 2, total: 220 },
  { nome: "Larissa Ribeiro", telefone: "(49) 99112-3344", pedidos: 6, total: 1120 },
];
function Clientes() {
  return (
    <AdminShell title="Clientes">
      <Card className="border-none p-0 shadow-card-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr><th className="p-4 text-left">Cliente</th><th className="p-4 text-left">Telefone</th><th className="p-4 text-right">Pedidos</th><th className="p-4 text-right">Total gasto</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.nome} className="border-b border-border/50">
                <td className="p-4 font-medium">{c.nome}</td>
                <td className="p-4 text-muted-foreground">{c.telefone}</td>
                <td className="p-4 text-right">{c.pedidos}</td>
                <td className="p-4 text-right">{formatBRL(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
