// Config própria em vez de reaproveitar vite.config.ts: aquele passa pelo
// wrapper do Lovable, que monta o app inteiro (nitro, TanStack Start, react).
// Os testes aqui são de lógica pura de servidor e não precisam de nada disso.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
