import Image from "next/image";
import type { ReactNode } from "react";

type Prenda = {
  nombre: string;
  detalle?: string;
  /** color de muestra (token o hex del attrs) — respaldo si no hay imagen */
  swatch: string;
  /** foto de la prenda (arquetipo o foto propia); si falta, se usa el swatch */
  imagen?: string | null;
};

export function OutfitCard({
  prendas,
  justificacion,
  corner,
}: {
  prendas: Prenda[];
  justificacion: string;
  /** Slot opcional en la esquina superior derecha (ej. el bookmark). */
  corner?: ReactNode;
}) {
  return (
    <article className="relative rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]">
      {corner ? <div className="absolute right-3 top-3 z-10">{corner}</div> : null}
      <div className="grid grid-cols-3 gap-3">
        {prendas.map((p) => (
          <figure key={p.nombre} className="flex flex-col gap-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-bg">
              {p.imagen ? (
                <Image
                  src={p.imagen}
                  alt={p.nombre}
                  fill
                  sizes="(max-width: 430px) 33vw, 130px"
                  className="object-cover"
                />
              ) : (
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: p.swatch }}
                  aria-hidden
                />
              )}
            </div>
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
    </article>
  );
}
