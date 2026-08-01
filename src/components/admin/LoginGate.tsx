import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Flower2, Lock } from "lucide-react";
import { adminLogin, adminSessaoAtiva } from "@/lib/admin.functions";

export function LoginGate({ children }: { children: ReactNode }) {
  // Quem manda é sempre o SERVIDOR: ao montar, perguntamos se o cookie
  // httpOnly de sessão é válido. Não existe estado local que conceda acesso
  // — não há o que forjar no devtools, e toda server function confere o
  // cookie por conta própria de qualquer forma.
  const [authed, setAuthed] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loginFn = useServerFn(adminLogin);
  const sessaoFn = useServerFn(adminSessaoAtiva);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { ativa } = await sessaoFn({});
        if (!cancelled) setAuthed(ativa);
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessaoFn]);

  if (authed) return <>{children}</>;
  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar p-6 text-sidebar-foreground/70">
        Verificando sessão…
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // O servidor confere a senha e devolve o cookie httpOnly de sessão.
      // A senha não é guardada em lugar nenhum do lado do cliente.
      await loginFn({ data: { password } });
      setPassword("");
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senha incorreta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-6">
      <Card className="w-full max-w-sm border-none bg-sidebar-accent p-8 text-sidebar-foreground shadow-elegant">
        <div className="flex items-center gap-2">
          <Flower2 className="h-6 w-6 text-sidebar-primary" />
          <div>
            <div className="font-display text-xl">Bruna Café com Flores</div>
            <div className="text-xs text-sidebar-foreground/60">Painel administrativo</div>
          </div>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="password" className="text-sidebar-foreground">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="mt-1.5 border-sidebar-border bg-sidebar text-sidebar-foreground"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          >
            <Lock className="mr-2 h-4 w-4" /> {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
