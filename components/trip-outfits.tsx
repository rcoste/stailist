"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { setTripLookVote } from "@/lib/trip-actions";
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

// Sección "Tus looks": los outfits que la maleta hace. Si aún no se generan,
// un botón los pide (POST al endpoint → router.refresh para re-renderear con
// ellos). `outfits === null` = nunca generados; `[]` = generados pero ninguno
// armable con lo que empacas.
export function TripOutfits({
  tripId,
  outfits,
  ocasiones,
  stale,
}: {
  tripId: string;
  outfits: ResolvedOutfit[] | null;
  ocasiones: Occasion[];
  stale: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Voto optimista por índice (arranca de lo que llegó del server).
  const [votos, setVotos] = useState<Record<number, "up" | "down" | null>>(
    Object.fromEntries((outfits ?? []).map((o, i) => [i, o.voto]))
  );

  async function generar() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/trip/${tripId}/outfits`, { method: "POST" });
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      router.refresh();
      // El refresh reemplaza estos props (outfits deja de ser null); soltamos el
      // loading tras un respiro para que no parpadee antes de llegar el render.
      setTimeout(() => setLoading(false), 600);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  function votar(index: number, up: boolean) {
    const next = up ? "up" : "down";
    setVotos((v) => ({ ...v, [index]: v[index] === next ? null : next }));
    setTripLookVote(tripId, index, up);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Spinner className="h-7 w-7 text-accent" />
        <p className="editorial text-base text-ink">armando tus looks…</p>
        <p className="text-sm text-muted">Combino lo que llevas — tarda unos segundos.</p>
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        {piezas > 0 ? (
          <span className="text-xs text-muted">
            {piezas} {piezas === 1 ? "pieza" : "piezas"} en {outfits.length}{" "}
            {outfits.length === 1 ? "look" : "looks"}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={generar}
          className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          Armar otros
        </button>
      </div>

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
            Actualizar mis looks
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
            <div className="text-[10px] font-bold uppercase tracking-[0.07em] text-accent">
              {OCC_LABEL.get(o.ocasion) ?? o.ocasion}
            </div>
            <h3 className="display mt-1 text-[18px] font-semibold leading-tight text-ink">
              {o.titulo}
            </h3>
            <div className="my-3 flex gap-[7px]">
              {o.prendas.map((p, j) => (
                <span
                  key={j}
                  title={p.nombre}
                  className="relative aspect-[3/4] flex-1 overflow-hidden rounded-md border border-line bg-bg"
                >
                  {p.image ? (
                    <Image src={p.image} alt={p.nombre} fill sizes="120px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted">
                      <Icon name="gancho" size={18} />
                    </span>
                  )}
                </span>
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
              <span className="text-[11.5px] text-muted">¿Te late?</span>
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
    </div>
  );
}
