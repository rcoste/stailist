import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import type { TryonMode } from "@/lib/use-tryon";

type Prenda = {
  nombre: string;
  detalle?: string;
  /** color de muestra (token o hex del attrs) — respaldo si no hay imagen */
  swatch: string;
  /** foto de la prenda (arquetipo o foto propia); si falta, se usa el swatch */
  imagen?: string | null;
};

// Try-on integrado en la tarjeta (pantalla Hoy). Si se omite, la card se ve
// igual que siempre (historial, wow) — el layout protagonista solo aparece aquí.
export type OutfitCardTryon = {
  status: TryonMode;
  image: string | null;
  errMsg?: string;
  lookName?: string;
  onGenerate: () => void;
  onExpand: () => void;
  /** Link al wizard de avatar (crear/cambiar). */
  changeHref: string;
};

export function OutfitCard({
  prendas,
  justificacion,
  corner,
  tryon,
}: {
  prendas: Prenda[];
  justificacion: string;
  /** Slot opcional en la esquina superior derecha (ej. el bookmark). */
  corner?: ReactNode;
  /** Estado del try-on; si viene, la card adopta el layout de 3 estados. */
  tryon?: OutfitCardTryon;
}) {
  const grid = (
    <div className="grid grid-cols-3 gap-3">
      {prendas.map((p) => (
        <figure key={p.nombre} className="flex flex-col gap-2">
          <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
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
  );

  const justif = (
    <p className="editorial text-center text-sm text-ink">{justificacion}</p>
  );

  const cornerSlot = corner ? (
    <div className="absolute right-3 top-3 z-10">{corner}</div>
  ) : null;

  // --- Sin try-on: layout clásico (grid + justificación) ---
  if (!tryon) {
    return (
      <article className="relative rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]">
        {cornerSlot}
        {grid}
        <hr className="my-4 border-line" />
        {justif}
      </article>
    );
  }

  // --- Estado 3: foto protagonista (hero) + tira de apoyo ---
  if (tryon.image) {
    return (
      <article className="relative overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-hairline)]">
        {cornerSlot}
        <div className="relative h-[360px] bg-bg">
          <button
            type="button"
            onClick={tryon.onExpand}
            aria-label="Ampliar tu foto"
            className="absolute inset-0 block"
          >
            <Image
              src={tryon.image}
              alt={
                tryon.lookName
                  ? `Tú con el look ${tryon.lookName}`
                  : "Tú con este look"
              }
              fill
              sizes="(max-width: 430px) 100vw, 384px"
              className="object-cover object-[50%_6%]"
            />
          </button>
          <span className="pointer-events-none absolute left-3 top-3 z-[5] flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface/90 px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-[var(--shadow-hairline)]">
            <Icon name="destello" size={14} className="text-accent" />
            Tú con este look
          </span>
          <span className="pointer-events-none absolute bottom-3 right-3 z-[5] flex items-center gap-1.5 rounded-full bg-ink/55 px-2.5 py-1.5 text-[11.5px] font-semibold text-on-accent backdrop-blur-sm">
            <Icon name="expandir" size={13} />
            Ampliar
          </span>
        </div>
        <div className="p-4">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
            Lleva puesto
          </p>
          <div className="flex gap-2">
            {prendas.map((p) => (
              <div
                key={p.nombre}
                className="relative aspect-square flex-1 overflow-hidden rounded-md border border-line bg-bg"
              >
                {p.imagen ? (
                  <Image
                    src={p.imagen}
                    alt={p.nombre}
                    fill
                    sizes="(max-width: 430px) 30vw, 110px"
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
            ))}
          </div>
          <hr className="my-4 border-line" />
          {/* Con la foto de protagonista, el "por qué" va colapsado para no
              competir con la imagen; se abre con un tap. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">
              ¿Por qué este look?
              <Icon
                name="chevron"
                size={15}
                className="transition-transform duration-200 group-open:rotate-90"
              />
            </summary>
            <p className="editorial mt-3 text-center text-sm text-ink">
              {justificacion}
            </p>
          </details>
        </div>
      </article>
    );
  }

  // --- Estados 1 y 2: grid + justificación + fila al pie ---
  return (
    <article className="relative overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-hairline)]">
      {cornerSlot}
      <div className="p-4">
        {grid}
        <hr className="my-4 border-line" />
        {justif}
      </div>
      <TryonRow tryon={tryon} />
    </article>
  );
}

// Fila tappable al pie de la card (estados antes-de-generar / generando / etc.).
function TryonRow({ tryon }: { tryon: OutfitCardTryon }) {
  const rowBase =
    "flex w-full items-center gap-2.5 border-t border-line p-3.5 text-left";

  if (tryon.status === "gen") {
    return (
      <div className={rowBase} aria-live="polite">
        <Spinner className="h-[15px] w-[15px] text-accent" />
        <span className="shimmer-txt whitespace-nowrap text-sm font-semibold">
          Creando tu look…
        </span>
        <span className="ml-auto whitespace-nowrap text-xs font-medium text-muted">
          ~20&nbsp;s
        </span>
      </div>
    );
  }

  if (tryon.status === "sin_avatar") {
    return (
      <Link href={tryon.changeHref} className={rowBase}>
        <Dot />
        <span className="whitespace-nowrap text-sm font-semibold text-ink">
          Crea tu avatar para verte
        </span>
        <span className="ml-auto flex items-center text-muted">
          <Icon name="chevron" size={15} />
        </span>
      </Link>
    );
  }

  if (tryon.status === "error") {
    return (
      <button type="button" onClick={tryon.onGenerate} className={rowBase}>
        <Dot />
        <span className="text-sm font-semibold text-error">
          {tryon.errMsg ?? "No pude crear tu look."}
        </span>
        <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted">
          Reintentar <Icon name="chevron" size={15} />
        </span>
      </button>
    );
  }

  // idle
  return (
    <button type="button" onClick={tryon.onGenerate} className={rowBase}>
      <Dot />
      <span className="whitespace-nowrap text-sm font-semibold text-ink">
        Verte con este look
      </span>
      <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted">
        ~20&nbsp;s <Icon name="chevron" size={15} />
      </span>
    </button>
  );
}

// Punto sólido de acento con el destello blanco dentro (detalle clave del rediseño).
function Dot() {
  return (
    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
      <Icon name="destello" size={14} />
    </span>
  );
}
