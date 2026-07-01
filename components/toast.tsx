"use client";

// Toast transitorio compartido (cápsula + viaje): confirma una acción sin robar
// foco. Va al CENTRO de la pantalla para que no se pierda ni choque con el FAB;
// entra con fade + escala. El caller controla su vida (~2.2s y luego lo limpia).
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-10"
    >
      <div className="toast-pop rounded-md bg-ink px-5 py-3 text-center text-sm font-medium text-on-accent shadow-[0_10px_30px_rgba(20,20,20,.25)]">
        {message}
      </div>
    </div>
  );
}
