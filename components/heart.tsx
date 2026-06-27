// Corazón de favorito (relleno cuando on). Inline porque necesita fill; el Icon
// del set es siempre stroke. Off → muted (legible sobre círculo claro y dentro
// de chip), on → accent relleno. Compartido entre el diario y el detalle.
export function Heart({
  on,
  size = 18,
  className,
}: {
  on: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={className ?? (on ? "text-accent" : "text-muted")}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />
    </svg>
  );
}
