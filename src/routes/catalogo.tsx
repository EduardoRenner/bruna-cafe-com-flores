import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageCircle, Plus, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchActiveProducts, categories, formatBRL, type Category } from "@/lib/products";
import { whatsappLink } from "@/lib/store-info";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Bruna Café com Flores" },
      { name: "description", content: "Buquês, boxes café da manhã, arranjos e presentes personalizados. Peça direto pelo WhatsApp." },
      { property: "og:title", content: "Catálogo — Bruna Café com Flores" },
      { property: "og:description", content: "Opções especiais entre flores, cafés e presentes." },
    ],
  }),
  component: Catalog,
});

// A ordem "Da loja" é a que a Bruna monta arrastando os produtos no painel;
// as demais são só uma reordenação em cima dessa mesma lista.
const ordenacoes = {
  loja: { label: "Ordem da loja" },
  "preco-asc": { label: "Menor preço" },
  "preco-desc": { label: "Maior preço" },
  "nome-asc": { label: "Nome (A–Z)" },
  "nome-desc": { label: "Nome (Z–A)" },
} as const;

type Ordenacao = keyof typeof ordenacoes;

function Catalog() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "Todos">("Todos");
  const [ordem, setOrdem] = useState<Ordenacao>("loja");
  const { add, setOpen } = useCart();

  const { data: all, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchActiveProducts,
  });

  const products = useMemo(() => {
    // Busca também na descrição e na categoria: quem procura "rosa" ou "café"
    // espera achar itens mesmo quando a palavra não está no nome do produto.
    const term = q.trim().toLowerCase();
    const lista = (all ?? []).filter((p) => {
      const okQ =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term);
      const okC = cat === "Todos" || p.category === cat;
      return okQ && okC && p.active;
    });

    // `sort` muta o array, mas `filter` acima já devolveu uma cópia — a lista
    // do cache do react-query não é tocada.
    switch (ordem) {
      case "preco-asc":
        return lista.sort((a, b) => a.price - b.price);
      case "preco-desc":
        return lista.sort((a, b) => b.price - a.price);
      case "nome-asc":
        return lista.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      case "nome-desc":
        return lista.sort((a, b) => b.name.localeCompare(a.name, "pt-BR"));
      default:
        return lista;
    }
  }, [all, q, cat, ordem]);

  return (
    <div className="pt-24">
      <section className="mx-auto max-w-7xl px-6 py-6 md:px-8 md:py-10">
        <p className="text-xs uppercase tracking-[0.3em] text-rose-deep sm:text-sm">Catálogo</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl md:text-5xl">Presentes para cada momento</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:mt-3 md:text-base">
          Escolha um item abaixo, adicione ao carrinho e finalize seu pedido pelo WhatsApp. Também personalizamos qualquer item sob medida.
        </p>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 md:grid-cols-[220px_1fr] md:px-8">
        {/* No mobile os filtros viram uma faixa compacta: uma lista vertical de
            categorias empurrava os produtos para fora da primeira tela. */}
        {/* min-w-0: sem isso a faixa de chips (itens shrink-0) define a largura
            mínima da coluna do grid e estoura a página para o lado no mobile. */}
        <aside className="min-w-0 space-y-4 md:space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
          </div>
          <div>
            <h3 className="hidden font-display text-lg md:block">Categorias</h3>
            <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:mt-3 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
              {(["Todos", ...categories] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors md:rounded-md md:border-none md:px-3 md:py-2 md:text-left",
                    cat === c
                      ? "border-rose-deep bg-rose-deep text-primary-foreground"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ordenar" className="mb-2 flex items-center gap-1.5 font-display text-lg font-normal">
              <ArrowUpDown className="h-4 w-4 text-rose-deep" /> Ordenar por
            </Label>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordenacao)}>
              <SelectTrigger id="ordenar" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ordenacoes) as Ordenacao[]).map((k) => (
                  <SelectItem key={k} value={k}>{ordenacoes[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </aside>

        <section className="striped-bg rounded-3xl p-4 sm:p-6">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Nenhum produto encontrado.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="group flex flex-col overflow-hidden border-none shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-elegant">
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {p.image ? (
                      <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">Sem foto</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.category}</p>
                    <h3 className="mt-1 font-display text-xl">{p.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="font-display text-2xl text-rose-deep">{formatBRL(p.price)}</span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="bg-rose-deep text-primary-foreground"
                          onClick={() => {
                            add({ id: p.id, name: p.name, price: p.price, image: p.image || null });
                            toast.success("Adicionado ao carrinho", { description: p.name });
                            setOpen(true);
                          }}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                        </Button>
                        <Button asChild size="sm" variant="outline" aria-label="Pedir pelo WhatsApp">
                          <a href={whatsappLink(`Olá! Tenho interesse no produto ${p.name} — ${formatBRL(p.price)}. Podem me ajudar?`)} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
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
