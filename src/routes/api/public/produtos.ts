import { createFileRoute } from "@tanstack/react-router";
import { initialProducts } from "@/lib/products";

export const Route = createFileRoute("/api/public/produtos")({
  server: {
    handlers: {
      GET: async () => {
        const produtos = initialProducts
          .filter((p) => p.active)
          .map((p) => ({
            id: p.id,
            nome: p.name,
            descricao: p.description,
            preco: p.price,
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