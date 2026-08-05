# Handoff — integração de pagamento (Mercado Pago)

**De:** Eduardo · **Para:** Vitor · **Data:** 01/08/2026
**Branch:** `debug-pagamento-sandbox` (6 commits sobre `main` em `00a31a4`)

Documento de passagem de bastão. Contexto completo do que foi feito numa
sessão longa de debug, o que ficou funcionando, o que ainda está quebrado e
qual é a próxima ação. Leia a seção "Onde parei" primeiro.

---

## Onde parei (leia isto)

O pagamento online **fecha o ciclo**, mas pelo caminho secundário. Resumindo:

| Coisa | Estado |
|---|---|
| Criar cobrança no Mercado Pago | ✅ funciona |
| Cliente pagar no checkout do MP | ✅ funciona (sandbox) |
| Webhook confirmar o pagamento | ❌ **assinatura inválida** |
| Reconciliação confirmar o pagamento | ✅ funciona — foi o que salvou |
| Pedido virar "pago" no admin | ✅ via reconciliação |
| Status avançar para "Em preparo" | ⏳ depende de migration não aplicada |
| Boleto / troco / restrição de meio | ⏳ código pronto, migrations não aplicadas |

**Próxima ação concreta:** aplicar as **três migrations** no Supabase, dar
redeploy na preview, e testar. Detalhes na seção "O que fazer em seguida".

**Não mergeie na `main` ainda.** O último commit mexe no trigger
`validate_new_order`, que valida *todo* pedido do site. Se estiver errado,
quebra o checkout inteiro, não só o pagamento online. Tem que rodar na preview
primeiro.

---

## 1. O problema original e como foi resolvido

O erro era `"Uma das partes com as quais você está tentando efetuar o pagamento
é de teste"` no checkout do Mercado Pago.

**Causa:** o comprador e o vendedor eram **a mesma conta de teste**
(`3579991113`). O MP não deixa uma conta pagar uma cobrança dela mesma — e não
mostra erro claro, ele simplesmente **desabilita o botão "Pagar"**, o que
despistou bastante.

**Solução:** usar a conta compradora separada (`3579991115`) para pagar. O
`MP_ACCESS_TOKEN` continua sendo o da vendedora `3579991113`.

Armadilha que custou tempo: o token de um **usuário de teste** começa com
`APP_USR-`, igual ao de produção. O prefixo **não** distingue conta real de
conta de teste. Quem responde isso é o User ID do vendedor, que hoje aparece
no log (`contaVendedora`), extraído do prefixo do id da preferência.

---

## 2. O que foi construído

Seis commits, todos em `debug-pagamento-sandbox`:

| Commit | O que faz |
|---|---|
| `34ccf81` | Logs de diagnóstico na criação da preferência (ambiente, fingerprints, SITE_URL) |
| `1f7aeca` | Corrige aviso de ambiente que sempre disparava + primeiros testes |
| `25efd54` | Status avança sozinho, reconciliação, aviso no WhatsApp |
| `177d273` | Corrige bug: reconciliação derrubava a página do pedido |
| `9780c04` | Torna a falha de assinatura do webhook diagnosticável |
| `2d7707e` | Boleto, troco, restrição de meio no gateway, freio na reconciliação |

### Reconciliação (a peça mais importante)

O webhook falha em silêncio de várias formas. A página `/pedido/<token>` agora
pergunta ao Mercado Pago, a cada carregamento, se o pagamento saiu do lugar — e
aplica pelo mesmo caminho do webhook (`aplicarConfirmacao`). Busca por
`external_reference` (o nosso `payments.id`), então não depende de ter recebido
id nenhum do gateway.

**Foi ela que fez o BCF-1006 virar "pago"**, um pagamento cuja notificação
morreu num 500 e nunca chegou.

Tem freio de 10s por pagamento (`payments.last_reconciled_at`), senão quem tem
o token do pedido podia repetir num laço e consumir a cota da API do MP.

**Lacuna conhecida:** se o cliente pagar e fechar o navegador sem voltar à
página, ninguém reconcilia. `reconciliarPagamentoDoPedido` está exportada para
um job periódico que **ainda não existe**.

### Formas de pagamento

| Escolha | Efeito |
|---|---|
| Cartão | MP abre só crédito/débito |
| Pix | Só Pix |
| Boleto | Só boleto |
| Dinheiro | Não oferece pagamento online; mostra "Troco para quanto?" |

