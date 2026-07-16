import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Users, Sparkles, Settings, LogOut, Flower2 } from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/ia", label: "IA Assistant", icon: Sparkles },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen bg-sidebar-accent/20">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
          <Flower2 className="h-6 w-6 text-sidebar-primary" />
          <div>
            <div className="font-display text-lg leading-tight">Bruna Café</div>
            <div className="text-xs text-sidebar-foreground/60">Painel Admin</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => { logout(); navigate({ to: "/admin" }); location.reload(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
          <h1 className="font-display text-2xl">{title}</h1>
          <div className="hidden text-sm text-muted-foreground md:block">Bruna Café com Flores · Maravilha, SC</div>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
