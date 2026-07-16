import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { initialProducts, categories, formatBRL, type Category } from "@/lib/products";
import { whatsappLink } from "@/lib/store-info";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Bruna Café com Flores" },
      { name: "description", content: "Buquês, boxes café da manhã, arranjos e presentes personalizados. Peça direto pelo WhatsApp." },
      { property: "og:title", content: "Catálogo — Bruna Café com Flores" },
      { property: "og:description", content: "12 opções especiais entre flores, cafés e presentes." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "Todos">("Todos");
  const products = useMemo(() => {
    return initialProducts.filter((p) => {
      const okQ = p.name.toLowerCase().includes(q.toLowerCase());
      const okC = cat === "Todos" || p.category === cat;
      return okQ && okC && p.active;
    });
  }, [q, cat]);

  return (
    <div className="pt-24">
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-8">
        <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Catálogo</p>
        <h1 className="mt-2 font-display text-5xl">Presentes para cada momento</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Escolha um item abaixo e finalize seu pedido direto pelo WhatsApp. Também personalizamos qualquer item sob medida.
        </p>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 md:grid-cols-[220px_1fr] md:px-8">
        <aside className="space-y-6">
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
            </div>
          </div>
          <div>
            <h3 className="font-display text-lg">Categorias</h3>
            <div className="mt-3 flex flex-col gap-1">
              {(["Todos", ...categories] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    "rounded-md px-3 py-2 text-left text-sm transition-colors",
                    cat === c ? "bg-rose-deep text-primary-foreground" : "hover:bg-secondary",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section>
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Nenhum produto encontrado.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="group overflow-hidden border-none shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-elegant">
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.category}</p>
                    <h3 className="mt-1 font-display text-xl">{p.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-display text-2xl text-rose-deep">{formatBRL(p.price)}</span>
                      <Button asChild size="sm" className="bg-rose-deep text-primary-foreground">
                        <a href={whatsappLink(`Olá! Tenho interesse no produto ${p.name} — ${formatBRL(p.price)}. Podem me ajudar?`)} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Pedir
                        </a>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
