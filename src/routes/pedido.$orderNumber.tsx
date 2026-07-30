import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/store-info";
import { formatBRL } from "@/lib/products";
import { consultarPedidoPublico } from "@/lib/payment.functions";

export const Route = createFileRoute("/pedido/$orderNumber")({
  head: () => ({
    meta: [
      { title: "Pedido recebido — Bruna Café com Flores" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderConfirmation,
});

/**
 * O parâmetro da URL pode ser duas coisas:
 *
 *   - o token aleatório (48 hex), quando o cliente vem do checkout ou volta do
 *     pagamento — aí conseguimos mostrar o status real;
 *   - o número do pedido (BCF-1000), de links antigos — aí só confirmamos o
 *     recebimento, porque consultar por número sequencial deixaria qualquer um
 *     ler o pedido dos outros trocando o número na barra de endereço.
 */
function ehToken(valor: string): boolean {
  return /^[a-f0-9]{48}$/.test(valor);
}

function OrderConfirmation() {
  const { orderNumber: ref } = Route.useParams();
  const consultar = useServerFn(consultarPedidoPublico);
  const token = ehToken(ref);

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedido-publico", ref],
    queryFn: () => consultar({ data: { token: ref } }),
    enabled: token,
    // O cliente pode chegar aqui antes do gateway avisar; algumas recargas
    // resolvem sem ele precisar fazer nada.
    refetchInterval: (q) =>
      q.state.data?.paymentStatus === "pendente" ? 5000 : false,
  });

  const numeroExibido = pedido?.orderNumber ?? (token ? null : ref);
  const pago = pedido?.paymentStatus === "pago";
  const aguardando = token && !isLoading && pedido?.paymentStatus === "pendente";

  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <div
          className={
            "grid h-20 w-20 place-items-center rounded-full " +
            (aguardando ? "bg-amber-100 text-amber-700" : "bg-accent/15 text-rose-deep")
          }
        >
          {aguardando ? <Clock className="h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
        </div>

        <h1 className="mt-6 font-display text-3xl md:text-4xl">
          {numeroExibido ? `Pedido ${numeroExibido} recebido!` : "Pedido recebido!"}
        </h1>

        {pago ? (
          <p className="mt-3 max-w-md text-muted-foreground">
            Pagamento confirmado. Já estamos preparando tudo — entraremos em contato para
            combinar a entrega.
          </p>
        ) : aguardando ? (
          <p className="mt-3 max-w-md text-muted-foreground">
            Estamos aguardando a confirmação do pagamento. Assim que o banco confirmar, esta
            página atualiza sozinha. Se você escolheu Pix, pode levar alguns instantes.
          </p>
        ) : (
          <p className="mt-3 max-w-md text-muted-foreground">
            Obrigado pela sua compra. Entraremos em contato em breve para confirmar os detalhes.
          </p>
        )}

        {pedido && (
          <p className="mt-4 font-display text-2xl text-rose-deep">
            {formatBRL(pedido.total)}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={whatsappLink(
              `Olá! Acabei de fazer o pedido ${numeroExibido ?? ""} pelo site.`.trim(),
            )}
            target="_blank"
            rel="noreferrer"
          >
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
