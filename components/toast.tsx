"use client";

// Toast transitorio compartido (cápsula + viaje): confirma una acción sin robar
// foco. Se posiciona despejado del FAB/tab bar y entra con fade + subida. El
// caller controla su vida (mostrar el mensaje ~2.2s y luego limpiarlo).
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="toast-in pointer-events-none fixed bottom-[calc(120px+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-sm bg-ink px-3.5 py-2 text-[12.5px] font-medium text-on-accent shadow-[var(--shadow-hairline)]"
    >
      {message}
    </div>
  );
}
