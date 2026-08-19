import { createServerFn } from "@tanstack/react-start";

// getClientIp mora em request.server.ts: ele importa
// `@tanstack/react-start/server`, que a import-protection do Vite bloqueia se
// aparecer no grafo do cliente (rotas admin importam este arquivo).
async function getClientIp(): Promise<string> {
  const { getClientIp: impl } = await import("@/lib/request.server");
  return impl();
}

async function verifyAdmin(password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (typeof password !== "string" || password.length === 0 || password.length > 200) {
    throw new Error("Senha incorreta");
  }
  const ip = await getClientIp();
  // verify_admin_login faz rate limiting por IP (só conta falhas) + verifica a
  // senha (bcrypt) atomicamente. Retorna 'ok' | 'invalid' | 'locked'.
  const { data, error } = await supabaseAdmin.rpc("verify_admin_login", {
    _password: password,
    _ip: ip,
  });
  if (error) {
    // A tela mostra uma mensagem genérica de propósito — quem tenta invadir não
    // precisa saber como a infraestrutura está montada. Mas o motivo real tem
    // que ir para o log do servidor: sem isso, "Configuração indisponível"
    // cobre desde chave de service role errada até banco fora do ar, e não
    // sobra nada para investigar (foi o que aconteceu em 2026-08-04).
    console.error("[admin] verify_admin_login falhou", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("Configuração indisponível");
  }
  if (data === "locked") {
    throw new Error("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.");
  }
  if (data !== "ok") throw new Error("Senha incorreta");
  return supabaseAdmin;
}

/**
 * Porteiro de toda ação do painel.
 *
 * Confere o cookie de sessão (httpOnly, assinado, com validade) em vez de
 * reconferir a senha a cada chamada. A senha só trafega no login e na troca
 * de senha — em mais lugar nenhum.
 */
async function exigirSessao() {
  const { sessaoAdminValida } = await import("@/lib/admin-session.server");
  if (!(await sessaoAdminValida())) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const { criarSessaoAdmin } = await import("@/lib/admin-session.server");
    await criarSessaoAdmin();
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { encerrarSessaoAdmin } = await import("@/lib/admin-session.server");
  await encerrarSessaoAdmin();
  return { ok: true as const };
});

/** O painel pergunta isto ao montar, para saber se já há sessão válida. */
export const adminSessaoAtiva = createServerFn({ method: "POST" }).handler(async () => {
  const { sessaoAdminValida } = await import("@/lib/admin-session.server");
  return { ativa: await sessaoAdminValida() };
});

