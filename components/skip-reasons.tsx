"use client";

import { saveSkipReason } from "@/lib/outfit-actions";

// Aparece al tocar "Otro look": pregunta opcional "¿qué ajusto?" con chips.
// Elegir uno guarda la razón (señal del porqué falló) y regenera; "Solo ver otro"
// regenera sin razón. NUNCA bloquea — la tesis es matar la fricción.
const REASONS = ["No es mi estilo", "No es la ocasión", "Los colores", "No me queda"];

export function SkipReasons({
  outfitId,
  onProceed,
}: {
  outfitId: string;
  onProceed: () => void;
}) {
  function pick(reason: string) {
    saveSkipReason(outfitId, reason); // fire-and-forget, no bloquea
    onProceed();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg px-3 py-3">
      <p className="text-xs font-medium text-muted">¿Qué ajusto? (opcional)</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pick(r)}
            className="rounded-sm border border-line bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors duration-200 hover:border-accent"
          >
            {r}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onProceed}
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        Solo ver otro look →
      </button>
    </div>
  );
}
