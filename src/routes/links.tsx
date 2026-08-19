import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShoppingBag, MapPin, Flower2 } from "lucide-react";
import heroImg from "@/assets/hero-storefront.webp";
import { Flourish } from "@/components/site/Flourish";
import { Petals } from "@/components/site/Petals";
import { store, whatsappLink } from "@/lib/store-info";

// Página "link na bio": sem Navbar/Footer (ver isLinks em __root.tsx), só
// os dois links que importam pra quem clicou no link do perfil no celular.
export const Route = createFileRoute("/links")({
  head: () => ({
    meta: [
      { title: "Bruna Café com Flores — Links" },
      { name: "description", content: "Fale no WhatsApp ou faça seu pedido no site da Bruna Café com Flores." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <img
        src={heroImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-black/10" />
      <Petals count={18} />

      {/* Arabescos de canto, baixinho na opacidade — mesmo truque usado na
          seção "Nossa história" da home, pra moldura sem competir com o texto. */}
      <Flourish className="pointer-events-none absolute -left-10 -top-6 h-24 w-72 -rotate-6 text-primary-foreground/10" />
      <Flourish className="pointer-events-none absolute -right-10 bottom-4 h-24 w-72 rotate-6 text-primary-foreground/10" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center text-primary-foreground">
        <div className="hero-fade-1 relative grid h-24 w-24 place-items-center rounded-full border-2 border-rose/60 bg-primary-foreground/10 shadow-elegant backdrop-blur-sm">
          <div className="absolute inset-0 rounded-full ring-4 ring-primary-foreground/10" />
          <Flower2 className="h-9 w-9 text-rose" strokeWidth={1.5} />
        </div>

        <h1 className="hero-fade-1 mt-6 font-display text-3xl leading-tight sm:text-4xl">
          Bruna Café <em className="italic text-rose">com Flores</em>
        </h1>
        <Flourish className="hero-fade-2 mt-4 h-7 w-44 text-primary-foreground/70 flourish-sway" />
        <p className="hero-fade-2 mt-4 font-display text-lg italic text-rose sm:text-xl">
          “{store.motto}”
        </p>
        <p className="hero-fade-2 mt-3 flex items-center gap-1.5 text-sm text-primary-foreground/80">
          <MapPin className="h-3.5 w-3.5" /> Maravilha · SC
        </p>

        <nav className="hero-fade-3 mt-10 flex w-full flex-col gap-4">
          <a
            href={whatsappLink("Olá! Vim pelo link do perfil.")}
            target="_blank"
            rel="noreferrer"
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary-foreground/25 bg-primary-foreground/10 px-6 py-4 text-left shadow-card-soft backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary-foreground/40 hover:bg-primary-foreground/20 hover:shadow-elegant"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-md transition-transform group-hover:scale-110">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-display text-lg">Fale conosco no WhatsApp</span>
              <span className="block text-sm text-primary-foreground/75">Tire dúvidas e monte seu pedido</span>
            </span>
          </a>

          <a
            href="/catalogo"
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-rose-deep/40 bg-gradient-rose px-6 py-4 text-left shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-elegant"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-foreground/20 text-primary-foreground shadow-md transition-transform group-hover:scale-110">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="flex-1 text-primary-foreground">
              <span className="block font-display text-lg">Faça seu pedido no site</span>
              <span className="block text-sm text-primary-foreground/85">Flores, café e presentes especiais</span>
            </span>
          </a>
        </nav>

        <Flourish className="hero-fade-3 mt-10 h-7 w-44 text-primary-foreground/50 flourish-sway" />
        <p className="hero-fade-3 mt-4 text-xs uppercase tracking-[0.3em] text-primary-foreground/60">
          Onde sentimentos ganham forma
        </p>
      </div>
    </div>
  );
}