// -------------------------------- PEDIDOS -----------------------------------
export const adminListOrders = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const admin = await exigirSessao();

    // Confirmação por PIX/cartão depende do webhook do Mercado Pago ou de o
    // cliente reabrir a página pública do pedido -- nenhum dos dois acontece
    // se ele pagou e simplesmente fechou a aba. Sem isto, um pedido pago
    // ficava "pendente" no painel até alguém visitar /pedido/<token> de novo.
    // reconciliarPagamentoDoPedido já tem seu próprio limite de 10s por
    // pagamento, então chamar aqui a cada carregamento do painel é seguro.
    const { data: pendentes } = await admin
      .from("orders")
      .select("public_token")
      .eq("payment_status", "pendente")
      .in("payment_method", ["pix", "cartao"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (pendentes && pendentes.length > 0) {
      const { reconciliarPagamentoDoPedido } = await import("@/lib/payments/service.server");
      await Promise.all(
        pendentes.map((p) => reconciliarPagamentoDoPedido(p.public_token)),
      );
    }

    const { data: orders, error } = await admin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { error } = await admin.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminUpdatePaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; payment_status: string }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    if (!["pendente", "pago", "estornado"].includes(data.payment_status)) {
      throw new Error("Status de pagamento inválido");
    }
    const { error } = await admin
      .from("orders")
      .update({ payment_status: data.payment_status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { error } = await admin.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ------------------------------- PRODUTOS -----------------------------------
export const adminListProducts = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { data: products, error } = await admin
      .from("products")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return products ?? [];
  });

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      product: {
        id?: string;
        name: string;
        description?: string | null;
        price: number;
        category: string;
        image_url?: string | null;
        active: boolean;
        // Posição desejada no catálogo (1 = primeiro). Opcional: quando não
        // vem, a ordem atual do produto é preservada.
        display_order?: number | null;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const p = data.product;
    const payload = {
      name: p.name,
      description: p.description ?? null,
      price: p.price,
      category: p.category,
      image_url: p.image_url ?? null,
      active: p.active,
    };
    if (p.id) {
      const { error } = await admin.from("products").update(payload).eq("id", p.id);
      if (error) throw new Error(error.message);
      // A posição não entra no payload do update: gravar o número solto
      // recriaria os empates que a renumeração existe para evitar. Vai pelo
      // mesmo caminho das setas e do arrastar.
      if (typeof p.display_order === "number" && Number.isFinite(p.display_order)) {
        await reposicionarProduto(admin, p.id, Math.trunc(p.display_order) - 1);
      }
      return { ok: true as const };
    }
    // Produto novo entra no fim da ordem do catálogo.
    const { data: ultimo } = await admin
      .from("products")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await admin
      .from("products")
      .insert({ ...payload, display_order: (ultimo?.display_order ?? 0) + 1 });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Tira o produto da lista e o encaixa no índice `destino` (0-based), depois
 * renumera o catálogo inteiro em 1..N.
 *
 * Renumerar tudo, em vez de só gravar um número novo no produto movido, é
 * proposital. Números soltos criam EMPATES em display_order: aí a ordem real
 * cai no critério de desempate (created_at) e o produto aparece longe de onde
 * foi colocado, o que parece bug. Foi exatamente o que aconteceu aqui em
 * 2026-07-31 — a coluna tinha sido preenchida por categoria enquanto o código
 * ordena globalmente, deixando quatro produtos com display_order = 10, outros
 * quatro com 20, e assim por diante. Os dados já foram renumerados; renumerar
 * a cada movimento garante que o problema não volte, seja qual for a origem.
 *
 * As três formas de ordenar no painel (setas ↑↓, arrastar e soltar, campo de
 * posição na edição) passam por aqui, então nunca divergem entre si.
 */
async function reposicionarProduto(
  admin: Awaited<ReturnType<typeof exigirSessao>>,
  id: string,
  destino: number,
) {
  // Mesma ordenação que o admin e o catálogo público exibem.
  const { data: rows, error: erroLeitura } = await admin
    .from("products")
    .select("id")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (erroLeitura) throw new Error(erroLeitura.message);

  const ids = (rows ?? []).map((r) => r.id as string);
  const de = ids.indexOf(id);
  if (de < 0) throw new Error("Produto não encontrado");

  // Posição fora da lista não é erro: quem digita 99 no campo de posição quer
  // dizer "manda pro fim", e quem digita 0 quer "manda pro começo".
  const para = Math.min(Math.max(destino, 0), ids.length - 1);
  if (para === de) return;

  ids.splice(de, 1);
  ids.splice(para, 0, id);

  const resultados = await Promise.all(
    ids.map((pid, i) => admin.from("products").update({ display_order: i + 1 }).eq("id", pid)),
  );
  const falha = resultados.find((r) => r.error);
  if (falha?.error) throw new Error(falha.error.message);
}

/** Move um produto uma posição para cima/baixo no catálogo (setas ↑↓ no admin). */
export const adminMoveProductOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; direcao: "cima" | "baixo" }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();

    const { data: rows, error } = await admin
      .from("products")
      .select("id")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id as string);
    const de = ids.indexOf(data.id);
    if (de < 0) throw new Error("Produto não encontrado");

    await reposicionarProduto(admin, data.id, data.direcao === "cima" ? de - 1 : de + 1);
    return { ok: true as const };
  });

