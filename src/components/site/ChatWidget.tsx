import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatPanel } from "./ChatPanel";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/admin")) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-rose text-primary-foreground shadow-elegant transition-transform hover:scale-105",
        )}
        aria-label="Abrir chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border bg-gradient-rose px-6 py-4">
            <SheetTitle className="font-display text-primary-foreground">Fale com a Bruna 🌸</SheetTitle>
            <p className="text-xs text-primary-foreground/80">Assistente virtual — respondemos na hora</p>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <ChatPanel />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
