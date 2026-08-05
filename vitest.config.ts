// Config própria em vez de reaproveitar vite.config.ts: aquele passa pelo
// wrapper do Lovable, que monta o app inteiro (nitro, TanStack Start, react).
// Os testes aqui são de lógica pura de servidor e não precisam de nada disso.
//
// O alias @ precisa ser repetido: sem o wrapper, nada mais o define, e um
// import "@/lib/..." dentro do código sob teste falha em resolver.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
