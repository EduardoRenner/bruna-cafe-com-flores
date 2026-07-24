import { useId } from "react";

// Toldo listrado preto e branco com borda em escalope (meio-círculos para baixo),
// inspirado na fachada da loja. Usado como divisória de "entrada" entre seções.
// Desenhado com <pattern> em unidades de px (userSpaceOnUse) para tilar em
// qualquer largura sem distorcer os escalopes.
export function Awning({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  const id = useId().replace(/:/g, "");
  const black = "#17130f";
  const cream = "#f6f2ea";
  return (
    <div aria-hidden className={`w-full overflow-hidden leading-[0] ${className}`}>
      <svg
        className="block w-full"
        height={64}
        preserveAspectRatio="none"
        style={flip ? { transform: "scaleY(-1)" } : undefined}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={`awn-${id}`} width={104} height={64} patternUnits="userSpaceOnUse">
            {/* faixa preta + aba em escalope */}
            <path d="M0 0 H52 V42 C52 63 0 63 0 42 Z" fill={black} />
            {/* faixa creme + aba em escalope */}
            <path d="M52 0 H104 V42 C104 63 52 63 52 42 Z" fill={cream} />
          </pattern>
          <linearGradient id={`awnShade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.18" />
            <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height={64} fill={`url(#awn-${id})`} />
        {/* leve sombreado no topo para dar volume de tecido */}
        <rect width="100%" height={64} fill={`url(#awnShade-${id})`} />
      </svg>
    </div>
  );
}
