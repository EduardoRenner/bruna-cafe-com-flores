# Integração com agente de IA no n8n

API pronta e desligada para um workflow no n8n (rodando no WhatsApp) conversar
com o site: ler o catálogo, criar pedidos e consultar status. Enquanto a chave
abaixo não existir, os três endpoints respondem 404 — como se não existissem.

## Como ligar

1. Gerar uma chave aleatória forte (mínimo 20 caracteres), por exemplo:
   ```bash
   openssl rand -hex 32
   ```
2. No Vercel → Settings → Environment Variables, criar:

   | Variável | Valor |
   |---|---|
   | `N8N_API_KEY` | a chave gerada acima |

   Marcada como **Sensitive**, em Production and Preview.
3. Redeploy.
4. No n8n, configurar o header em toda chamada HTTP:
   `Authorization: Bearer <a mesma chave>`

> **Nunca** com prefixo `VITE_`. Isso embutiria a chave no JavaScript do
> navegador — qualquer visitante do site conseguiria criar pedidos e ler
> pedidos alheios. O servidor se recusa a subir se detectar isso.

## Endpoints

Base: `https://<dominio-do-site>/api/integrations/n8n`

### `GET /catalogo`
Produtos ativos e zonas de entrega ativas, com o `id` exato de cada produto —
é por esse id que o pedido é criado depois.

```bash
curl https://SEUDOMINIO/api/integrations/n8n/catalogo \
  -H "Authorization: Bearer $N8N_API_KEY"
```

### `POST /pedidos`
Cria um pedido. Corpo:

```json
{
  "customer_name": "Maria",
  "customer_phone": "49999998888",
  "customer_email": null,
  "delivery_type": "delivery",
  "delivery_address": { "rua": "Rua X", "numero": "123", "bairro": "Centro" },
  "payment_method": "pix",
  "notes": "Cartão: Feliz aniversário!",
  "items": [{ "id": "<id do produto vindo do /catalogo>", "quantity": 2 }]
}
```

Resposta (`200`):
```json
{ "ok": true, "pedido": { "orderNumber": "BCF-1042", "orderToken": "...", "total": 130 } }
```

Erro de validação (`422`) — ex.: produto inexistente, bairro fora da área,
muitos pedidos seguidos do mesmo IP:
```json
{ "ok": false, "erro": "Produto indisponível no catálogo" }
```

**O campo `price` do item, se enviado, é ignorado.** O valor cobrado vem
sempre do catálogo no banco — nem o agente, nem o cliente na conversa,
influenciam o preço. Isso vale mesmo que a conversa tenha memorizado um preço
antigo ou que alguém tente convencer o agente a "fechar por menos".

### `GET /pedidos/status?token=...`
Consulta o status de um pedido, pelo `orderToken` devolvido na criação —
nunca pelo número sequencial nem pelo telefone, para o agente não conseguir
(nem precisar) varrer pedidos de outros clientes.

```json
{ "numeroPedido": "BCF-1042", "status": "pendente", "statusPagamento": "pendente", "total": 130 }
```

## Por que é seguro

- **Preço sempre do catálogo.** A criação de pedido usa o mesmo núcleo de
  validação do checkout do site (`src/lib/orders/createOrderCore.server.ts`).
  Testado: mandar `price` adulterado no corpo da requisição é ignorado, o
  servidor busca o preço real do produto.
- **Autenticação por chave, em tempo constante.** Sem a chave certa, tudo
  responde 401 (ou 404, se a integração nem estiver configurada). A
  comparação usa `timingSafeEqual` — comparar direto com `===` vazaria por
  tempo de resposta quantos caracteres iniciais da chave acertaram.
- **Rate limit compartilhado com o checkout do site.** Um agente com bug (ou
  comprometido) tentando criar pedidos em loop esbarra no mesmo limite de 8
  por IP a cada 10 minutos.
- **Sem numeração sequencial em nenhuma resposta pública.** Todo link/consulta
  usa o token aleatório do pedido.
- **A tabela de pedidos não aceita mais escrita direta.** Existia uma política
  antiga que permitia inserir pedido direto pela chave pública do Supabase,
  sem passar pela validação de preço — foi encontrada e fechada em
  2026-07-30 (migration `20260730130000_close_direct_order_insert.sql`). Toda
  criação de pedido, do site ou do n8n, passa pelo mesmo código validado.

## O que ainda não existe

Isto é só a porta de entrada/saída de dados — o agente de IA em si (a
conversa, a personalidade, o fluxo de perguntas) mora no workflow do n8n, fora
deste projeto. Também não há aqui:

- consulta de pedidos por telefone (ex.: "quais meus últimos pedidos?") —
  hoje só existe consulta por token de um pedido específico;
- atualização de status pelo n8n (marcar como "em preparo" etc.) — isso
  continua sendo uma ação do admin, não do agente;
- qualquer coisa de pagamento aqui — isso é o módulo separado em
  `docs/pagamento.md`.

Se o workflow precisar de algo disso, é uma extensão pontual desta mesma API,
não uma reconstrução.

## Onde mexer

| Arquivo | Papel |
|---|---|
| `src/lib/integrations/n8n.server.ts` | Chave e verificação de autenticação |
| `src/lib/orders/createOrderCore.server.ts` | Núcleo de criação de pedido (compartilhado com o checkout do site) |
| `src/routes/api/integrations/n8n/catalogo.ts` | Leitura de produtos e zonas de entrega |
| `src/routes/api/integrations/n8n/pedidos.ts` | Criação de pedido |
| `src/routes/api/integrations/n8n/pedidos.status.ts` | Consulta de status |
