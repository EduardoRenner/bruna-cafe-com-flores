import { supabase } from "@/integrations/supabase/client";

export type Category = "Flores" | "Café & Box" | "Presentes" | "Arranjos";

// Produto usado na UI. `image` continua sendo o campo exibido nos componentes;
// no banco a coluna é `image_url` (mapeada no fetch abaixo).
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  active: boolean;
}

export const categories: Category[] = ["Flores", "Café & Box", "Presentes", "Arranjos"];

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  active: boolean;
};

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    price: Number(r.price),
    category: r.category as Category,
    image: r.image_url ?? "",
    active: r.active,
  };
}

// Catálogo público: só produtos ativos (a policy do banco também garante isso).
export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,price,category,image_url,active")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ProductRow[]).map(rowToProduct);
}
