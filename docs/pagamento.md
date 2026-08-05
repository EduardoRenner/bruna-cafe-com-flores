# Pagamento online

Estrutura pronta e desligada. Enquanto as variáveis abaixo não existirem, o site
funciona exatamente como hoje: o checkout só oferece finalizar pelo WhatsApp e a
opção de pagar online nem é renderizada.

## Como ligar

1. Criar conta no Mercado Pago com o CNPJ/CPF **da loja** — é essa conta que
   recebe o dinheiro.
2. Em <https://www.mercadopago.com.br/developers/panel>, criar uma aplicação e
   pegar:
   - **Access token** de produção (começa com `APP_USR-`)
   - **Assinatura secreta** do webhook (em Webhooks → Configurar notificações)
3. Em Webhooks, cadastrar a URL:
   `https://<dominio-do-site>/api/webhooks/mercadopago`
   e marcar o evento **Pagamentos**.
4. No Vercel → Settings → Environment Variables, criar as três, todas marcadas
   como **Sensitive**, em Production and Preview:

   | Variável | Valor |
   |---|---|
   | `MP_ACCESS_TOKEN` | access token de produção |
   | `MP_WEBHOOK_SECRET` | assinatura secreta do webhook |
   | `SITE_URL` | `https://<dominio-do-site>` (precisa ser https) |

5. Redeploy.

## Como testar antes de valer dinheiro de verdade

O Mercado Pago oferece dois caminhos, e eles **não** se misturam. O erro
`"Uma das partes com as quais você está tentando efetuar o pagamento é de
teste"` é sempre o mesmo diagnóstico: o vendedor e o comprador estão em mundos
diferentes.

**Caminho A — credenciais de teste da própria aplicação.** O access token
começa com `TEST-`. O código detecta pelo prefixo e usa o `sandbox_init_point`.

**Caminho B — usuários de teste (é o que usamos aqui).** Em Suas integrações →
Contas de teste, crie **duas** contas: uma vendedora e uma compradora. O access
token da conta vendedora vai em `MP_ACCESS_TOKEN`, e o checkout é feito logado
na conta compradora, **em janela anônima** (senão o navegador entra com a sua
conta pessoal real e o erro volta).

Atenção a duas armadilhas do caminho B:

- **O token de um usuário de teste começa com `APP_USR-`**, igual ao de
  produção. Então `sandbox` fica `false` e o `sandbox_init_point` nunca é
  usado — o que está correto, usuário de teste usa o `init_point` normal, mas
  significa que o prefixo do token **não** distingue conta real de conta de
  teste. Quem responde isso é o User ID do vendedor: o log
  `[pagamento] preferência criada` mostra `contaVendedora`, extraída do
  prefixo do id da preferência. Compare com os User IDs no painel.
- **A assinatura do webhook pode não bater.** A preferência é criada com o
  token da conta de teste, que é uma conta separada da sua aplicação. Se
  `MP_WEBHOOK_SECRET` for o segredo da aplicação, a verificação falha — e
  falha **em silêncio**, porque notificação com assinatura inválida é
  registrada e descartada. O sintoma no log é
  `[pagamento] webhook com assinatura inválida — ignorado`.

### SITE_URL é por ambiente

`SITE_URL` monta o `returnUrl` e o `notificationUrl`. Se um deploy de Preview
usar o `SITE_URL` de produção, o retorno do pagamento e o webhook do seu teste
vão para o **site real**, que roda outro código e outros segredos. Configure
`SITE_URL` no escopo Preview com a URL da própria preview, e **redeploy** — o
Vercel não injeta variável de ambiente em deploy que já existe.

O servidor avisa nesse caso (`verificarCoerenciaAmbiente`), usando
`VERCEL_ENV` e `VERCEL_PROJECT_PRODUCTION_URL` em vez de adivinhar pelo
formato do domínio.

> **Nunca** coloque prefixo `VITE_` nessas variáveis. Tudo que começa com
> `VITE_` é embutido no JavaScript que vai para o navegador — o token ficaria
> público. O servidor se recusa a subir se detectar isso.

