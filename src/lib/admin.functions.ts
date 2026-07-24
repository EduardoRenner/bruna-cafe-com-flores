import { createServerFn } from "@tanstack/react-start";

// IP do cliente para o rate limiting. Em produção roda num Cloudflare Worker,
// que define `cf-connecting-ip` de forma confiável.
async function getClientIp(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest()?.headers;
    if (!headers) return "unknown";
    return (
      headers.get("cf-connecting-ip") ||
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
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
  if (error) throw new Error("Configuração indisponível");
  if (data === "locked") {
    throw new Error("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.");
  }
  if (data !== "ok") throw new Error("Senha incorreta");
  return supabaseAdmin;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    return { ok: true as const };
  });

// -------------------------------- PEDIDOS -----------------------------------
export const adminListOrders = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { data: orders, error } = await admin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; id: string; status: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { error } = await admin.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminUpdatePaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; id: string; payment_status: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
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
  .inputValidator((data: { password: string; id: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { error } = await admin.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ------------------------------- PRODUTOS -----------------------------------
export const adminListProducts = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { data: products, error } = await admin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return products ?? [];
  });

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      password: string;
      product: {
        id?: string;
        name: string;
        description?: string | null;
        price: number;
        category: string;
        image_url?: string | null;
        active: boolean;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const p = data.product;
    const payload = {
      name: p.name,
      description: p.description ?? null,
      price: p.price,
      category: p.category,
      image_url: p.image_url ?? null,
      active: p.active,
    };
    const { error } = p.id
      ? await admin.from("products").update(payload).eq("id", p.id)
      : await admin.from("products").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; id: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { error } = await admin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminUploadProductImage = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { password: string; fileName: string; contentType: string; base64: string }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);

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
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
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
      password: string;
      zone: { id?: string; bairro: string; fee: number; active: boolean };
    }) => data,
  )
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
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
  .inputValidator((data: { password: string; id: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { error } = await admin.from("delivery_zones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ------------------------------ CONFIGURAÇÕES -------------------------------
export const adminListSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    const { data: rows, error } = await admin
      .from("settings")
      .select("*")
      .neq("key", "admin_password");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateSetting = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; key: string; value: unknown }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);
    if (data.key === "admin_password") {
      const newPw = typeof data.value === "string" ? data.value : "";
      if (newPw.length < 8) throw new Error("Senha muito curta (mínimo 8 caracteres)");
      const { error } = await admin.rpc("set_admin_password", { _new_password: newPw });
      if (error) throw new Error(error.message);
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
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const admin = await verifyAdmin(data.password);

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
