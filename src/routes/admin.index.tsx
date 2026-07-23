import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, DollarSign, Package, Clock, Sparkles } from "lucide-react";
import { formatBRL } from "@/lib/products";
import { getPassword } from "@/lib/auth";
import { adminStats } from "@/lib/admin.functions";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["oklch(0.78 0.09 5)", "oklch(0.6 0.14 10)", "oklch(0.72 0.08 145)", "oklch(0.65 0.12 65)", "oklch(0.38 0.07 55)"];

function Dashboard() {
  const password = getPassword();
  const statsFn = useServerFn(adminStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => statsFn({ data: { password } }),
  });

  const kpis = [
    { label: "Pedidos hoje", value: data ? String(data.todayCount) : "—", icon: ShoppingBag, tint: "text-rose-deep" },
    { label: "Receita do mês", value: data ? formatBRL(data.monthRevenue) : "—", icon: DollarSign, tint: "text-leaf" },
    { label: "Produtos ativos", value: data ? String(data.activeProducts) : "—", icon: Package, tint: "text-coffee" },
    { label: "Pendentes", value: data ? String(data.pendingCount) : "—", icon: Clock, tint: "text-rose" },
  ];

  const monthly = (data?.monthlyRevenue ?? []).map((v, i) => ({ mes: MONTHS[i], receita: v }));
  const topProducts = data?.topProducts ?? [];

  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map((s) => (
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
            <h3 className="font-display text-lg">Faturamento por mês</h3>
            <Badge variant="secondary">Ano atual</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Bar dataKey="receita" fill="oklch(0.6 0.14 10)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="border-none p-6 shadow-card-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Produtos mais vendidos</h3>
            <Badge variant="secondary">Top 5</Badge>
          </div>
          <div className="h-64">
            {topProducts.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                {isLoading ? "Carregando…" : "Sem vendas ainda."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topProducts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {topProducts.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-none p-6 shadow-card-soft">
          <h3 className="font-display text-lg">Resumo do período</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
            <div><dt className="text-muted-foreground">Ticket médio</dt><dd className="mt-1 font-display text-xl">{data ? formatBRL(data.ticketMedio) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Pedidos no ano</dt><dd className="mt-1 font-display text-xl">{data ? data.totalOrdersYear : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Melhor mês</dt><dd className="mt-1 font-display text-xl">{data?.melhorMes ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Produto campeão</dt><dd className="mt-1 font-medium">{data?.produtoCampeao ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Horário de pico</dt><dd className="mt-1 font-medium">{data?.horarioPico ?? "—"}</dd></div>
          </dl>
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
            A assistente virtual está ativa no site, ajudando os clientes a escolher flores, cafés e presentes.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