## Por que é seguro

**Nenhum dado de cartão passa por este servidor.** O cliente é levado ao
checkout hospedado do Mercado Pago, digita o cartão lá e volta. Aqui só chegam
o id da transação, o valor e o status. Mesmo num cenário de invasão total do
banco de dados, não existe dado de cartão para vazar — nunca esteve lá.

Além disso:

- **O valor vem sempre do banco.** O navegador só informa qual pedido quer
  pagar, através de um token aleatório. Não existe caminho pelo qual o cliente
  influencie quanto será cobrado.
- **O webhook é assinado.** Sem a verificação HMAC, qualquer um que descobrisse
  a URL poderia anunciar "pagamento aprovado" e receber flores de graça.
  Notificação com assinatura inválida é registrada e descartada.
- **O corpo da notificação não é fonte de verdade.** Ao receber um aviso,
  reconsultamos o pagamento na API do Mercado Pago e usamos a resposta dela.
- **Valor divergente nunca vira "pago".** Se o gateway confirmar um valor
  diferente do pedido, o pagamento fica com status `divergente` e o pedido
  segue pendente, para conferência humana.
- **Notificação repetida não gera efeito repetido.** Gateways reenviam o mesmo
  aviso várias vezes; a idempotência é garantida por índice único.
- **As tabelas de pagamento são inacessíveis pelo navegador.** RLS nega tudo
  para as chaves públicas, e a função de confirmação só pode ser executada pelo
  service role. Um cliente não consegue marcar o próprio pedido como pago.
- **Links de pedido usam token aleatório**, não o número sequencial — senão
  bastaria trocar `BCF-1000` por `BCF-1001` na URL para ler o pedido dos outros.

## Formas de pagamento

A escolha no checkout decide o que o cliente vê no gateway:

| Escolha | Efeito |
|---|---|
| Cartão | Checkout do MP só com crédito e débito |
| Pix | Só Pix |
| Boleto | Só boleto |
| Dinheiro | **Não** oferece pagamento online; mostra "Troco para quanto?" e finaliza pelo WhatsApp |

A restrição é por exclusão (`payment_methods.excluded_payment_types`) porque a
API do Mercado Pago não tem "inclua só isto". Forma desconhecida não restringe
nada — melhor oferecer meios demais do que travar um cliente fora do pagamento
por um valor inesperado no banco.

Dinheiro é recusado no servidor também (`forma_nao_online`), não só escondido
na tela: senão bastaria chamar o endpoint com o token para cobrar online um
pedido que o cliente vai pagar de novo na porta.

O troco é validado no **trigger do banco** (≥ total, e com teto contra erro de
digitação), não só no navegador — o agente de WhatsApp e a API do n8n criam
pedido pelo mesmo caminho e não passam pela tela.

## O que acontece quando o pagamento é confirmado

Três coisas, todas a partir do mesmo ponto (`aplicarConfirmacao`), para que
webhook e reconciliação produzam exatamente o mesmo efeito:

1. `payments.status` vira `pago` e `orders.payment_status` também.
2. **O pedido entra em preparo sozinho** — `orders.status` sai de `pendente`
   e vai para `em_preparo`. Só avança a partir de `pendente`: uma notificação
   atrasada nunca puxa de volta um pedido que já saiu para entrega, nem
   reabre um cancelado. Estorno **não** mexe no status operacional, só no
   `payment_status` — se o arranjo já foi montado, cancelar sozinho apagaria
   trabalho real.
3. **A loja recebe um WhatsApp** com pedido, cliente e valor. Só dispara na
   confirmação de verdade: notificação reenviada devolve `ja_processado` e
   não gera segunda mensagem. Falha ao notificar nunca derruba a confirmação
   — se derrubasse, o gateway reenviaria para sempre e o pedido ficaria
   pendente por causa de uma mensagem. Destino: `WHATSAPP_NOTIFICACAO_TO`, ou
   o número da loja em `store-info` se a variável não existir. Precisa do
   agente de WhatsApp configurado; sem ele, essa etapa é pulada em silêncio.

