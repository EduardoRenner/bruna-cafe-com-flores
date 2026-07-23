import { supabase } from "@/integrations/supabase/client";

export type DeliveryZone = {
  id: string;
  bairro: string;
  fee: number;
  active: boolean;
};

// Zonas ativas para o dropdown de frete do checkout (leitura pública via RLS).
export async function fetchActiveZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("id,bairro,fee,active")
    .eq("active", true)
    .order("bairro", { ascending: true });
  if (error) throw error;
  return (data as DeliveryZone[]).map((z) => ({ ...z, fee: Number(z.fee) }));
}
