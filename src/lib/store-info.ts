export const store = {
  name: "Bruna Café com Flores",
  tagline: "Flores, café e presentes únicos para cada ocasião especial",
  address: "Av. Pres. Kennedy, 260 - Padre Antonio, Maravilha - SC, 89874-000",
  phone: "(49) 99810-5239",
  phoneDigits: "5549998105239",
  whatsapp: "(47) 99107-2410",
  whatsappDigits: "5547991072410",
  instagram: "brunacafecomflores",
  hours: [
    { day: "Segunda a Sexta", time: "08:00 – 11:30 · 13:00 – 18:15" },
    { day: "Sábado", time: "08:00 – 12:00" },
    { day: "Domingo", time: "Fechado" },
  ],
  coords: { lat: -26.7619891, lng: -53.1786316 },
  delivery: "R$ 10,00 (Maravilha e região)",
};

export function whatsappLink(text: string) {
  return `https://wa.me/${store.whatsappDigits}?text=${encodeURIComponent(text)}`;
}
