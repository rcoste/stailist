"use client";

import { useState } from "react";
import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { PrendaZoom, type PrendaZoomData } from "@/components/prenda-zoom";
import { setTripLookVote, saveTripDownReason, favoriteTripLook } from "@/lib/trip-actions";
import { DownReason } from "@/components/down-reason";
import { useTripGen } from "@/components/trip-gen-context";
import { OCCASIONS, type Occasion } from "@/lib/trip";

// Un look del viaje ya resuelto contra el clóset (la página servidor mapea cada
// nombre de prenda a su imagen antes de pasarlo).
export type ResolvedOutfit = {
  ocasion: string;
  titulo: string;
  porque: string;
  tip: string | null;
  voto: "up" | "down" | null;
  prendas: { nombre: string; image: string | null }[];
};

const OCC_LABEL = new Map(OCCASIONS.map((o) => [o.value as string, o.label]));

// Corazón de favorito (relleno cuando on). Inline porque necesita fill; el Icon
// del set es siempre stroke. Guardar un look de viaje lo manda al Historial.
function Heart({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={on ? "text-accent" : "text-muted"}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />
    </svg>
  );
}

// Sección "Tus looks": los outfits que la maleta hace. Si aún no se generan,
// un botón los pide (POST al endpoint → router.refresh para re-renderear con
// ellos). `outfits === null` = nunca generados; `[]` = generados pero ninguno
// armable con lo que empacas.
export function TripOutfits({
  tripId,
  outfits,
  ocasiones,
  stale,
  favoritos = [],
}: {
  tripId: string;
  outfits: ResolvedOutfit[] | null;
  ocasiones: Occasion[];
  stale: boolean;
  favoritos?: number[]; // índices de looks favoriteados (promovidos a outfits)
}) {
  // La generación vive en TripTabs (la comparten el CTA de la maleta y estos
  // botones); aquí solo la consumimos vía context (no por props: cruzan la
  // frontera RSC y la inyección por cloneElement no llegaba — ver trip-gen-context).
  const { generating, appending, genError, genNote, onGenerate, onGenerateMore } =
    useTripGen();
  // Voto optimista por índice (arranca de lo que llegó del server).
  const [votos, setVotos] = useState<Record<number, "up" | "down" | null>>(
    Object.fromEntries((outfits ?? []).map((o, i) => [i, o.voto]))
  );
  const [zoom, setZoom] = useState<PrendaZoomData | null>(null);
  // Favorito optimista por índice. La verdad vive en outfits (fila promovida);
  // aquí guardamos el set para el corazón y revertimos si el server falla.
  const [favs, setFavs] = useState<Set<number>>(() => new Set(favoritos));
  const error = genError;
  const generar = () => onGenerate?.();

  function votar(index: number, up: boolean) {
    const next = up ? "up" : "down";
    setVotos((v) => ({ ...v, [index]: v[index] === next ? null : next }));
    setTripLookVote(tripId, index, up);
  }

  async function toggleFav(index: number) {
    const on = favs.has(index);
    setFavs((s) => {
      const n = new Set(s);
      if (on) n.delete(index);
      else n.add(index);
      return n;
    });
    const res = await favoriteTripLook(tripId, index, !on);
    if (!res.ok) {
      setFavs((s) => {
        const n = new Set(s);
        if (on) n.add(index);
        else n.delete(index);
        return n;
      });
    }
  }

  // La generación completa (primera vez / Rehacer) la cubre el overlay animado de
  // TripTabs; aquí no mostramos spinner de pantalla. "Generar más" (appending) SÍ
  // se queda en esta vista: conserva los looks y suma un indicador inline abajo.

  // Nunca generados: invitación.
  if (outfits === null) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">¿Y qué me pongo?</span>
          <span className="text-sm text-muted">
            Te armo los looks que tu maleta hace, listos para cada plan del viaje.
          </span>
        </div>
        {error ? (
          <p className="text-sm text-error">No pude armar tus looks — inténtalo otra vez.</p>
        ) : null}
        <button
          type="button"
          onClick={generar}
          className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          Arma mis looks
        </button>
      </div>
    );
  }

  // Generados pero ninguno armable.
  if (outfits.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <span className="text-sm text-muted">
          Con lo que empacas todavía no alcanza para un look completo. Acepta algún
          &quot;parecido&quot; o agrega prendas y vuelve a intentar.
        </span>
        {error ? (
          <p className="text-sm text-error">No pude armar tus looks — inténtalo otra vez.</p>
        ) : null}
        <button
          type="button"
          onClick={generar}
          className="flex min-h-11 items-center justify-center rounded-sm border border-line bg-bg px-4 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  // Ocasiones que elegiste pero que ningún look cubrió (no las omitimos en silencio).
  const cubiertas = new Set(outfits.map((o) => o.ocasion));
  const sinCubrir = ocasiones.filter((o) => !cubiertas.has(o));
  // Premio combinatorio: cuántas prendas distintas se cruzan en cuántos looks.
  const piezas = new Set(outfits.flatMap((o) => o.prendas.map((p) => p.nombre))).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {piezas > 0 ? (
          <span className="text-xs text-muted">
            {piezas} {piezas === 1 ? "pieza" : "piezas"} en {outfits.length}{" "}
            {outfits.length === 1 ? "look" : "looks"}
          </span>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onGenerateMore}
            disabled={generating}
            className="flex items-center gap-1 rounded-sm border border-accent bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
          >
            <Icon name="mas" size={13} strokeWidth={2} /> generar más
          </button>
          <button
            type="button"
            onClick={generar}
            disabled={generating}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            <Icon name="repetir" size={13} /> rehacer
          </button>
        </div>
      </div>

      {appending ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent-soft py-2.5 text-sm text-ink">
          <Spinner className="h-4 w-4 text-accent" /> sumando más looks…
        </div>
      ) : null}

      {genNote ? <p className="text-xs text-muted">{genNote}</p> : null}
      {error ? (
        <p className="text-xs text-error">
          No pude generar — el servicio está ocupado, espera unos segundos y reintenta.
        </p>
      ) : null}

      {/* #3 — los looks quedaron viejos tras un cambio de empaque. */}
      {stale ? (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent-soft p-3">
          <span className="text-sm text-ink">
            Cambiaste tu empaque — estos looks pueden estar desactualizados.
          </span>
          <button
            type="button"
            onClick={generar}
            className="flex min-h-10 w-fit items-center justify-center rounded-sm bg-accent px-3 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            actualizar mis looks
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-error">No pude armar otros looks — inténtalo otra vez.</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {outfits.map((o, i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface p-3.5 shadow-[var(--shadow-hairline)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="pt-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-accent">
                {OCC_LABEL.get(o.ocasion) ?? o.ocasion}
              </div>
              <button
                type="button"
                onClick={() => toggleFav(i)}
                aria-pressed={favs.has(i)}
                aria-label={favs.has(i) ? "Quitar de favoritos" : "Guardar en favoritos"}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <Heart on={favs.has(i)} />
              </button>
            </div>
            <h3 className="display mt-1 text-[18px] font-semibold leading-tight text-ink">
              {o.titulo}
            </h3>
            <div className="my-3 flex gap-[7px]">
              {o.prendas.map((p, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setZoom({ image: p.image, nombre: p.nombre })}
                  title={p.nombre}
                  aria-label={`Ver ${p.nombre}`}
                  className="relative aspect-[3/4] flex-1 overflow-hidden rounded-md border border-line bg-bg"
                >
                  {p.image ? (
                    <Image src={p.image} alt={p.nombre} fill sizes="120px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted">
                      <Icon name="gancho" size={18} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="display text-[13.5px] font-medium leading-relaxed text-ink">{o.porque}</p>
            {o.tip ? (
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-accent">
                <Icon name="destello" size={14} className="mt-0.5 shrink-0" />
                <span>{o.tip}</span>
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
              <span className="text-[11.5px] text-muted">¿Te gusta?</span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => votar(i, true)}
                  aria-pressed={votos[i] === "up"}
                  aria-label="Me gusta este look"
                  className={`flex h-[34px] w-[34px] items-center justify-center rounded-sm border transition-colors ${
                    votos[i] === "up"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted hover:border-ink"
                  }`}
                >
                  <Icon name="pulgar" size={17} active={votos[i] === "up"} />
                </button>
                <button
                  type="button"
                  onClick={() => votar(i, false)}
                  aria-pressed={votos[i] === "down"}
                  aria-label="No me gusta este look"
                  className={`flex h-[34px] w-[34px] items-center justify-center rounded-sm border transition-colors ${
                    votos[i] === "down"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted hover:border-ink"
                  }`}
                >
                  <Icon name="pulgar" size={17} rotate={180} active={votos[i] === "down"} />
                </button>
              </div>
            </div>
            {votos[i] === "down" ? (
              <div className="mt-3">
                <DownReason onSave={(r) => saveTripDownReason(tripId, i, r)} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* #2 — ocasiones elegidas que no se pudieron armar (no se omiten calladas). */}
      {sinCubrir.length > 0 ? (
        <p className="text-sm text-muted">
          No armamos look para{" "}
          <span className="text-ink">
            {sinCubrir.map((o) => (OCC_LABEL.get(o) ?? o).toLowerCase()).join(", ")}
          </span>{" "}
          — te falta algo para esa ocasión. Revisa &quot;Te falta&quot; arriba.
        </p>
      ) : null}

      <PrendaZoom data={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
