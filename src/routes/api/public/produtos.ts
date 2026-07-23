import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/produtos")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("products")
          .select("id,name,description,price,category,active")
          .eq("active", true)
          .order("created_at", { ascending: true });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        const produtos = (data ?? []).map((p) => ({
          id: p.id,
          nome: p.name,
          descricao: p.description,
          preco: Number(p.price),
          categoria: p.category,
          disponivel: p.active,
        }));

        return new Response(
          JSON.stringify({ produtos, total: produtos.length }, null, 2),
          {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, max-age=60",
              "access-control-allow-origin": "*",
            },
          },
        );
      },
    },
  },
});
