import { createFileRoute } from "@tanstack/react-router";
import { store } from "@/lib/store-info";
import cafeImg from "@/assets/cafe-exterior.webp";
import heroImg from "@/assets/hero-storefront.webp";
import bouquetImg from "@/assets/bouquet.webp";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, Sparkles, Heart, Flower2 } from "lucide-react";
import { useReveal } from "@/lib/use-reveal";
import { Flourish } from "@/components/site/Flourish";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Bruna Café com Flores" },
      { name: "description", content: "Onde sentimentos ganham forma. Conheça a história, a missão e os valores da Bruna Café com Flores, em Maravilha, SC." },
      { property: "og:title", content: "Sobre a Bruna Café com Flores" },
      { property: "og:description", content: "Onde sentimentos ganham forma." },
    ],
  }),
  component: About,
});

function About() {
  useReveal();
  const mapUrl = `https://www.google.com/maps?q=${store.coords.lat},${store.coords.lng}&hl=pt-BR&z=16&output=embed`;
  return (
    <div className="pt-24">
      <section className="mx-auto max-w-5xl px-6 py-16 text-center md:px-8">
        <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Sobre</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl">A Bruna Café com Flores</h1>
        <Flourish className="mx-auto mt-5 h-9 w-56 text-rose-deep flourish-sway" />
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Na Bruna Café com Flores, acreditamos que presentear é uma forma de transformar sentimentos em memórias.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Somos uma floricultura personalizada e um espaço de presentes especiais, onde flores, sabores e detalhes
          se encontram para criar experiências únicas e cheias de significado.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Cada presente é pensado com carinho para celebrar, agradecer, surpreender ou simplesmente dizer
          “eu pensei em você”. Mais do que flores, criamos experiências para tornar cada momento inesquecível.
        </p>
        <p className="mx-auto mt-6 max-w-2xl font-display text-2xl italic text-rose-deep">
          “Onde sentimentos ganham forma”
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 md:grid-cols-2 md:px-8">
        <div className="reveal overflow-hidden rounded-3xl shadow-elegant">
          <img src={heroImg} alt="Fachada da loja" loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="reveal overflow-hidden rounded-3xl shadow-elegant">
          <img src={cafeImg} alt="Área externa da loja" loading="lazy" className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:px-8">
        <div className="striped-bg grid gap-6 rounded-3xl p-4 sm:p-6 md:grid-cols-2">
          {[
            { icon: Flower2, title: "Missão", text: "Transformar sentimentos em experiências especiais, criando flores, presentes e momentos preparados com carinho, significado e atenção a cada detalhe." },
            { icon: Sparkles, title: "Visão", text: "Ser referência em presentes personalizados e experiências afetivas, reconhecida pelo cuidado, criatividade e excelência em cada entrega — em Maravilha e além." },
          ].map((v) => (
            <Card key={v.title} className="reveal striped-soft border-none p-8 shadow-card-soft">
              <v.icon className="h-8 w-8 text-rose-deep" />
              <h3 className="mt-4 font-display text-2xl">{v.title}</h3>
              <p className="mt-2 text-muted-foreground">{v.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 md:px-8">
        <div className="reveal text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Nossos valores</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">O que nos guia</h2>
          <Flourish className="mx-auto mt-5 h-9 w-56 text-rose-deep flourish-sway" />
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Cuidado", text: "Cada detalhe importa." },
            { title: "Afeto", text: "Tudo começa com um sentimento." },
            { title: "Personalização", text: "Cada pessoa e cada momento são únicos." },
            { title: "Qualidade", text: "Escolhemos e preparamos tudo com excelência." },
            { title: "Criatividade", text: "Transformamos ideias em presentes que surpreendem." },
            { title: "Encantamento", text: "Queremos que cada experiência seja lembrada." },
            { title: "Verdade", text: "Atendimento próximo, humano e feito com carinho." },
          ].map((v) => (
            <Card key={v.title} className="reveal border-none bg-card p-6 shadow-card-soft">
              <Heart className="h-6 w-6 text-rose-deep" />
              <h3 className="mt-3 font-display text-xl">{v.title}</h3>
              <p className="mt-1 text-muted-foreground">{v.text}</p>
            </Card>
          ))}
        </div>
        <p className="reveal mx-auto mt-12 max-w-2xl text-center font-display text-2xl italic text-rose-deep">
          “Mais do que flores, entregamos sentimentos que florescem em memórias.” 🌷
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.2fr_1fr] md:px-8">
        <div className="reveal overflow-hidden rounded-3xl shadow-elegant">
          <iframe
            src={mapUrl}
            className="h-96 w-full border-0"
            loading="lazy"
            title="Localização da Bruna Café com Flores"
          />
        </div>
        <div className="reveal">
          <h2 className="font-display text-3xl">Onde nos encontrar</h2>
          <Flourish className="mt-4 h-7 w-44 text-rose-deep/80 flourish-sway" />
          <p className="mt-4 flex gap-2 text-muted-foreground"><MapPin className="mt-0.5 h-5 w-5 text-rose-deep" /> {store.address}</p>
          <h3 className="mt-8 font-display text-2xl">Horários</h3>
          <ul className="mt-3 space-y-3">
            {store.hours.map((h) => (
              <li key={h.day} className="flex gap-3 rounded-xl bg-secondary/50 p-4">
                <Clock className="mt-0.5 h-5 w-5 text-rose-deep" />
                <div>
                  <div className="font-medium">{h.day}</div>
                  <div className="text-sm text-muted-foreground">{h.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-8">
        <div className="reveal overflow-hidden rounded-3xl">
          <img src={bouquetImg} alt="Buquê" loading="lazy" className="max-h-[500px] w-full object-cover" />
        </div>
      </section>
    </div>
  );
}
