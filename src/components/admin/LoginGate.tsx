import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Flower2, Lock } from "lucide-react";
import { isAuthed, login } from "@/lib/auth";

export function LoginGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => isAuthed());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (authed) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (login(email, password)) setAuthed(true);
    else setError("E-mail ou senha incorretos.");
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
            <Label htmlFor="email" className="text-sidebar-foreground">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 border-sidebar-border bg-sidebar text-sidebar-foreground" />
          </div>
          <div>
            <Label htmlFor="password" className="text-sidebar-foreground">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5 border-sidebar-border bg-sidebar text-sidebar-foreground" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Lock className="mr-2 h-4 w-4" /> Entrar
          </Button>
          <p className="pt-2 text-center text-xs text-sidebar-foreground/60">
            Demo: admin@brunacafe.com.br / bruna2024
          </p>
        </form>
      </Card>
    </div>
  );
}
