import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, DollarSign, Package, UserPlus, Sparkles } from "lucide-react";
import { formatBRL, initialProducts } from "@/lib/products";
import { mockOrders } from "@/lib/orders";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const salesByCat = [
  { name: "Flores", value: 42 },
  { name: "Café & Box", value: 28 },
  { name: "Presentes", value: 18 },
  { name: "Arranjos", value: 12 },
];
const revenueByWeek = [
  { week: "S1", receita: 1520 },
  { week: "S2", receita: 2140 },
  { week: "S3", receita: 1980 },
  { week: "S4", receita: 2700 },
];
const COLORS = ["oklch(0.78 0.09 5)", "oklch(0.6 0.14 10)", "oklch(0.72 0.08 145)", "oklch(0.65 0.12 65)"];

function Dashboard() {
  const stats = [
    { label: "Total de Pedidos", value: "47", icon: ShoppingBag, tint: "text-rose-deep" },
    { label: "Receita do Mês", value: formatBRL(8340), icon: DollarSign, tint: "text-leaf" },
    { label: "Produtos Ativos", value: String(initialProducts.filter((p) => p.active).length), icon: Package, tint: "text-coffee" },
    { label: "Novos Clientes", value: "8", icon: UserPlus, tint: "text-rose" },
  ];
  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-none p-5 shadow-card-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-5 w-5 ${s.tint}`} />
            </div>
            <div className="mt-3 font-display text-3xl">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-none p-6 shadow-card-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Vendas por categoria</h3>
            <Badge variant="secondary">30 dias</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={salesByCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                  {salesByCat.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="border-none p-6 shadow-card-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Receita semanal</h3>
            <Badge variant="secondary">Mês atual</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByWeek}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Bar dataKey="receita" fill="oklch(0.6 0.14 10)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-none p-6 shadow-card-soft">
          <h3 className="font-display text-lg">Pedidos recentes</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left">ID</th>
                  <th className="py-2 text-left">Cliente</th>
                  <th className="py-2 text-left">Produto</th>
                  <th className="py-2 text-right">Valor</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.slice(0, 5).map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-3 font-medium">{o.id}</td>
                    <td className="py-3">{o.customer}</td>
                    <td className="py-3 text-muted-foreground">{o.product}</td>
                    <td className="py-3 text-right">{formatBRL(o.value)}</td>
                    <td className="py-3">
                      <Badge variant={o.status === "Entregue" ? "secondary" : o.status === "Novo" ? "default" : "outline"}>{o.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="border-none p-6 shadow-card-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-deep" />
            <h3 className="font-display text-lg">Chatbot IA</h3>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-leaf" />
            <span className="text-sm text-muted-foreground">Online e respondendo</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A assistente virtual está ativa no site e respondeu <strong className="text-foreground">23 conversas</strong> nesta semana.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