/**
 * Coloca o produto numa posição específica do catálogo (1 = primeiro).
 *
 * Usada pelo arrastar e soltar e pelo campo "Posição no catálogo". Recebe a
 * posição de destino em vez da lista inteira reordenada de propósito: se a
 * tela estiver desatualizada (a Bruna com o painel aberto em dois lugares),
 * mandar a lista toda apagaria as mudanças feitas do outro lado.
 */
export const adminSetProductPosition = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; posicao: number }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    if (!Number.isFinite(data.posicao)) throw new Error("Posição inválida");
    await reposicionarProduto(admin, data.id, Math.trunc(data.posicao) - 1);
    return { ok: true as const };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { error } = await admin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminUploadProductImage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { fileName: string; contentType: string; base64: string }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await exigirSessao();

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(data.contentType)) {
      throw new Error("Formato de imagem não suportado (use JPG, PNG, WEBP ou GIF)");
    }

    const buffer = Buffer.from(data.base64, "base64");
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (buffer.byteLength > maxBytes) {
      throw new Error("Imagem muito grande (máximo 5MB)");
    }

    const ext = data.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("product-images")
      .upload(path, buffer, { contentType: data.contentType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = admin.storage.from("product-images").getPublicUrl(path);
    return { url: publicUrlData.publicUrl };
  });

// ---------------------------- FRETE POR BAIRRO ------------------------------
export const adminListZones = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { data: zones, error } = await admin
      .from("delivery_zones")
      .select("*")
      .order("bairro", { ascending: true });
    if (error) throw new Error(error.message);
    return zones ?? [];
  });

