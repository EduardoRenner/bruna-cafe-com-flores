export function Petals({ count = 10 }: { count?: number }) {
  const petals = Array.from({ length: count }, (_, i) => {
    const left = (i * 97) % 100;
    const duration = 9 + ((i * 13) % 10);
    const delay = (i * 1.3) % 8;
    const size = 12 + ((i * 7) % 14);
    return { i, left, duration, delay, size };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((p) => (
        <span
          key={p.i}
          className="petal"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
