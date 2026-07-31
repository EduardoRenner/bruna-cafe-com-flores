import { createFileRoute } from "@tanstack/react-router";

// Catálogo para o agente de IA do n8n: produtos ativos e zonas de entrega
// ativas, com id — o agente precisa do id exato para criar o pedido depois em
// /api/integrations/n8n/pedidos (é por id que o servidor busca o preço real,
// nunca pelo nome digitado na conversa).
//
// Os mesmos dados já são públicos (RLS permite leitura de itens ativos com a
// chave anônima, e existe /api/public/produtos.ts sem autenticação). Este
// endpoint exige a chave do n8n mesmo assim, por dois motivos: padronizar um
// único jeito de autenticar toda a integração, e poder revogar o acesso do
// n8n sem mexer no que o site público usa.

export const Route = createFileRoute("/api/integrations/n8n/catalogo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { isN8nIntegrationEnabled, verificarAutenticacaoN8n } = await import(
          "@/lib/integrations/n8n.server"
        );

        // Desligado: some da API como se a rota não existisse.
        if (!isN8nIntegrationEnabled()) {
          return new Response(null, { status: 404 });
        }
        if (!verificarAutenticacaoN8n(request.headers.get("authorization"))) {
          return new Response(JSON.stringify({ erro: "não autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [{ data: produtos, error: erroProdutos }, { data: zonas, error: erroZonas }] =
          await Promise.all([
            supabaseAdmin
              .from("products")
              .select("id,name,description,price,category,active")
              .eq("active", true)
              .order("display_order", { ascending: true })
              .order("category", { ascending: true }),
            supabaseAdmin
              .from("delivery_zones")
              .select("bairro,fee,active")
              .eq("active", true)
              .order("bairro", { ascending: true }),
          ]);

        if (erroProdutos || erroZonas) {
          return new Response(JSON.stringify({ erro: "falha ao consultar catálogo" }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        return new Response(
          JSON.stringify({
            produtos: (produtos ?? []).map((p) => ({
              id: p.id,
              nome: p.name,
              descricao: p.description,
              preco: Number(p.price),
              categoria: p.category,
            })),
            zonasEntrega: (zonas ?? []).map((z) => ({
              bairro: z.bairro,
              taxa: Number(z.fee),
            })),
          }),
          { headers: { "content-type": "application/json; charset=utf-8" } },
        );
      },
    },
  },
});
