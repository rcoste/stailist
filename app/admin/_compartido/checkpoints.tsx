// LOS CHECKPOINTS DE UNA PERSONA (2026-10-12): hasta dónde llegó, de un
// vistazo. Roberto: "checkpoints, para saber visualmente en qué partes se están
// cayendo las personas, y no nada más en el feed de actividad". Son los mismos
// escalones del embudo (lib/admin/embudo.ts PASOS), así que la ficha y el
// embudo nunca se contradicen: un punto lleno por cada paso que terminó, y el
// primero vacío es donde se quedó.

export type Checkpoint = { id: string; label: string; cuando: string | null };

export function Checkpoints({ pasos, hora }: { pasos: Checkpoint[]; hora: (iso: string) => string }) {
  const ultimo = pasos.reduce((i, p, k) => (p.cuando ? k : i), -1);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-3">
      {pasos.map((p, i) => {
        const hecho = i <= ultimo;
        const aqui = i === ultimo + 1;
        return (
          <li key={p.id} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`block h-3 w-3 rounded-full border ${
                  hecho ? "border-ink bg-ink" : aqui ? "border-error bg-surface" : "border-line bg-surface"
                }`}
                title={p.cuando ? `${p.label} · ${hora(p.cuando)}` : p.label}
              />
              <span className={`max-w-20 text-center text-[10px] leading-tight ${hecho ? "text-ink" : aqui ? "font-semibold text-error" : "text-muted"}`}>
                {p.label}
                {aqui ? <span className="block">se quedó aquí</span> : null}
              </span>
            </div>
            {i < pasos.length - 1 ? <span className={`mb-5 h-px w-3 ${i < ultimo ? "bg-ink" : "bg-line"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
