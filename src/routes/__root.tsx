import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { ChatWidget } from "@/components/site/ChatWidget";
import { CartProvider } from "@/lib/cart";
import { CartSheet } from "@/components/site/CartSheet";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-rose-deep">404</h1>
        <h2 className="mt-4 font-display text-xl">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-rose-deep px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente atualizar a página.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-rose-deep px-4 py-2 text-sm font-medium text-primary-foreground">Tentar novamente</button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm font-medium">Início</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bruna Café com Flores — Floricultura e Café em Maravilha SC" },
      { name: "description", content: "Transformamos momentos em memórias. Flores frescas, café da manhã na porta e presentes personalizados em Maravilha, SC." },
      { property: "og:title", content: "Bruna Café com Flores — Floricultura e Café em Maravilha SC" },
      { property: "og:description", content: "Transformamos momentos em memórias. Flores frescas, café da manhã na porta e presentes personalizados em Maravilha, SC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bruna Café com Flores — Floricultura e Café em Maravilha SC" },
      { name: "twitter:description", content: "Transformamos momentos em memórias. Flores frescas, café da manhã na porta e presentes personalizados em Maravilha, SC." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5fff71cb-5c6d-4be1-886d-8c27b3f94682/id-preview-0b6de527--b0afd98f-c4ee-41d2-91f2-6e12595b1fb4.lovable.app-1784641403532.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5fff71cb-5c6d-4be1-886d-8c27b3f94682/id-preview-0b6de527--b0afd98f-c4ee-41d2-91f2-6e12595b1fb4.lovable.app-1784641403532.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  return (
    <QueryClientProvider client={queryClient}>
      {isAdmin ? (
        <Outlet />
      ) : (
        <CartProvider>
          <Navbar />
          <main className="min-h-screen">
            <Outlet />
          </main>
          <Footer />
          <ChatWidget />
          <CartSheet />
        </CartProvider>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}