### Reconciliação: não depender só do webhook

O webhook falha de formas silenciosas — `SITE_URL` apontando para outro
ambiente, assinatura que não confere, notificação perdida. Em qualquer um
desses casos um pagamento aprovado de verdade ficaria pendente para sempre.

Por isso a página do pedido (`/pedido/<token>`) pergunta ao Mercado Pago, a
cada consulta, se o pagamento saiu do lugar — e aplica pelo mesmo caminho do
webhook. A busca é por `external_reference` (o nosso `payments.id`), então não
depende de ter recebido nada do gateway. Havendo várias tentativas para o
mesmo pedido, vale a aprovada.

O polling da página para depois de ~5 minutos: como cada consulta agora chama
o gateway, uma aba esquecida aberta viraria consulta eterna.

> **Lacuna conhecida:** se o cliente nunca voltar à página do pedido *e* o
> webhook falhar, ninguém reconcilia. `reconciliarPagamentoDoPedido` está
> exportada para poder ser chamada por um job periódico, mas esse job ainda
> não existe.

## O que tem teste automatizado

`bun run test` (vitest). 64 testes em `src/lib/payments/*.test.ts`:

- **`config.server.test.ts`** — pagamento desligado devolve `null`; configuração
  pela metade lança; `SITE_URL` exige https e é normalizada para a origem;
  qualquer segredo com prefixo `VITE_` derruba o servidor; classificação do
  token; o resumo que vai para o log não contém nenhum segredo; avisos de
  coerência de ambiente, incluindo a regressão de tratar `*.vercel.app` como
  preview.
- **`mercadopago.server.test.ts`** — verificação HMAC do webhook (segredo
  errado, `dataId` ou `request-id` adulterados, notificação antiga reenviada,
  timestamp no futuro, header malformado, normalização de maiúsculas);
  tradução de status, com status desconhecido nunca virando `pago`; conversão
  de reais para centavos sem erro de ponto flutuante; escolha do init point.

> Nota histórica: até 31/07/2026 esta seção afirmava que assinatura, valor e
> idempotência tinham teste automatizado. Não tinham — não existia nenhum
> arquivo de teste nem runner no projeto. Os testes acima foram escritos
> depois, e a suíte foi conferida contra uma mutação deliberada na comparação
> da assinatura para garantir que ela realmente falha quando o código quebra.

## O que ainda NÃO tem teste automatizado

- **A conferência de valor e a idempotência.** Elas moram na função SQL
  `confirm_payment` (`supabase/migrations/20260730120000_payments.sql`), e
  testá-las exige um banco. Continuam sem cobertura.
- **A chamada real contra a API do Mercado Pago.** Os testes usam `fetch`
  simulado; o contrato real só se confirma com uma conta.
- **O formato exato da notificação em produção.**

Antes de abrir para clientes, faça **uma compra de teste de verdade** seguindo
"Como testar" acima e confirme que o pedido aparece como pago no admin.

## Onde mexer

| Arquivo | Papel |
|---|---|
| `src/lib/payments/types.ts` | Contrato que qualquer gateway precisa cumprir |
| `src/lib/payments/config.server.ts` | Leitura e validação das variáveis |
| `src/lib/payments/mercadopago.server.ts` | Conversa com a API do Mercado Pago |
| `src/lib/payments/service.server.ts` | Regras: valor, webhook, confirmação |
| `src/lib/payment.functions.ts` | Ponte para o navegador |
| `src/routes/api/webhooks/mercadopago.ts` | Endpoint que recebe as notificações |
| `src/lib/payments/*.test.ts` | Testes (`bun run test`) |
| `supabase/migrations/20260730120000_payments.sql` | Tabelas, RLS e confirmação atômica |

Trocar de gateway significa escrever um arquivo novo no lugar de
`mercadopago.server.ts`. As regras de negócio ficam fora do adaptador.