Dinheiro é recusado **no servidor** (`forma_nao_online`), não só escondido na
tela. O troco é validado no **trigger do banco**, porque o agente de WhatsApp
e a API do n8n criam pedido pelo mesmo caminho sem passar pela tela.

---

## 3. O que está quebrado: assinatura do webhook

Toda notificação do MP é rejeitada:

```
[pagamento] webhook com assinatura inválida — ignorado
```

**Hipótese principal (não confirmada):** o `MP_WEBHOOK_SECRET` é de uma
aplicação diferente da que emitiu a cobrança. Com usuário de teste, o vendedor
`3579991113` é uma conta MP **separada**; as notificações são assinadas pela
aplicação ligada ao access token que criou a preferência — a aplicação *dessa*
conta, não a sua.

**O que tentar:** logar no MP **como o Seller Test User**, ir no painel de
desenvolvedor **dessa conta**, e pegar a assinatura secreta do webhook de lá.

**Como saber se resolveu:** o segredo atual tem fingerprint **`a2fe0fa5`** (sai
em todo log de criação de preferência). Depois de trocar e redeployar:

- fingerprint **diferente** e ainda falha → trocou, mas ainda é o errado
- fingerprint **`a2fe0fa5`** de novo → a variável não pegou (escopo ou redeploy)
- log `assinatura confere com o data.id alternativo` → era o manifesto, não o segredo
- nada nos logs → funcionou

**Segunda hipótese, já tratada no código:** o MP manda `data.id` no corpo *e* na
query, com valores diferentes conforme o tipo de notificação (as duas rejeições
observadas tinham ids distintos: `171490830522` e `43231279162`, sinal de
`payment` e `merchant_order`). A documentação não diz qual entra no manifesto
assinado. O código agora tenta os dois.

---

## 4. Pendências

### Bloqueadores para produção

1. **Aplicar as três migrations no Supabase** (ninguém aplicou ainda):
   - `20260801000000_order_status_on_payment.sql` — pedido pago vai para "Em preparo"
   - `20260801010000_boleto_e_troco.sql` — boleto no trigger + coluna `change_for`
   - `20260801020000_throttle_reconciliacao.sql` — coluna `last_reconciled_at`
2. **Credenciais reais.** Hoje o `MP_ACCESS_TOKEN` é do usuário de teste. Produção
   precisa do token de produção da conta real da Bruna (a do CNPJ que recebe).
3. **Segredo do webhook** (seção 3).
4. **Merge na `main`** — produção roda código sem nada disso.
5. **Uma compra real de valor baixo**, conferindo que o dinheiro caiu.

### Dívidas conhecidas

- **`confirm_payment` não tem teste automatizado.** Conferência de valor e
  idempotência — as garantias que impedem alguém de pagar R$0,01 num arranjo de
  R$60 — só têm verificação manual. Testar exige um Postgres; o Docker não
  estava rodando na máquina onde trabalhei. **É o maior buraco que sobrou.**
- **Job periódico de reconciliação** não existe (lacuna da seção 2).
- **Pedidos de teste** `BCF-1000` a `BCF-1006` ainda no admin. Dá para apagar
  pelo próprio painel (menu do pedido → Excluir pedido). As linhas de `payments`
  somem junto (cascade); as de `payment_events` ficam com `payment_id` nulo — é
  a trilha de auditoria, deixa quieto.
- **`WHATSAPP_*` não configuradas**, então o aviso de pagamento confirmado é
  pulado em silêncio.

---

## 5. O que fazer em seguida

1. Aplicar as três migrations no Supabase.
2. Redeploy da **preview** (branch `debug-pagamento-sandbox`).
3. Testar na preview, em **janela anônima**:
   - checkout com **Pix** → o MP deve abrir só Pix
   - checkout com **Boleto** → só boleto
   - checkout com **Dinheiro** → não deve aparecer "Pagar agora pelo site",
     deve aparecer "Troco para quanto?", e o valor tem que sair no admin
   - pagar um deles logado como **Buyer Test User** (`3579991115`)
   - conferir no admin: PAGAMENTO "Pago" **e** STATUS "Em preparo"
4. Atacar o segredo do webhook (seção 3).
5. Só então: credenciais reais → merge na `main` → compra real de valor baixo.

### Como testar um pagamento (o roteiro que funciona)

Tudo em janela anônima, do começo ao fim.

1. Preview → catálogo → adicionar produto → finalizar pedido
2. Preencher dados, escolher forma de pagamento, "Pagar agora pelo site"
3. No MP: **Entrar com a minha conta**, usar o **Buyer Test User** (`3579991115`)
4. Cartão de teste: `5031 4332 1540 6351` · titular **`APRO`** (força aprovação)
   · validade `11/30` · CVV `123` · CPF `123.456.789-09`

