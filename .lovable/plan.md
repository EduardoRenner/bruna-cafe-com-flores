# Bruna Café com Flores — Plano de Implementação

## Ajustes em relação ao pedido original

1. **Imagens reais** — como as 4 fotos não chegaram no chat, vou usar imagens geradas por IA + Unsplash como placeholders nos lugares indicados (hero, sobre, produtos). Assim que você reenviar as fotos, troco em um passo simples.
2. **Chat com IA** — em vez de chamar a Anthropic API direto do frontend (o que exporia a chave publicamente), vou usar o **Lovable AI Gateway** através de uma server function do TanStack Start. Modelo padrão `google/gemini-3-flash-preview`. Comportamento e system prompt em português exatamente como você especificou. Chave protegida no servidor, sem configuração extra sua.

Todo o resto do briefing é mantido conforme descrito.

## Identidade visual

- Tokens semânticos em `src/styles.css` (oklch): `--rose`, `--rose-deep`, `--leaf`, `--coffee`, `--cream`, `--ink`, além de `--background/--foreground/--primary/...` mapeados.
- Fontes: Playfair Display (títulos, itálico decorativo) + Inter (corpo), carregadas via `<link>` no `__root.tsx` head.
- Sombras, gradientes rosé e "pétalas" definidos como tokens/utilities para reuso.

## Estrutura de rotas (TanStack Start file-based)

```
src/routes/
  __root.tsx                 # shell + fontes + navbar/footer + widget chat flutuante
  index.tsx                  # Homepage
  catalogo.tsx               # Catálogo com filtros + busca
  sobre.tsx                  # História + mapa embed
  contato.tsx                # Form + contatos
  admin.tsx                  # Layout do admin (login gate + sidebar)
  admin.index.tsx            # Dashboard
  admin.produtos.tsx         # CRUD produtos (localStorage)
  admin.pedidos.tsx          # Pedidos mockados
  admin.ia.tsx               # Chat interno para lojista
  api/chat.ts                # Server route de streaming (Lovable AI Gateway)
  sitemap[.]xml.ts
```

## Homepage

- Hero full-screen com imagem de fachada, overlay suave, título Playfair animado, subtítulo, 2 CTAs (Catálogo / WhatsApp), pétalas CSS caindo (8-10 elementos, keyframes).
- "O que oferecemos" — 3 cards (Flores, Café, Presentes) com ícones lucide + tokens.
- Destaques do mês — carrossel (embla) com 6 produtos.
- Nossa história — texto + foto lateral.
- Depoimentos — 3 cards com estrelas.
- Instagram — grid 6 fotos linkando o perfil.
- CTA final rosa + WhatsApp.
- Footer completo com endereço, telefones, horários, redes.

Animações: Intersection Observer para fade+slide-up nas seções; navbar sticky que ganha fundo branco+shadow no scroll.

## Catálogo (`/catalogo`)

- 12 produtos mockados exatos da lista.
- Sidebar de filtros por categoria (Flores / Café & Box / Presentes / Arranjos) + busca por nome no topo.
- Cards com foto, nome, descrição curta, preço em `R$ 0,00`, botão "Pedir via WhatsApp" abrindo `https://wa.me/5547991072410?text=...` com mensagem pré-formatada.
- Hover: scale + shadow. Skeleton loaders enquanto imagens carregam.

## Sobre (`/sobre`)

- História da Bruna, missão/visão/diferenciais, galeria de fotos, mapa Google embed nas coordenadas indicadas, quadro de horários.

## Contato (`/contato`)

- Form (Nome/Email/Telefone/Mensagem) frontend-only com toast de confirmação.
- Blocos de WhatsApp, Instagram, endereço com mini-mapa, horários.

## Admin (`/admin`) — visual dark premium

- Login hardcoded (`admin@brunacafe.com.br` / `bruna2024`) guardado em `sessionStorage`.
- Layout: sidebar escura fixa (Dashboard, Produtos, Pedidos, Clientes, IA Assistant, Configurações) + topbar com nome da loja.
- **Dashboard**: 4 cards de métricas, gráfico Recharts (pizza por categoria + barras receita), tabela de 5 pedidos recentes, badge "IA online".
- **Produtos**: tabela shadcn, modal de criar/editar (Nome, Descrição, Preço, Categoria, Foto URL, Ativo), persistência em `localStorage` (`bruna_products_v1`), seed inicial com os 12 produtos.
- **Pedidos**: lista mockada + filtro por status + drawer de detalhes.
- **Clientes**: tabela simples mockada.
- **IA Assistant**: chat embutido usando o mesmo endpoint `/api/chat`.

## Chat com IA (público + admin)

- Server route `src/routes/api/chat.ts` usando `streamText` do AI SDK + provider Lovable AI Gateway (`google/gemini-3-flash-preview`), system prompt em português exatamente como no briefing.
- Cliente com `useChat` do `@ai-sdk/react`.
- Widget flutuante (`ChatWidget`) montado no `__root.tsx` — botão redondo bottom-right em todas as páginas públicas, abre um Sheet lateral com transcrição + input. Some no `/admin/*` (que tem chat próprio).
- No admin, mesma lógica em página dedicada com layout maior.
- Histórico da conversa mantido em memória (não persistido).

## Detalhes técnicos

- **Design system**: nenhuma classe de cor hardcoded (`text-white`, `bg-[#...]`) — só tokens. Variantes shadcn customizadas: `Button` (`hero`, `whatsapp`, `soft`), `Card` (`floral`).
- **Animações**: utilitário `.reveal` + hook `useReveal` (IntersectionObserver). Pétalas em CSS puro.
- **SEO**: `head()` por rota (title/description/og únicos), `sitemap.xml`, `robots.txt`, `llms.txt`.
- **Responsivo**: mobile-first, menu hamburguer (Sheet), grids 1/2/3 colunas.
- **Dependências novas**: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `recharts`, `embla-carousel-react` (se ainda não instalado). `LOVABLE_API_KEY` provisionado.

## Ordem de execução

1. Provisionar `LOVABLE_API_KEY` + instalar deps.
2. Design system (`styles.css`) + fontes + variantes de Button/Card.
3. Layout raiz (navbar + footer + widget chat) e página inicial.
4. Catálogo, Sobre, Contato.
5. Server route de chat + widget flutuante + página do chat admin.
6. Admin (login, sidebar, dashboard, produtos com localStorage, pedidos).
7. SEO (sitemap, robots, llms, head metas), verificação de build.

Confirma esse plano (com as duas mudanças de segurança/imagens) e eu sigo construindo?
