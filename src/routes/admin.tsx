import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoginGate } from "@/components/admin/LoginGate";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Bruna Café" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <LoginGate>
      <Outlet />
    </LoginGate>
  ),
});
