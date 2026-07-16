import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { ChatPanel } from "@/components/site/ChatPanel";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/ia")({ component: IA });

function IA() {
  return (
    <AdminShell title="IA Assistant">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-rose-deep" />
        Teste como a assistente responde aos clientes. As respostas usam os dados reais da loja.
      </div>
      <Card className="h-[70vh] overflow-hidden border-none p-0 shadow-card-soft">
        <ChatPanel />
      </Card>
    </AdminShell>
  );
}
