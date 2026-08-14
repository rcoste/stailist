"use client";

import { useRef } from "react";
import { Icon } from "@/components/icon";
import { saveDownReason, saveSkipReason } from "@/lib/outfit-actions";

// Bottom sheet de razones, con dos entradas:
//   "skip" — al tocar "Otro look": la razón es opcional y al elegir regenera.
//   "down" — al tocar 👎 (voto ligero): la razón etiqueta el voto (saveDownReason)
//            y NO regenera sola; "ver otro look" queda como CTA por si quiere.
// Antes vivía inline debajo de los botones y se perdía sin scroll; como hoja
// overlay es imposible de no ver. NUNCA bloquea — la tesis es matar fricción.
const REASONS = ["No es mi estilo", "No es la ocasión", "Los colores", "No me queda"];

export function SkipReasons({
  outfitId,
  mode = "skip",
  onProceed,
  onClose,
}: {
  outfitId: string;
  mode?: "skip" | "down";
  onProceed: () => void;
  onClose: () => void;
}) {
  // Candado anti-doble-tap: la hoja cierra en el mismo frame, pero dos taps
  // rápidos sobre el mismo chip alcanzaban a disparar DOS escrituras.
  const picked = useRef(false);
  function pick(reason: string) {
    if (picked.current) return;
    picked.current = true;
    if (mode === "down") {
      saveDownReason(outfitId, reason); // etiqueta el 👎; fire-and-forget
      onClose(); // el voto ya quedó — no regenera salvo que lo pida
    } else {
      saveSkipReason(outfitId, reason); // fire-and-forget, no bloquea
      onProceed();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className="relative z-10 w-full max-w-[430px] rounded-t-[18px] lg:rounded-[18px] bg-surface px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 mt-1.5 h-1 w-9 rounded-full bg-line" />
        <h3 className="mx-1 text-[19px] font-semibold text-ink">
          {mode === "down" ? "¿Qué no te lató?" : "¿Qué ajusto?"}
        </h3>
        <p className="mx-1 mb-3.5 text-sm text-muted">
          {mode === "down"
            ? "Opcional — así afino tu estilo de verdad."
            : "Opcional — me ayuda a darte uno mejor."}
        </p>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => pick(r)}
              className="rounded-sm border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent"
            >
              {r}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onProceed}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
        >
          {mode === "down" ? "Ver otro look" : "Solo ver otro look"}
          <Icon name="chevron" size={15} />
        </button>
      </div>
    </div>
  );
}
