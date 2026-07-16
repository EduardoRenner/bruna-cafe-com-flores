import { Flower2, Instagram, MapPin, Phone, Clock } from "lucide-react";
import { store } from "@/lib/store-info";
import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-coffee text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4 md:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Flower2 className="h-6 w-6 text-rose" />
            <span className="font-display text-xl">Bruna Café com Flores</span>
          </div>
          <p className="mt-4 text-sm text-cream/80">
            Especialista em presentes únicos para momentos especiais em Maravilha, SC.
          </p>
        </div>
        <div>
          <h4 className="font-display text-lg">Navegação</h4>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li><Link to="/" className="hover:text-rose">Início</Link></li>
            <li><Link to="/catalogo" className="hover:text-rose">Catálogo</Link></li>
            <li><Link to="/sobre" className="hover:text-rose">Sobre</Link></li>
            <li><Link to="/contato" className="hover:text-rose">Contato</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg">Contato</h4>
          <ul className="mt-3 space-y-3 text-sm text-cream/80">
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose" /> {store.address}</li>
            <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-rose" /> {store.phone} · WhatsApp {store.whatsapp}</li>
            <li className="flex gap-2"><Instagram className="mt-0.5 h-4 w-4 shrink-0 text-rose" /> <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="hover:text-rose">@{store.instagram}</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg">Horários</h4>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            {store.hours.map((h) => (
              <li key={h.day} className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-rose" /><span><strong className="text-cream">{h.day}</strong><br />{h.time}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 py-5 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} Bruna Café com Flores · Todos os direitos reservados
      </div>
    </footer>
  );
}
