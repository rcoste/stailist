import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { RenderableTile } from "@/components/renderable-tile";

type Prenda = {
  nombre: string;
  detalle?: string;
  /** color de muestra (token o hex del attrs) — respaldo si no hay imagen */
  swatch: string;
  /** foto de la prenda (arquetipo o foto propia); si falta, se usa el swatch */
  imagen?: string | null;
  /** id del item — habilita el render bajo demanda cuando falta imagen */
  id?: string | null;
};

// Tarjeta de outfit: grid de prendas + justificación. Usada por Hoy, Historial
// y el wow del onboarding. (El try-on de Hoy ya NO vive aquí: la foto se muestra
// en el modal oscuro `tryon-immersive.tsx`.)
export function OutfitCard({
  prendas,
  justificacion,
  tip,
  corner,
  renderMode = "none",
}: {
  prendas: Prenda[];
  justificacion: string;
  /** "El toque": cómo llevarlo (opcional). */
  tip?: string | null;
  /** Slot opcional en la esquina superior derecha (ej. el bookmark). */
  corner?: ReactNode;
  /** Render bajo demanda de prendas sin imagen: "auto" en Hoy, "none" por defecto. */
  renderMode?: "auto" | "tap" | "none";
}) {
  // Regla de densidad (v3, global): 2 por fila con 3-4 prendas (más grandes, más
  // protagonismo), 3 por fila con 5-6.
  const cols = prendas.length <= 4 ? "grid-cols-2" : "grid-cols-3";
  return (
    <article className="relative rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]">
      {corner ? <div className="absolute right-3 top-3 z-10">{corner}</div> : null}

      <div className={`grid ${cols} gap-3`}>
        {prendas.map((p) => (
          <figure key={p.nombre} className="flex flex-col gap-2">
            <RenderableTile
              itemId={p.id}
              imagen={p.imagen}
              swatch={p.swatch}
              nombre={p.nombre}
              mode={renderMode}
            />
            <figcaption>
              <p className="text-xs font-medium uppercase tracking-wide text-ink">
                {p.nombre}
              </p>
              {p.detalle ? (
                <p className="editorial text-xs text-muted">{p.detalle}</p>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>

      <hr className="my-4 border-line" />

      <p className="editorial text-center text-sm text-ink">{justificacion}</p>

      {/* "El toque": cómo llevarlo. Solo si el juez lo sumó (puede no haber). */}
      {tip ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-sm text-accent">
          <Icon name="destello" size={14} className="shrink-0" />
          <span>{tip}</span>
        </p>
      ) : null}
    </article>
  );
}
