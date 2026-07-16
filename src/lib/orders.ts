export type OrderStatus = "Novo" | "Em preparo" | "Entregue";
export interface Order {
  id: string;
  customer: string;
  product: string;
  value: number;
  status: OrderStatus;
  date: string;
  phone: string;
  address: string;
}
export const mockOrders: Order[] = [
  { id: "#1047", customer: "Maria Souza", product: "Box Café da Manhã Completo", value: 199.9, status: "Novo", date: "2026-07-15", phone: "(49) 99123-4567", address: "Rua das Palmeiras, 45" },
  { id: "#1046", customer: "Carlos Mendes", product: "Buquê de Rosas Vermelhas", value: 129.9, status: "Em preparo", date: "2026-07-15", phone: "(49) 99987-6543", address: "Av. Central, 220" },
  { id: "#1045", customer: "Ana Beatriz", product: "Cesta Dia dos Namorados", value: 249.9, status: "Entregue", date: "2026-07-14", phone: "(47) 99845-1122", address: "Rua Sete de Setembro, 88" },
  { id: "#1044", customer: "Felipe Almeida", product: "Chocolate Bouquet", value: 99.9, status: "Entregue", date: "2026-07-14", phone: "(49) 99230-4567", address: "Rua XV de Novembro, 300" },
  { id: "#1043", customer: "Larissa Ribeiro", product: "Arranjo Floral Premium", value: 189.9, status: "Em preparo", date: "2026-07-13", phone: "(49) 99112-3344", address: "Av. Brasil, 512" },
  { id: "#1042", customer: "Bruno Ferreira", product: "Cesta Masculina", value: 179.9, status: "Novo", date: "2026-07-13", phone: "(49) 99334-5566", address: "Rua Pinheiros, 77" },
  { id: "#1041", customer: "Patrícia Lopes", product: "Bouquê Tropical", value: 79.9, status: "Entregue", date: "2026-07-12", phone: "(49) 99887-1122", address: "Rua das Acácias, 130" },
];
