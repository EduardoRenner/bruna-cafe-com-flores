import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/store-info";

export const Route = createFileRoute("/pedido/$orderNumber")({
  head: () => ({ meta: [{ title: "Pedido recebido — Bruna Café com Flores" }, { name: "robots", content: "noindex" }] }),
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { orderNumber } = Route.useParams();
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 text-rose-deep">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="mt-6 font-display text-3xl md:text-4xl">Pedido {orderNumber} recebido!</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Obrigado pela sua compra. Entraremos em contato em breve para confirmar os detalhes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={whatsappLink(`Olá! Acabei de fazer o pedido ${orderNumber} pelo site.`)} target="_blank" rel="noreferrer">
            <Button size="lg" className="bg-rose-deep text-primary-foreground">
              <MessageCircle className="mr-2 h-4 w-4" /> Falar no WhatsApp
            </Button>
          </a>
          <Link to="/catalogo">
            <Button size="lg" variant="outline">
              Voltar à loja
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
