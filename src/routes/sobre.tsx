import { createFileRoute } from "@tanstack/react-router";
import { store } from "@/lib/store-info";
import cafeImg from "@/assets/cafe-exterior.jpg";
import heroImg from "@/assets/hero-storefront.jpg";
import bouquetImg from "@/assets/bouquet.jpg";
import { Card } from "@/components/ui/card";
import { Clock, MapPin, Sparkles, Heart, Flower2 } from "lucide-react";
import { useReveal } from "@/lib/use-reveal";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Bruna Café com Flores" },
      { name: "description", content: "Conheça a história da Bruna Fernanda Strojake e o cantinho especial em Maravilha, SC." },
      { property: "og:title", content: "Sobre a Bruna Café com Flores" },
      { property: "og:description", content: "Especialista em presentes únicos para momentos especiais." },
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
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Um espaço criado com carinho pela <strong>Bruna Fernanda Strojake</strong> para transformar o dia das pessoas em algo especial —
          através de flores frescas, café artesanal e presentes pensados nos mínimos detalhes.
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
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Heart, title: "Missão", text: "Entregar afeto em cada arranjo, transformando momentos comuns em memórias afetivas." },
            { icon: Sparkles, title: "Visão", text: "Ser referência em presentes personalizados e experiências florais em Santa Catarina." },
            { icon: Flower2, title: "Diferenciais", text: "Atendimento próximo, montagem à mão e entrega no mesmo dia em Maravilha e região." },
          ].map((v) => (
            <Card key={v.title} className="reveal border-none bg-card p-8 shadow-card-soft">
              <v.icon className="h-8 w-8 text-rose-deep" />
              <h3 className="mt-4 font-display text-2xl">{v.title}</h3>
              <p className="mt-2 text-muted-foreground">{v.text}</p>
            </Card>
          ))}
        </div>
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
