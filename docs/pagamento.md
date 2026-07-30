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

Para testar antes de valer dinheiro de verdade, use as credenciais de teste do
Mercado Pago (token começa com `TEST-`). O código detecta sozinho e usa o
ambiente de sandbox.

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

## O que ainda não foi testado

A verificação de assinatura, a conferência de valor, a idempotência e as guardas
de configuração têm teste automatizado e passaram. O que **não** pôde ser
testado sem uma conta real:

- a chamada de criação de checkout contra a API do Mercado Pago;
- o formato exato da notificação que eles enviam em produção.

Antes de abrir para clientes, faça **uma compra de teste de verdade** com
credenciais de sandbox e confirme que o pedido aparece como pago no admin.

## Onde mexer

| Arquivo | Papel |
|---|---|
| `src/lib/payments/types.ts` | Contrato que qualquer gateway precisa cumprir |
| `src/lib/payments/config.server.ts` | Leitura e validação das variáveis |
| `src/lib/payments/mercadopago.server.ts` | Conversa com a API do Mercado Pago |
| `src/lib/payments/service.server.ts` | Regras: valor, webhook, confirmação |
| `src/lib/payment.functions.ts` | Ponte para o navegador |
| `src/routes/api/webhooks/mercadopago.ts` | Endpoint que recebe as notificações |
| `supabase/migrations/20260730120000_payments.sql` | Tabelas, RLS e confirmação atômica |

Trocar de gateway significa escrever um arquivo novo no lugar de
`mercadopago.server.ts`. As regras de negócio ficam fora do adaptador.
