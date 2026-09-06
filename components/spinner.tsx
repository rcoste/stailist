// Spinner reutilizable: hereda el color del texto (`currentColor`), así que en
// el DS v3 monocromo sale en tinta o en muted según dónde se monte. El comentario
// decía "arco burdeos" — paleta v1, muerta desde el rebrand de 2026-06-26.
// Tamaño por className (ej. "h-8 w-8" en pantallas, "h-4 w-4" en botones).
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current ${className}`}
    />
  );
}
