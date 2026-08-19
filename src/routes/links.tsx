import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShoppingBag, Instagram, MapPin } from "lucide-react";
import heroImg from "@/assets/hero-storefront.webp";
import { Flourish } from "@/components/site/Flourish";
import { Petals } from "@/components/site/Petals";
import { store, whatsappLink } from "@/lib/store-info";

// Página "link na bio", pensada pro Instagram: sem Navbar/Footer (ver
// isLinks em __root.tsx), só os links que importam pra quem clicou no link
// do perfil no celular.
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
      <Petals count={10} />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center text-primary-foreground">
        <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-primary-foreground/40 bg-primary-foreground/10 backdrop-blur-sm">
          <span className="font-display text-3xl">B</span>
        </div>

        <h1 className="mt-6 font-display text-3xl leading-tight sm:text-4xl">
          Bruna Café <em className="italic text-rose">com Flores</em>
        </h1>
        <Flourish className="mt-4 h-7 w-44 text-primary-foreground/70 flourish-sway" />
        <p className="mt-4 font-display text-lg italic text-rose">
          “{store.motto}”
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-primary-foreground/80">
          <MapPin className="h-3.5 w-3.5" /> Maravilha · SC
        </p>

        <nav className="mt-10 flex w-full flex-col gap-4">
          <a
            href={whatsappLink("Olá! Vim pelo link do Instagram.")}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-2xl border border-primary-foreground/25 bg-primary-foreground/10 px-6 py-4 text-left shadow-card-soft backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-primary-foreground/20"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-display text-lg">Fale conosco no Zap</span>
              <span className="block text-sm text-primary-foreground/75">Tire dúvidas e monte seu pedido</span>
            </span>
          </a>

          <a
            href="/catalogo"
            className="group flex items-center gap-3 rounded-2xl border border-rose-deep/30 bg-rose-deep px-6 py-4 text-left shadow-card-soft transition-all hover:-translate-y-0.5 hover:bg-rose-deep/90"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="flex-1 text-primary-foreground">
              <span className="block font-display text-lg">Faça seu pedido no site</span>
              <span className="block text-sm text-primary-foreground/80">Flores, café e presentes especiais</span>
            </span>
          </a>

          <a
            href={`https://instagram.com/${store.instagram}`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-2xl border border-primary-foreground/25 bg-primary-foreground/10 px-6 py-4 text-left shadow-card-soft backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-primary-foreground/20"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white">
              <Instagram className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-display text-lg">Ver o Instagram</span>
              <span className="block text-sm text-primary-foreground/75">@{store.instagram}</span>
            </span>
          </a>
        </nav>

        <Flourish className="mt-10 h-7 w-44 text-primary-foreground/50 flourish-sway" />
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-primary-foreground/60">
          Onde sentimentos ganham forma
        </p>
      </div>
    </div>
  );
}
