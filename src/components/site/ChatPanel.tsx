import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Flower2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const INITIAL: ChatMessage = {
  role: "assistant",
  content: "Olá! 🌸 Sou a assistente virtual da Bruna Café com Flores. Como posso te ajudar a encontrar o presente perfeito hoje?",
};

export function ChatPanel({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== INITIAL || next.indexOf(m) > 0) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao responder.");
      setMessages((m) => [...m, { role: "assistant", content: String(data.text ?? "") }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao responder.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  const dark = variant === "dark";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className={cn("mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", dark ? "bg-rose/20" : "bg-secondary")}>
                <Flower2 className="h-4 w-4 text-rose-deep" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-rose-deep text-primary-foreground"
                  : dark
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "bg-secondary text-secondary-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> pensando…
          </div>
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
      <div className={cn("border-t p-3", dark ? "border-sidebar-border" : "border-border")}>
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua mensagem…"
            rows={2}
            className="min-h-[52px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="h-[52px] w-12 bg-rose-deep text-primary-foreground hover:bg-rose-deep/90">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