> O botão "Pagar" fica **cinza sem mensagem** se o comprador for a mesma conta
> do vendedor. Se isso acontecer, você logou com a conta errada.

---

## 6. Referências

**Contas de teste do Mercado Pago** (senhas estão no painel, em Contas de teste):

| Papel | User ID |
|---|---|
| Seller Test User — dona do `MP_ACCESS_TOKEN` | `3579991113` |
| Buyer Test User — usar para pagar | `3579991115` |

**Fingerprints em uso** (saem nos logs; servem para conferir se uma variável
trocou de valor, sem expor o segredo):

- access token: `d354420e`
- webhook secret: `a2fe0fa5`

**Variáveis de ambiente no Vercel** — `SITE_URL` precisa de **duas entradas
separadas**, uma por escopo:

| Escopo | Valor |
|---|---|
| Production | `https://bruna-cafe-com-flores.vercel.app` |
| Preview | `https://bruna-cafe-com-flores-git-debug-pagamento-1afa1b-starkinovacoes.vercel.app` |

Mais `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` em cada escopo. Nenhuma delas pode
ter prefixo `VITE_` — o servidor se recusa a subir se detectar.

**Preview URL:**
`https://bruna-cafe-com-flores-git-debug-pagamento-1afa1b-starkinovacoes.vercel.app`

**Ambiente de dev:** Node 24.18.1. `npm install` funciona; para mexer no
`bun.lock` use bun (`npm i -g bun`). Testes: `npx vitest run` (85 passando).
Typecheck: `npx tsc --noEmit`.

---

## 7. Armadilhas que já nos morderam

Vale ler antes de mexer — cada uma custou tempo.

1. **Variável de ambiente não entra em deploy que já existe.** Mudou algo no
   Vercel? Redeploy, senão o valor antigo continua valendo. E redeploy de
   Production **não** redeploya a preview: são deploys separados.

2. **`SITE_URL` sem `https://` derruba o pagamento inteiro.** Aconteceu em
   produção: `getPaymentConfig()` lança, `isPaymentEnabled()` devolve `false`, e
   **o botão de pagar some do site real**. Os logs mostram
   `Error: SITE_URL inválida: Invalid URL`. Confirme que a produção está ok.

3. **Preview com `SITE_URL` de produção manda o webhook do teste para o site
   real.** O `returnUrl` e o `notificationUrl` são montados a partir dela. Já
   existe aviso automático nos logs para esse caso.

4. **Comprador = vendedor trava o botão Pagar sem mensagem** (seção 5).

5. **Prefixo do token não distingue teste de produção** quando se usa usuário de
   teste — os dois são `APP_USR-`. Use o `contaVendedora` do log.

6. **O trigger do banco é a validação que vale.** Site, agente de WhatsApp e API
   do n8n criam pedido pelo mesmo caminho. Mudou regra de pedido? Tem que estar
   no trigger, não só em TypeScript.

---

## 8. Onde olhar no código

| Arquivo | Papel |
|---|---|
| `src/lib/payments/config.server.ts` | Variáveis, validação, avisos de ambiente |
| `src/lib/payments/mercadopago.server.ts` | API do MP, assinatura, restrição de meios |
| `src/lib/payments/service.server.ts` | Regras, webhook, reconciliação, aviso |
| `src/lib/payments/*.test.ts` | 85 testes (`npx vitest run`) |
| `src/lib/orders/createOrderCore.server.ts` | Criação de pedido (caminho único) |
| `src/routes/checkout.tsx` | Formas de pagamento, troco |
| `src/routes/api/webhooks/mercadopago.ts` | Endpoint das notificações |
| `docs/pagamento.md` | Documentação da integração |

**Logs úteis** (Vercel → Runtime Logs, filtrar por `pagamento`):

- `[pagamento] criando preferência` — ambiente, fingerprints, SITE_URL em uso
- `[pagamento] preferência criada` — `contaVendedora`, init point escolhido
- `[pagamento] ambiente possivelmente incoerente` — SITE_URL no escopo errado
- `[pagamento] nenhum candidato de assinatura conferiu` — fingerprint do segredo
- `[pagamento] reconciliação aplicou status do gateway` — a rede de segurança agiu
- `[pagamento] VALOR DIVERGENTE` — **conferir manualmente, não é rotina**
