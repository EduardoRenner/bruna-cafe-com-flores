import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { store, whatsappLink } from "@/lib/store-info";
import { Instagram, MapPin, Phone, MessageCircle, Clock } from "lucide-react";
import { Flourish } from "@/components/site/Flourish";
import { toast } from "sonner";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Bruna Café com Flores" },
      { name: "description", content: "Fale com a Bruna Café com Flores em Maravilha, SC. WhatsApp, Instagram, telefone e mensagem." },
      { property: "og:title", content: "Contato — Bruna Café com Flores" },
      { property: "og:description", content: "Estamos prontas para ajudar você a montar o presente perfeito." },
    ],
  }),
  component: Contato,
});

function Contato() {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [sending, setSending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast.success("Mensagem recebida! Retornaremos em breve.", { description: "Também pode falar direto no WhatsApp." });
      setForm({ nome: "", email: "", telefone: "", mensagem: "" });
      setSending(false);
    }, 700);
  }

  return (
    <div className="pt-24">
      <section className="mx-auto max-w-5xl px-6 py-16 text-center md:px-8">
        <p className="text-sm uppercase tracking-[0.3em] text-rose-deep">Contato</p>
        <h1 className="mt-3 font-display text-5xl">Vamos conversar</h1>
        <Flourish className="mx-auto mt-5 h-9 w-56 text-rose-deep flourish-sway" />
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Deixe uma mensagem ou fale direto no WhatsApp. Adoramos ajudar você a escolher o presente certo.
        </p>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-24 md:px-8">
        <div className="striped-bg grid gap-8 rounded-3xl p-4 sm:p-6 md:grid-cols-[1.2fr_1fr]">
        <Card className="striped-soft border-none p-8 shadow-card-soft">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" required value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea id="mensagem" required rows={5} value={form.mensagem} onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={sending} className="w-full bg-rose-deep text-primary-foreground hover:bg-rose-deep/90">
              {sending ? "Enviando..." : "Enviar mensagem"}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <a href={whatsappLink("Olá! Vim pelo site.")} target="_blank" rel="noreferrer" className="block">
            <Card className="flex items-center gap-4 border-none bg-gradient-rose p-6 text-primary-foreground shadow-elegant transition-transform hover:-translate-y-1">
              <MessageCircle className="h-8 w-8" />
              <div>
                <div className="font-display text-lg">WhatsApp</div>
                <div className="text-sm opacity-90">{store.whatsapp}</div>
              </div>
            </Card>
          </a>
          <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="block">
            <Card className="flex items-center gap-4 border-none bg-card p-6 shadow-card-soft transition-transform hover:-translate-y-1">
              <Instagram className="h-8 w-8 text-rose-deep" />
              <div>
                <div className="font-display text-lg">Instagram</div>
                <div className="text-sm text-muted-foreground">@{store.instagram}</div>
              </div>
            </Card>
          </a>
          <a href={`tel:${store.phoneDigits}`} className="block">
            <Card className="flex items-center gap-4 border-none bg-card p-6 shadow-card-soft transition-transform hover:-translate-y-1">
              <Phone className="h-8 w-8 text-leaf" />
              <div>
                <div className="font-display text-lg">Telefone</div>
                <div className="text-sm text-muted-foreground">{store.phone}</div>
              </div>
            </Card>
          </a>
          <Card className="border-none p-6 shadow-card-soft">
            <MapPin className="h-6 w-6 text-rose-deep" />
            <p className="mt-3 text-sm text-muted-foreground">{store.address}</p>
          </Card>
          <Card className="border-none p-6 shadow-card-soft">
            <div className="flex items-center gap-2 text-rose-deep"><Clock className="h-5 w-5" /><span className="font-display text-lg">Horários</span></div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {store.hours.map((h) => (<li key={h.day}><strong className="text-foreground">{h.day}:</strong> {h.time}</li>))}
            </ul>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
