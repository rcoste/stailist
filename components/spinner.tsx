// Spinner reutilizable con los tokens del DS (anillo hairline + arco burdeos).
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
