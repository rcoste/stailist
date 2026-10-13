import { horaEnZona } from "@/lib/admin/adquisicion";
import { duracion } from "@/lib/admin/embudo";

// LOS CHECKPOINTS DE UNA PERSONA (2026-10-12): hasta dónde llegó, de un
// vistazo. Roberto: "checkpoints, para saber visualmente en qué partes se están
// cayendo las personas, y no nada más en el feed de actividad". Son los mismos
// escalones del embudo (lib/admin/embudo.ts PASOS), así que la ficha y el
// embudo nunca se contradicen.
//
// En vertical desde el 2026-10-13 (mockup de la ficha): un punto por paso, la
// línea que los une, y a la derecha cuánto tardó: la hora absoluta en el
// primero y "+12 s" respecto al paso anterior en los siguientes.
//
// Llegar es monótono SÓLO dentro del onboarding (hasta "primer look"): quien
// llegó al paso 7 pasó por el 1-6 aunque falte el evento (el onboarding cambió
// con el tiempo). Lo que viene después (foto, volvió) sólo cuenta si pasó.

export type Checkpoint = { id: string; label: string; cuando: string | null };

export function Checkpoints({ pasos }: { pasos: Checkpoint[] }) {
  const iPrimerLook = pasos.findIndex((p) => p.id === "primer_look");
  const hastaDonde = pasos.reduce((i, p, k) => (p.cuando && (iPrimerLook < 0 || k <= iPrimerLook) ? k : i), -1);

  // El "anterior" de cada paso con hora es el último paso con hora antes de él.
  const filas = pasos.map((p, i) => {
    const hecho = i <= hastaDonde || !!p.cuando;
    const anterior = pasos.slice(0, i).reverse().find((q) => q.cuando)?.cuando ?? null;
    const cuando = !p.cuando
      ? "—"
      : anterior && p.cuando >= anterior
        ? `+${duracion(Math.round((Date.parse(p.cuando) - Date.parse(anterior)) / 1000))}`
        : horaEnZona(p.cuando);
    return { ...p, hecho, cuando, destacado: p.id === "primer_look" };
  });

  return (
    <ol className="relative flex flex-col">
      {/* La línea que une los puntos: los puntos la tapan con su fondo. */}
      <span aria-hidden className="absolute bottom-2 left-1.5 top-2 w-px bg-line2" />
      {filas.map((p) => (
        <li key={p.id} className="relative flex items-center gap-2.5 py-1.5">
          <span className={`h-3 w-3 shrink-0 rounded-full ${p.hecho ? "bg-ink" : "border-2 border-line bg-surface"}`} />
          <span className={`min-w-0 flex-1 truncate text-sm ${p.hecho ? "text-ink" : "text-faint"} ${p.destacado ? "font-bold" : ""}`}>
            {p.label}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-faint">{p.cuando}</span>
        </li>
      ))}
    </ol>
  );
}
