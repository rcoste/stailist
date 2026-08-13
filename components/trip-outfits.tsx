"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { LookCard } from "@/components/look-card";
import {
  setTripLookVote,
  saveTripDownReason,
  favoriteTripLook,
  ensureTripLookOutfit,
} from "@/lib/trip-actions";
import { useTripGen } from "@/components/trip-gen-context";
import { requestItemRender } from "@/lib/render-on-demand";
import { OCCASIONS, type Occasion } from "@/lib/trip";

// Un look del viaje ya resuelto contra el clóset (la página servidor mapea cada
// nombre de prenda a su imagen antes de pasarlo).
export type ResolvedOutfit = {
  ocasion: string;
  titulo: string;
  porque: string;
  tip: string | null;
  voto: "up" | "down" | null;
  /** Try-on ya generado para este look (URL firmada), si existe. */
  tryonImage?: string | null;
  prendas: { nombre: string; image: string | null; id?: string | null }[];
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
  const { generating, appending, genError, genNote, onGenerate, onGenerateMore, onViewMaleta } =
    useTripGen();
  // Voto optimista por índice (arranca de lo que llegó del server).
  const [votos, setVotos] = useState<Record<number, "up" | "down" | null>>(
    Object.fromEntries((outfits ?? []).map((o, i) => [i, o.voto]))
  );
  // Render bajo demanda (tap): prendas sugeridas sin imagen → se generan al
  // tocarlas. Cacheamos la url por id; `rendering` evita doble disparo.
  const [rendered, setRendered] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState<Set<string>>(new Set());

  async function renderPrenda(id: string) {
    if (rendering.has(id) || rendered[id]) return;
    setRendering((s) => new Set(s).add(id));
    const res = await requestItemRender(id);
    setRendering((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    if (res.url) setRendered((m) => ({ ...m, [id]: res.url as string }));
  }
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

  // NUNCA GENERADOS: el candado, no una invitación a generar desde aquí.
  //
  // Antes esta rama tenía su propio botón de "Arma mis looks", o sea que se
  // podía brincar directo a esta pestaña y generar SIN haber revisado las
  // sugerencias de la maleta — y esos looks (dinero + ~30s) salían de una
  // maleta que estabas a punto de editar. La primera generación vive en UN
  // solo lugar: el cierre de la maleta, después de la revisión. Esta pantalla
  // se ve (que se sepa que existe) pero manda de vuelta.
  if (outfits === null) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">¿Y qué me pongo?</span>
          <span className="text-sm text-muted">
            Te armo los looks que tu maleta hace — pero primero revisa el plan:
            acepta o cambia lo que te sugerí, y desde ahí me dices que te late.
          </span>
        </div>
        {error ? (
          <p className="text-sm text-error">No pude armar tus looks — inténtalo otra vez.</p>
        ) : null}
        <button
          type="button"
          onClick={onViewMaleta}
          className="flex min-h-11 items-center justify-center rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink"
        >
          revisar el plan
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

      {/* Desktop (handoff desktop_f3): cards de look a 2 columnas. */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        {outfits.map((o, i) => (
          <LookCard
            key={i}
            look={o}
            voto={votos[i] ?? null}
            favorito={favs.has(i)}
            onVote={(up) => votar(i, up)}
            onDownReason={(r) => void saveTripDownReason(tripId, i, r)}
            onFavorite={() => void toggleFav(i)}
            onRenderPrenda={renderPrenda}
            rendered={rendered}
            rendering={rendering}
            tryonImage={o.tryonImage ?? null}
            ensureOutfitId={async () => {
              const res = await ensureTripLookOutfit(tripId, i);
              return res.outfitId ?? null;
            }}
            returnTo={`/viaje/${tripId}?tab=looks`}
          />
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
