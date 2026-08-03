import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { confirmDelivery, getOrderForDeliveryConfirmation } from "@/lib/order.functions";

// Página pública que o entregador abre pelo QR code do comprovante impresso
// no PDF do pedido — sem login, pensada para ser usada no celular na porta
// do cliente. Depois de confirmada, a entrega já aparece como "Entregue" no
// painel admin.

export const Route = createFileRoute("/confirmar-entrega/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar entrega — Bruna Café com Flores" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmarEntregaPage,
});

const RECEIVED_TYPES = [
  { value: "em_maos", label: "Em mãos" },
  { value: "familiar", label: "Familiar" },
  { value: "portaria", label: "Portaria" },
  { value: "vizinho", label: "Vizinho" },
];

function ConfirmarEntregaPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getOrder = useServerFn(getOrderForDeliveryConfirmation);
  const confirm = useServerFn(confirmDelivery);

  const [receivedBy, setReceivedBy] = useState("");
  const [receivedType, setReceivedType] = useState("em_maos");

  const { data: result, isLoading } = useQuery({
    queryKey: ["delivery-confirmation", token],
    queryFn: () => getOrder({ data: { token } }),
  });
  const order = result?.found ? result : null;

  const mutation = useMutation({
    mutationFn: () => confirm({ data: { token, receivedBy, receivedType } }),
    onSuccess: (res) => {
      if (res.ok) qc.invalidateQueries({ queryKey: ["delivery-confirmation", token] });
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-10 pt-24">
      <h1 className="font-display text-2xl">Confirmar entrega</h1>

      {isLoading && <p className="mt-6 text-muted-foreground">Carregando pedido…</p>}

      {!isLoading && result && !result.found && (
        <p className="mt-6 text-destructive">Pedido não encontrado.</p>
      )}

      {order && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <p className="text-sm text-muted-foreground">Pedido</p>
            <p className="font-display text-xl">{order.orderNumber}</p>
            <p className="mt-3 text-sm text-muted-foreground">Destinatário</p>
            <p>{order.customerName}</p>
            {order.deliveryType === "delivery" && order.deliveryAddress && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">Endereço</p>
                <p>
                  {[order.deliveryAddress.rua, order.deliveryAddress.numero]
                    .filter(Boolean)
                    .join(", ")}
                  {order.deliveryAddress.bairro ? ` - ${order.deliveryAddress.bairro}` : ""}
                </p>
              </>
            )}
          </div>

          {order.confirmed ? (
            <div className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-rose-deep" />
              <div>
                <p className="font-medium">Entrega já confirmada</p>
                <p className="text-sm text-muted-foreground">
                  Recebido por {order.receivedBy} ({order.receivedTypeLabel})
                  {order.confirmedAt
                    ? ` em ${new Date(order.confirmedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                    : ""}
                  .
                </p>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <div>
                <Label>Nome de quem recebeu *</Label>
                <Input
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Recebido por</Label>
                <RadioGroup
                  value={receivedType}
                  onValueChange={setReceivedType}
                  className="mt-2 grid grid-cols-2 gap-3"
                >
                  {RECEIVED_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3"
                    >
                      <RadioGroupItem value={t.value} />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {mutation.data && !mutation.data.ok && (
                <p className="text-sm text-destructive">{mutation.data.error}</p>
              )}
              {mutation.error && (
                <p className="text-sm text-destructive">Erro ao confirmar entrega.</p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-rose-deep text-primary-foreground"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Confirmando…" : "Confirmar entrega"}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
