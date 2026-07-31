# Agente de WhatsApp

Agente pronto e desligado, direto na WhatsApp Cloud API da Meta (sem BSP/intermediário). Enquanto as variáveis abaixo não existirem, o webhook responde "desligado" e não faz nada — não precisa remover código pra desligar, só não configurar.

## Por que direto com a Meta, sem parceiro (BSP)

Como o agente inteiro (personalidade, memória, ferramentas) é código deste projeto, um parceiro (Twilio, Sinch etc.) só agregaria uma mensalidade de R$300-1.500 por um painel que não vamos usar. Indo direto, o único custo é o que a própria Meta cobra por mensagem — grátis até agora; a partir de **1º de outubro de 2026** passa a cobrar ~R$0,035 por resposta enviada dentro da janela de 24h. Pra o volume de uma floricultura pequena, isso fica na faixa de R$20-60/mês.

## Como ligar

1. Criar conta em [developers.facebook.com](https://developers.facebook.com), criar um app tipo "Business", adicionar o produto **WhatsApp**.
2. A Meta libera na hora um **número de teste grátis** + token temporário — dá pra testar tudo antes mesmo da verificação da empresa terminar.
3. Em paralelo, submeter a verificação da empresa (CNPJ, comprovante de endereço, documento do representante legal) e decidir: usar o número que a Bruna já tem hoje (ele para de funcionar no WhatsApp comum do celular) ou um número novo só pro agente.
4. No painel do app, em **WhatsApp → Configuração da API**, pegar:
   - **Token de acesso** (temporário pra testar; permanente depois de configurar um usuário do sistema)
   - **ID do número de telefone** (Phone Number ID)
5. Em **WhatsApp → Configuração → Webhook**, cadastrar:
   - URL: `https://<dominio-do-site>/api/webhooks/whatsapp`
   - Verify Token: qualquer string que você escolher (é o `WHATSAPP_VERIFY_TOKEN` abaixo — só prova que quem chamou o handshake é a Meta)
   - Marcar o campo `messages`
6. Em **Configurações do app → Básico**, pegar a **Chave Secreta do App** (App Secret).
7. Criar uma conta no [Google AI Studio](https://aistudio.google.com) e gerar uma chave da API Gemini.
8. No Vercel → Settings → Environment Variables, criar (todas **Sensitive**, Production and Preview):

   | Variável | Valor |
   |---|---|
   | `WHATSAPP_ACCESS_TOKEN` | token de acesso do passo 4 |
   | `WHATSAPP_PHONE_NUMBER_ID` | ID do passo 4 |
   | `WHATSAPP_APP_SECRET` | chave secreta do passo 6 |
   | `WHATSAPP_VERIFY_TOKEN` | a string que você escolheu no passo 5 |
   | `GEMINI_API_KEY` | chave do passo 7 |

9. Redeploy.

> **Nunca** com prefixo `VITE_` — o servidor se recusa a subir se detectar isso, porque embutiria as chaves no navegador do cliente.

## Como funciona

- **Personalidade**: prompt em `src/lib/whatsapp/agent.server.ts` (`SYSTEM_PROMPT`) — tom de WhatsApp de verdade, sem "sou uma assistente virtual", frases curtas, emoji com moderação. Ajustável sem tocar em mais nada.
- **Memória curta**: histórico de cada telefone fica em `whatsapp_conversations.history`, limitado às últimas 16 mensagens — controla custo de token e (por extensão) de mensagem enviada.
- **Ferramentas do agente**: nunca inventa preço, produto ou status.
  - `buscar_catalogo` — produtos e zonas de entrega reais do banco
  - `criar_pedido` — usa o **mesmo núcleo** do checkout do site (`createOrderCore.server.ts`): preço sempre do catálogo, nunca do que a conversa sugeriu
  - `consultar_status` — status real do pedido pelo número
  - `encerrar_atendimento_humano` — o agente para de responder; fica assim até alguém zerar `human_takeover` na tabela (não tem botão no admin ainda — ver pendências)
- **Idempotência**: cada `message_id` da Meta só é processado uma vez (a Meta reenvia se demorarmos a responder).
- **Rate limit**: 12 mensagens a cada 2 minutos por telefone — protege contra loop de erro ou abuso.

## Segurança (testado)

- Assinatura HMAC do webhook (`X-Hub-Signature-256`) verificada em tempo constante — 8 cenários testados (assinatura correta, forjada, sem header, segredo errado, corpo alterado, handshake certo/errado, extração de mensagem).
- `whatsapp_conversations` e `whatsapp_message_events`: RLS fechada, testado com a chave pública (leitura, escrita e a função de rate limit — todos negados).
- Preço do pedido criado pelo agente vem do mesmo caminho validado do site — não existe um "preço da conversa".

## O que falta (próximos passos, não bloqueiam o lançamento)

- **Handoff pra Bruna**: hoje `encerrar_atendimento_humano` só trava o agente; não existe uma tela no admin pra ela ver a conversa e "devolver" pro agente. Dá pra fazer via uma query manual no banco por enquanto, ou eu construo uma telinha simples no admin quando vocês quiserem.
- **Mídia**: o agente só entende mensagem de texto por enquanto — foto, áudio e figurinha são ignorados silenciosamente.
- **Teste real de ponta a ponta**: só dá pra fazer depois que vocês tiverem o número de teste da Meta — sem isso, não existe uma "conta de verdade" pra mandar mensagem.

## Onde mexer

| Arquivo | Papel |
|---|---|
| `src/lib/whatsapp/config.server.ts` | Leitura e validação das variáveis |
| `src/lib/whatsapp/meta.server.ts` | Conversa com a API da Meta (enviar, verificar assinatura, handshake) |
| `src/lib/whatsapp/agent.server.ts` | Personalidade, memória, ferramentas, loop com o Gemini |
| `src/routes/api/webhooks/whatsapp.ts` | Endpoint que recebe as mensagens |
| `supabase/migrations/20260731030000_whatsapp_agent.sql` | Tabelas, RLS, rate limit |