export const adminUpsertZone = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      zone: { id?: string; bairro: string; fee: number; active: boolean };
    }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const z = data.zone;
    if (!z.bairro?.trim()) throw new Error("Informe o nome do bairro");
    if (!(z.fee >= 0)) throw new Error("Valor de frete inválido");
    const payload = { bairro: z.bairro.trim().slice(0, 120), fee: z.fee, active: z.active };
    const { error } = z.id
      ? await admin.from("delivery_zones").update(payload).eq("id", z.id)
      : await admin.from("delivery_zones").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteZone = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { error } = await admin.from("delivery_zones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ------------------------------ CONFIGURAÇÕES -------------------------------
export const adminListSettings = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    const { data: rows, error } = await admin
      .from("settings")
      .select("*")
      .neq("key", "admin_password");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateSetting = createServerFn({ method: "POST" })
  .inputValidator((data: { key: string; value: unknown; senhaAtual?: string }) => data)
  .handler(async ({ data }) => {
    const admin = await exigirSessao();
    if (data.key === "admin_password") {
      // Trocar a senha exige digitar a senha ATUAL, mesmo já tendo sessão.
      // Sem isso, quem chegasse numa aba de admin aberta (ou sequestrasse a
      // sessão) trocaria a senha e trancaria a dona para fora da própria loja.
      // Passa pelo verify_admin_login, então também herda o rate limit por IP.
      await verifyAdmin(String(data.senhaAtual ?? ""));

      const newPw = typeof data.value === "string" ? data.value : "";
      if (newPw.length < 8) throw new Error("Senha muito curta (mínimo 8 caracteres)");
      const { error } = await admin.rpc("set_admin_password", { _new_password: newPw });
      if (error) throw new Error(error.message);

      // A senha mudou: a sessão atual continua válida (quem trocou é a dona),
      // mas o cookie é reemitido para renovar o prazo.
      const { criarSessaoAdmin } = await import("@/lib/admin-session.server");
      await criarSessaoAdmin();
      return { ok: true as const };
    }
    const { error } = await admin
      .from("settings")
      .update({ value: data.value as never })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --------------------------------- STATS ------------------------------------
// Brasil é UTC-3 (sem horário de verão). O app roda em UTC; convertemos os
// timestamps para São Paulo antes de extrair dia/mês/hora.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;

function spStartOf(unit: "day" | "month" | "year", base = Date.now()): Date {
  const local = new Date(base - SP_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = unit === "year" ? 0 : local.getUTCMonth();
  const d = unit === "day" ? local.getUTCDate() : 1;
  return new Date(Date.UTC(y, m, d, 0, 0, 0) + SP_OFFSET_MS);
}
function toSP(iso: string): Date {
  return new Date(new Date(iso).getTime() - SP_OFFSET_MS);
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type OrderRow = { total: number; status: string; items: unknown; created_at: string };
type OrderItem = { name?: string; quantity?: number };

export const adminStats = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const admin = await exigirSessao();

    const startOfDay = spStartOf("day");
    const startOfYear = spStartOf("year");
    const now = Date.now();
    const since90 = now - 90 * 24 * 60 * 60 * 1000;
    const currentMonth = new Date(now - SP_OFFSET_MS).getUTCMonth();

    const [
      { count: todayCount },
      { count: pendingCount },
      { count: activeProducts },
      { data: yearOrders },
    ] = await Promise.all([
      admin.from("orders").select("*", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()),
      admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      admin.from("products").select("*", { count: "exact", head: true }).eq("active", true),
      admin
        .from("orders")
        .select("total,status,items,created_at")
        .gte("created_at", startOfYear.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const rows = (yearOrders ?? []) as OrderRow[];
    const valid = rows.filter((o) => o.status !== "cancelado");

    const monthlyRevenue = Array(12).fill(0) as number[];
    const weekdayRaw = Array(7).fill(0) as number[];
    const prodMap = new Map<string, number>();
    const hourCount = Array(24).fill(0) as number[];

    for (const o of valid) {
      const d = toSP(o.created_at);
      const total = Number(o.total) || 0;
      monthlyRevenue[d.getUTCMonth()] += total;

      const ts = new Date(o.created_at).getTime();
      if (ts >= since90) {
        weekdayRaw[d.getUTCDay()] += total;
        hourCount[d.getUTCHours()] += 1;
      }

      const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
      for (const it of items) {
        const name = (it?.name ?? "").toString().trim() || "Sem nome";
        if (name.toLowerCase() === "taxa de entrega") continue;
        const qty = Number(it?.quantity) || 0;
        if (qty > 0) prodMap.set(name, (prodMap.get(name) ?? 0) + qty);
      }
    }

    const weekdayRevenue = [1, 2, 3, 4, 5, 6, 0].map((i) => weekdayRaw[i]);

    const statusCounts: Record<string, number> = {
      pendente: 0,
      em_preparo: 0,
      saiu_entrega: 0,
      entregue: 0,
      cancelado: 0,
    };
    for (const o of rows) {
      if (o.status in statusCounts) statusCounts[o.status] += 1;
    }

    const topProducts = [...prodMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const revenueYear = valid.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const ticketMedio = valid.length ? revenueYear / valid.length : 0;
    const monthRevenue = monthlyRevenue[currentMonth];

    let bestMonthIdx = -1;
    for (let i = 0; i < 12; i++) {
      if (monthlyRevenue[i] > 0 && (bestMonthIdx < 0 || monthlyRevenue[i] > monthlyRevenue[bestMonthIdx])) {
        bestMonthIdx = i;
      }
    }
    const melhorMes = bestMonthIdx >= 0 ? MONTH_NAMES[bestMonthIdx] : null;

    let peakHour = -1;
    for (let h = 0; h < 24; h++) {
      if (hourCount[h] > 0 && (peakHour < 0 || hourCount[h] > hourCount[peakHour])) peakHour = h;
    }
    const horarioPico =
      peakHour >= 0 ? `${String(peakHour).padStart(2, "0")}h–${String((peakHour + 1) % 24).padStart(2, "0")}h` : null;

    return {
      todayCount: todayCount ?? 0,
      pendingCount: pendingCount ?? 0,
      activeProducts: activeProducts ?? 0,
      monthRevenue,
      weekdayRevenue,
      monthlyRevenue,
      topProducts,
      statusCounts,
      totalOrdersYear: rows.length,
      ticketMedio,
      produtoCampeao: topProducts[0]?.name ?? null,
      melhorMes,
      horarioPico,
      hasData: rows.length > 0,
    };
  });
