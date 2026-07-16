import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Flower2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Início" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/sobre", label: "Sobre" },
  { to: "/contato", label: "Contato" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onHero = pathname === "/" && !scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all",
        scrolled ? "bg-background/90 backdrop-blur shadow-card-soft" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link to="/" className={cn("flex items-center gap-2", onHero ? "text-primary-foreground" : "text-foreground")}>
          <Flower2 className="h-6 w-6 text-rose-deep" />
          <span className="font-display text-lg font-semibold tracking-tight">Bruna Café com Flores</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "text-sm font-medium transition-colors hover:text-rose-deep",
                onHero ? "text-primary-foreground/90" : "text-foreground/80",
              )}
              activeProps={{ className: "text-rose-deep" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          <Button asChild size="sm" className="bg-rose-deep text-primary-foreground hover:bg-rose-deep/90">
            <a href="https://wa.me/5547991072410" target="_blank" rel="noreferrer">WhatsApp</a>
          </Button>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <button className={cn("rounded-md p-2 md:hidden", onHero ? "text-primary-foreground" : "text-foreground")} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="font-display">Menu</SheetTitle>
            <div className="mt-8 flex flex-col gap-4">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="text-lg font-medium text-foreground hover:text-rose-deep">
                  {l.label}
                </Link>
              ))}
              <Button asChild className="mt-4 bg-rose-deep text-primary-foreground">
                <a href="https://wa.me/5547991072410" target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
