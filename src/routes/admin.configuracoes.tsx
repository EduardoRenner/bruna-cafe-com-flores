import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { store } from "@/lib/store-info";

export const Route = createFileRoute("/admin/configuracoes")({ component: Config });
function Config() {
  return (
    <AdminShell title="Configurações">
      <Card className="border-none p-6 shadow-card-soft">
        <h3 className="font-display text-lg">Informações da loja</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{store.name}</dd></div>
          <div><dt className="text-muted-foreground">Endereço</dt><dd className="font-medium">{store.address}</dd></div>
          <div><dt className="text-muted-foreground">Telefone</dt><dd className="font-medium">{store.phone}</dd></div>
          <div><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{store.whatsapp}</dd></div>
          <div><dt className="text-muted-foreground">Instagram</dt><dd className="font-medium">@{store.instagram}</dd></div>
          <div><dt className="text-muted-foreground">Taxa de entrega</dt><dd className="font-medium">{store.delivery}</dd></div>
        </dl>
      </Card>
    </AdminShell>
  );
}
