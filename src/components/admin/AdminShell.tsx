import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Users, Settings, LogOut, Flower2, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminLogout } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const logoutFn = useServerFn(adminLogout);

  // Sair tem que apagar o cookie no SERVIDOR: como a sessão mora inteira
  // nele, limpar qualquer coisa só no cliente deixaria a sessão viva para
  // quem reabrisse a aba.
  async function sair() {
    try {
      await logoutFn({});
    } finally {
      navigate({ to: "/admin" });
      location.reload();
    }
  }

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {nav.map((n) => {
        const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to as string}
            onClick={onNavigate}
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
    </>
  );

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
          <NavList />
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-6 md:py-4">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
                  <Flower2 className="h-6 w-6 text-sidebar-primary" />
                  <div>
                    <div className="font-display text-lg leading-tight">Bruna Café</div>
                    <div className="text-xs text-sidebar-foreground/60">Painel Admin</div>
                  </div>
                </div>
                <nav className="flex-1 space-y-1 px-3 py-4">
                  <NavList onNavigate={() => setOpen(false)} />
                </nav>
                <div className="border-t border-sidebar-border p-3">
                  <button
                    onClick={() => { setOpen(false); void sair(); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="font-display text-xl md:text-2xl">{title}</h1>
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">Bruna Café com Flores · Maravilha, SC</div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
