import bouquetImg from "@/assets/bouquet.jpg";
import breakfastImg from "@/assets/breakfast-box.jpg";
import storefrontImg from "@/assets/hero-storefront.jpg";

export type Category = "Flores" | "Café & Box" | "Presentes" | "Arranjos";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  active: boolean;
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

export const initialProducts: Product[] = [
  { id: "p1", name: "Buquê Colorido Especial", description: "Mix de gérberas, girassóis e flores do campo com fita de cetim.", price: 89.9, category: "Flores", image: bouquetImg, active: true },
  { id: "p2", name: "Buquê de Rosas Vermelhas", description: "Doze rosas colombianas cuidadosamente selecionadas.", price: 129.9, category: "Flores", image: unsplash("1520763185298-1b434c919102"), active: true },
  { id: "p3", name: "Box Café da Manhã Petit Coffee", description: "Frutas frescas, pães, café especial e um mini arranjo.", price: 149.9, category: "Café & Box", image: breakfastImg, active: true },
  { id: "p4", name: "Box Café da Manhã Completo", description: "Café da manhã completo para dois, com flores e balão personalizado.", price: 199.9, category: "Café & Box", image: unsplash("1533089860892-a7c6f0a88666"), active: true },
  { id: "p5", name: "Cesta Dia dos Namorados", description: "Vinho, chocolates, rosas e mensagem à mão.", price: 249.9, category: "Presentes", image: unsplash("1518895949257-7621c3c786d7"), active: true },
  { id: "p6", name: "Arranjo Floral Premium", description: "Arranjo alto em vaso de vidro com flores nobres da estação.", price: 189.9, category: "Arranjos", image: unsplash("1487530811176-3780de880c2d"), active: true },
  { id: "p7", name: "Chocolate Bouquet", description: "Buquê exclusivo feito de chocolates Lindt e Ferrero.", price: 99.9, category: "Presentes", image: unsplash("1549007994-cb92caebd54b"), active: true },
  { id: "p8", name: "Cesta Masculina", description: "Whisky, petiscos e presentes cuidadosamente selecionados.", price: 179.9, category: "Presentes", image: unsplash("1514362545857-3bc16c4c7d1b"), active: true },
  { id: "p9", name: "Box Arraiá", description: "Delícias juninas, café e arranjo temático.", price: 139.9, category: "Café & Box", image: unsplash("1509440159596-0249088772ff"), active: true },
  { id: "p10", name: "Bouquê Tropical", description: "Flores tropicais vibrantes: strelítzias, helicônias e folhagens.", price: 79.9, category: "Flores", image: unsplash("1490750967868-88aa4486c946"), active: true },
  { id: "p11", name: "Arranjo para Aniversário", description: "Arranjo festivo com balão personalizado e vela.", price: 159.9, category: "Arranjos", image: storefrontImg, active: true },
  { id: "p12", name: "Cesta de Presentes Bebê", description: "Kit maternidade com fraldas, bichinho de pelúcia e flores suaves.", price: 219.9, category: "Presentes", image: unsplash("1519689680058-324335c77eba"), active: true },
];

export const categories: Category[] = ["Flores", "Café & Box", "Presentes", "Arranjos"];

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STORAGE_KEY = "bruna_products_v1";

export function loadProducts(): Product[] {
  if (typeof window === "undefined") return initialProducts;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialProducts;
    return JSON.parse(raw) as Product[];
  } catch {
    return initialProducts;
  }
}

export function saveProducts(list: Product[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
