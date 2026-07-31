// Agente de WhatsApp — personalidade, memória curta e ferramentas. SERVER-ONLY.
//
// O modelo nunca inventa preço, estoque ou status de pedido: tudo isso vem
// das mesmas funções que o site usa (createOrderCore, catálogo, RPC de
// status). O modelo só decide QUANDO chamar cada uma, a partir da conversa.

import type { WhatsAppConfig } from "./config.server";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.5-flash";

// Histórico curto: controla custo de token e (indiretamente) o número de
// mensagens que o agente manda — cada resposta no WhatsApp custa dinheiro a
// partir de out/2026, então respostas curtas e diretas importam de verdade.
const MAX_HISTORICO = 16;

const SYSTEM_PROMPT = `Você é quem atende o WhatsApp da Bruna Café com Flores, uma floricultura e cafeteria em Maravilha, SC. Você NÃO é uma assistente virtual — você atende como uma pessoa de verdade atenderia, no estilo de mensagem de WhatsApp: direto, caloroso, sem formalidade de e-mail corporativo.

Regras de tom:
- Frases curtas. Mensagens de WhatsApp, não parágrafos de site.
- Nunca diga "sou uma IA", "assistente virtual", "modelo de linguagem" ou qualquer coisa parecida. Se perguntarem se você é um robô, desconverse com leveza e continue ajudando — sem mentir descaradamente, mas sem se identificar como IA.
- Sem "Olá! Como posso ajudá-lo hoje?" — fale como alguém que já está no meio da correria da loja: "Oi! Tudo bem? 🌸" já é suficiente.
- Emoji com moderação (0-1 por mensagem, não em toda frase).
- Nunca invente preço, produto, prazo ou status de pedido. Se não souber, use as ferramentas ou diga que vai confirmar.
- Se o cliente parecer frustrado, irritado, ou pedir para falar com uma pessoa, use a ferramenta encerrar_atendimento_humano e avise que a Bruna vai continuar por ali.
- Nunca finalize um pedido sem ter: nome, telefone (o próprio número do WhatsApp já serve), forma de entrega, endereço se for entrega, e forma de pagamento.
- Depois de criar o pedido de verdade (ferramenta criar_pedido), informe o número do pedido e o total. Não repita o resumo inteiro de novo.

Dados da loja:
- Nome: Bruna Café com Flores
- Endereço: Av. Pres. Kennedy, 260 - Padre Antônio, Maravilha - SC
- Horário: Segunda a Sexta 08h-11h30 e 13h-18h15, Sábado 08h-12h, Domingo fechado
- Formas de pagamento aceitas: pix, dinheiro, cartão
- Use a ferramenta buscar_catalogo para saber produtos e preços reais antes de sugerir qualquer coisa.
- Use a ferramenta buscar_catalogo também para saber os bairros de entrega e taxas.`;

type ChatTurn = { role: "user" | "model"; content: string; at: string };

function turno(role: ChatTurn["role"], content: string): ChatTurn {
  return { role, content, at: new Date().toISOString() };
}

type ToolResult = { nome: string; resultado: unknown };

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "buscar_catalogo",
        description: "Lista os produtos ativos (com id, nome, preço, categoria) e os bairros de entrega com taxa. Chame sempre antes de falar preço ou produto.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "criar_pedido",
        description: "Registra o pedido de verdade no sistema da loja depois que o cliente confirmou tudo. O preço é sempre recalculado pelo servidor a partir do catálogo — não é preciso (nem adianta) informar preço aqui.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            customer_phone: { type: "string", description: "Número de WhatsApp do cliente, com DDI e DDD." },
            delivery_type: { type: "string", enum: ["delivery", "pickup"] },
            bairro: { type: "string", description: "Obrigatório se delivery_type for delivery. Precisa bater com um bairro do buscar_catalogo." },
            rua: { type: "string" },
            numero: { type: "string" },
            complemento: { type: "string" },
            payment_method: { type: "string", enum: ["pix", "dinheiro", "cartao"] },
            notes: { type: "string", description: "Observações, mensagem de cartão, etc." },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "id do produto vindo de buscar_catalogo" },
                  quantity: { type: "number" },
                },
                required: ["id", "quantity"],
              },
            },
          },
          required: ["customer_name", "customer_phone", "delivery_type", "payment_method", "items"],
        },
      },
      {
        name: "consultar_status",
        description: "Consulta o status de um pedido já criado, pelo número do pedido (ex.: BCF-1042) informado pelo cliente.",
        parameters: {
          type: "object",
          properties: { numero_pedido: { type: "string" } },
          required: ["numero_pedido"],
        },
      },
      {
        name: "encerrar_atendimento_humano",
        description: "Para de responder automaticamente e sinaliza que a Bruna precisa assumir a conversa manualmente.",
        parameters: {
          type: "object",
          properties: { motivo: { type: "string" } },
        },
      },
    ],
  },
];

