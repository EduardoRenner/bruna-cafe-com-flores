// Arabesco (filigrana) ornamental nos tons da loja. Usa currentColor, então a
// cor vem da classe de texto de quem chama (ex.: text-rose-deep, text-coffee).
// Simétrico em torno de x=130. Serve como divisória sob títulos e, com opacidade
// baixa + rotação, como detalhe sutil de canto.
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 40"
      role="img"
      aria-hidden="true"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        {/* voluta esquerda */}
        <path d="M130 20 C 108 4 78 4 66 18 c -7 8 5 16 12 8 c 4 -4 -1 -10 -6 -7" />
        {/* voluta direita (espelhada) */}
        <path d="M130 20 C 152 4 182 4 194 18 c 7 8 -5 16 -12 8 c -4 -4 1 -10 6 -7" />
        {/* folhinhas centrais */}
        <path d="M112 14 C 120 7 122 7 130 13" opacity="0.75" />
        <path d="M148 14 C 140 7 138 7 130 13" opacity="0.75" />
        <path d="M130 13 C 127 7 133 7 130 2" opacity="0.6" />
      </g>
      <circle cx="130" cy="20" r="2.6" fill="currentColor" />
      <circle cx="59" cy="20" r="1.8" fill="currentColor" />
      <circle cx="201" cy="20" r="1.8" fill="currentColor" />
    </svg>
  );
}
