import { createFileRoute, Link } from "@tanstack/react-router";
import { Flower2, Coffee, Gift, Star, Instagram, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroImg from "@/assets/hero-storefront.jpg";
import cafeImg from "@/assets/cafe-exterior.jpg";
import bouquetImg from "@/assets/bouquet.jpg";
import breakfastImg from "@/assets/breakfast-box.jpg";
import { Petals } from "@/components/site/Petals";
import { initialProducts, formatBRL } from "@/lib/products";
import { store, whatsappLink } from "@/lib/store-info";
import { useReveal } from "@/lib/use-reveal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bruna Café com Flores — Floricultura e Café em Maravilha SC" },
      { name: "description", content: "Transformamos momentos em memórias. Flores frescas, café da manhã na porta e presentes personalizados em Maravilha, SC." },
      { property: "og:title", content: "Bruna Café com Flores — Floricultura e Café em Maravilha SC" },
      { property: "og:description", content: "Transformamos momentos em memórias. Flores frescas, café da manhã na porta e presentes personalizados em Maravilha, SC." },
    ],
  }),
  component: Home,
});

const featured = initialProducts.slice(0, 6);

const testimonials = [
  { name: "Camila R.", text: "Excelente trabalho e ótimas flores! A proprietária é muito prestativa e atenciosa.", stars: 5 },
  { name: "Rafael M.", text: "Pedi um box café da manhã de surpresa e superou todas as expectativas. Recomendo demais.", stars: 5 },
  { name: "Juliana S.", text: "As flores duram muito e sempre chegam lindas. Melhor floricultura de Maravilha.", stars: 5 },
];

function Home() {
  useReveal();
  return (
    <div>
      {/* HERO */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden">
        <img
          src={heroImg}
          alt="Fachada da Bruna Café com Flores com flores rosas e brancas"
          className="absolute inset-0 h-full w-full object-cover"
          width={1024}
          height={1024}
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <Petals count={12} />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center text-primary-foreground">
          <p className="hero-fade-1 mb-4 text-sm uppercase tracking-[0.3em] text-primary-foreground/90">Maravilha · SC</p>
          <h1 className="hero-fade-1 text-balance font-display text-5xl leading-tight sm:text-6xl md:text-7xl">
            Transformamos <em className="italic text-rose">momentos</em> em memórias
          </h1>
          <p className="hero-fade-2 mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/90">
            {store.tagline}
          </p>
          <div className="hero-fade-3 mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-rose-deep text-primary-foreground hover:bg-rose-deep/90">
              <Link to="/catalogo">Ver Catálogo <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <a href={whatsappLink("Olá! Vim pelo site da Bruna.")} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Fale no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* O QUE OFERECEMOS */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <div className="reveal text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">O que oferecemos</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Três universos, uma experiência</h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {[
            { icon: Flower2, title: "Flores & Arranjos", text: "Buquês, arranjos e composições sob medida com flores da estação.", color: "text-rose-deep" },
            { icon: Coffee, title: "Café & Box da Manhã", text: "Boxes surpresa entregues direto na porta de quem você ama.", color: "text-coffee" },
            { icon: Gift, title: "Presentes Personalizados", text: "Cestas temáticas, chocolates finos e presentes únicos.", color: "text-leaf" },
          ].map((item) => (
            <Card key={item.title} className="reveal border-none bg-card p-8 shadow-card-soft transition-transform hover:-translate-y-1 hover:shadow-elegant">
              <item.icon className={`h-10 w-10 ${item.color}`} />
              <h3 className="mt-4 font-display text-2xl">{item.title}</h3>
              <p className="mt-3 text-muted-foreground">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* DESTAQUES */}
      <section className="bg-gradient-soft py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="reveal flex items-end justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Destaque do mês</p>
              <h2 className="mt-3 font-display text-4xl md:text-5xl">Nossos favoritos</h2>
            </div>
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link to="/catalogo">Ver tudo <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <Card key={p.id} className="reveal group overflow-hidden border-none shadow-card-soft transition-all hover:-translate-y-1 hover:shadow-elegant">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.category}</p>
                  <h3 className="mt-1 font-display text-xl">{p.name}</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-display text-2xl text-rose-deep">{formatBRL(p.price)}</span>
                    <Button asChild size="sm" className="bg-rose-deep text-primary-foreground">
                      <a href={whatsappLink(`Olá! Tenho interesse no produto ${p.name} — ${formatBRL(p.price)}. Podem me ajudar?`)} target="_blank" rel="noreferrer">Pedir</a>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* NOSSA HISTÓRIA */}
      <section className="mx-auto grid max-w-7xl gap-14 px-6 py-24 md:grid-cols-2 md:px-8">
        <div className="reveal overflow-hidden rounded-3xl shadow-elegant">
          <img src={cafeImg} alt="Fachada lateral com mesa de ferro" loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="reveal flex flex-col justify-center">
          <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Nossa história</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">Um cantinho especial em Maravilha</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            A Bruna Fernanda Strojake criou este espaço com um propósito simples: entregar afeto em forma de flor, café e presente.
            Cada arranjo é pensado à mão para transformar um dia comum em um dia inesquecível.
          </p>
          <p className="mt-4 text-lg italic leading-relaxed text-foreground">
            "Especialista em presentes únicos para momentos especiais."
          </p>
          <div className="mt-8">
            <Button asChild variant="outline" className="border-rose-deep text-rose-deep hover:bg-rose-deep hover:text-primary-foreground">
              <Link to="/sobre">Conheça a Bruna <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="reveal text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Depoimentos</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">O que dizem sobre a gente</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Card key={i} className="reveal border-none bg-card p-8 shadow-card-soft">
                <div className="flex gap-1 text-rose-deep">
                  {Array.from({ length: t.stars }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-4 text-lg italic leading-relaxed text-foreground">"{t.text}"</p>
                <p className="mt-6 font-display text-sm text-muted-foreground">— {t.name}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className="mx-auto max-w-7xl px-6 py-24 md:px-8">
        <div className="reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Instagram</p>
            <h2 className="mt-3 font-display text-4xl">@{store.instagram}</h2>
          </div>
          <Button asChild variant="ghost">
            <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer">
              <Instagram className="mr-2 h-4 w-4" /> Seguir
            </a>
          </Button>
        </div>
        <div className="reveal mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[bouquetImg, breakfastImg, cafeImg, heroImg, bouquetImg, breakfastImg].map((src, i) => (
            <a key={i} href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl">
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-110" />
            </a>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden bg-gradient-rose py-24 text-primary-foreground">
        <Petals count={8} />
        <div className="reveal relative z-10 mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl">Pronta para surpreender alguém especial?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/90">
            Chame no WhatsApp e monte o presente perfeito com a gente.
          </p>
          <Button asChild size="lg" className="mt-8 bg-cream text-rose-deep hover:bg-cream/90">
            <a href={whatsappLink("Olá! Quero fazer um pedido especial.")} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-5 w-5" /> Falar no WhatsApp
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