async function executarFerramenta(nome: string, args: Record<string, unknown>): Promise<unknown> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (nome === "buscar_catalogo") {
    const [{ data: produtos }, { data: zonas }] = await Promise.all([
      supabaseAdmin.from("products").select("id,name,description,price,category").eq("active", true),
      supabaseAdmin.from("delivery_zones").select("bairro,fee").eq("active", true),
    ]);
    return {
      produtos: (produtos ?? []).map((p) => ({ id: p.id, nome: p.name, preco: Number(p.price), categoria: p.category })),
      bairros: (zonas ?? []).map((z) => ({ bairro: z.bairro, taxa: Number(z.fee) })),
    };
  }

  if (nome === "criar_pedido") {
    const { criarPedido, OrderValidationError } = await import("@/lib/orders/createOrderCore.server");
    try {
      const resultado = await criarPedido(
        {
          customer_name: String(args.customer_name ?? ""),
          customer_phone: String(args.customer_phone ?? ""),
          delivery_type: args.delivery_type === "delivery" ? "delivery" : "pickup",
          delivery_address:
            args.delivery_type === "delivery"
              ? {
                  bairro: String(args.bairro ?? ""),
                  rua: String(args.rua ?? ""),
                  numero: String(args.numero ?? ""),
                  complemento: String(args.complemento ?? ""),
                }
              : null,
          payment_method: String(args.payment_method ?? ""),
          notes: args.notes ? String(args.notes) : null,
          items: Array.isArray(args.items)
            ? (args.items as { id: string; quantity: number }[]).map((i) => ({ id: String(i.id), quantity: Number(i.quantity) }))
            : [],
        },
        // O IP de quem chama é o servidor da Meta, não o cliente final — o
        // rate limit real de abuso aqui é por telefone (check_whatsapp_rate_limit),
        // já aplicado antes do agente rodar.
        { clientIp: "whatsapp-agent" },
      );
      return { ok: true, ...resultado };
    } catch (err) {
      if (err instanceof OrderValidationError) return { ok: false, erro: err.message };
      throw err;
    }
  }

  if (nome === "consultar_status") {
    const numero = String(args.numero_pedido ?? "").trim();
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("order_number,status,payment_status,total")
      .eq("order_number", numero)
      .maybeSingle();
    if (error || !data) return { encontrado: false };
    return { encontrado: true, ...data };
  }

  if (nome === "encerrar_atendimento_humano") {
    return { ok: true };
  }

  return { erro: "ferramenta desconhecida" };
}

async function chamarGemini(cfg: WhatsAppConfig, contents: unknown[]): Promise<{
  texto: string | null;
  chamadasFerramenta: { nome: string; args: Record<string, unknown> }[];
}> {
  const res = await fetch(`${GEMINI_API}/${MODEL}:generateContent?key=${cfg.geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: TOOLS,
      generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Gemini respondeu ${res.status}: ${corpo.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args: Record<string, unknown> } }[] } }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const texto = parts.map((p) => p.text).filter(Boolean).join(" ") || null;
  const chamadasFerramenta = parts
    .filter((p) => p.functionCall)
    .map((p) => ({ nome: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
  return { texto, chamadasFerramenta };
}

export type RespostaAgente = { texto: string; encerrarParaHumano: boolean };

/**
 * Processa uma mensagem recebida e devolve o que o agente responde.
 *
 * Faz um loop de até 4 idas-e-voltas com o modelo (mensagem -> possível
 * chamada de ferramenta -> resultado -> resposta final), suficiente para
 * "buscar catálogo, depois criar pedido" numa única mensagem do cliente sem
 * deixar looping infinito em caso de comportamento inesperado do modelo.
 */
export async function processarMensagem(
  cfg: WhatsAppConfig,
  phone: string,
  textoRecebido: string,
  historico: ChatTurn[],
): Promise<RespostaAgente & { novoHistorico: ChatTurn[] }> {
  const contents: { role: "user" | "model" | "function"; parts: unknown[] }[] = historico
    .slice(-MAX_HISTORICO)
    .map((h) => ({ role: h.role, parts: [{ text: h.content }] }));
  contents.push({ role: "user", parts: [{ text: textoRecebido }] });

  let encerrarParaHumano = false;
  const ferramentasChamadas: ToolResult[] = [];

  for (let volta = 0; volta < 4; volta++) {
    const { texto, chamadasFerramenta } = await chamarGemini(cfg, contents);

    if (chamadasFerramenta.length === 0) {
      const respostaFinal = texto?.trim() || "Deixa eu confirmar uma coisa aqui e já te respondo!";
      const novoHistorico: ChatTurn[] = [
        ...historico,
        turno("user", textoRecebido),
        turno("model", respostaFinal),
      ].slice(-MAX_HISTORICO);
      return { texto: respostaFinal, encerrarParaHumano, novoHistorico };
    }

    contents.push({
      role: "model",
      parts: chamadasFerramenta.map((c) => ({ functionCall: { name: c.nome, args: c.args } })),
    });

    for (const chamada of chamadasFerramenta) {
      if (chamada.nome === "encerrar_atendimento_humano") encerrarParaHumano = true;
      const resultado = await executarFerramenta(chamada.nome, chamada.args);
      ferramentasChamadas.push({ nome: chamada.nome, resultado });
      contents.push({
        role: "function",
        parts: [{ functionResponse: { name: chamada.nome, response: resultado as object } }],
      });
    }

    if (encerrarParaHumano) {
      const respostaFinal = "Já te chamei uma pessoa de verdade aqui, só um instante! 🌷";
      const novoHistorico: ChatTurn[] = [
        ...historico,
        turno("user", textoRecebido),
        turno("model", respostaFinal),
      ].slice(-MAX_HISTORICO);
      return { texto: respostaFinal, encerrarParaHumano, novoHistorico };
    }
  }

  const fallback = "Deixa eu confirmar isso direitinho e te retorno em instantes!";
  return {
    texto: fallback,
    encerrarParaHumano,
    novoHistorico: [...historico, turno("user", textoRecebido), turno("model", fallback)].slice(
      -MAX_HISTORICO,
    ),
  };
}
