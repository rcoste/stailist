"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { LookCard, type LookCardData } from "@/components/look-card";
import { requestItemRender } from "@/lib/render-on-demand";
import { OCCASIONS, type Occasion } from "@/lib/trip";
import {
  ensureCapsuleLookOutfit,
  favoriteCapsuleLook,
  generateCapsuleOutfits,
  saveCapsuleLookDownReason,
  setCapsuleLookVote,
} from "@/app/closet/capsula/looks-actions";

const OCC_LABEL = new Map(OCCASIONS.map((o) => [o.value as string, o.label]));

const PHRASES: GenPhrase[] = [
  { a: "mirando tu ", k: "cápsula", b: "…" },
  { a: "cruzando tus ", k: "prendas", b: "…" },
  { a: "armando ", k: "combinaciones", b: "…" },
];

export type CapsuleLook = LookCardData & {
  voto: "up" | "down" | null;
  favorito: boolean;
  tryonImage: string | null;
};

// "Los looks de tu cápsula": el payoff de la métrica "~N looks". Outfits armados
// con lo que YA tienes de tu cápsula (motor del viaje). Generación on-demand,
// cacheada; el loading reusa la pantalla de frases de Hoy/Viaje. La card es la
// misma pieza que usa el viaje (components/look-card) — corazón, voto y try-on
// incluidos: antes esta vista era una versión pobre que se quedó atrás sola.
export function CapsuleLooks({
  outfits,
  stale,
  ocasiones = [],
}: {
  outfits: CapsuleLook[] | null;
  stale: boolean;
  /** Ocasiones que su vida pide: si alguna no salió, se dice (no se omite). */
  ocasiones?: Occasion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [appending, setAppending] = useState(false);
  const [error, setError] = useState(false);
  const [votos, setVotos] = useState<Record<number, "up" | "down" | null>>(
    Object.fromEntries((outfits ?? []).map((o, i) => [i, o.voto]))
  );
  const [favs, setFavs] = useState<Set<number>>(
    () => new Set((outfits ?? []).flatMap((o, i) => (o.favorito ? [i] : [])))
  );
  const [rendered, setRendered] = useState<Record<string, string>>({});
  const [rendering, setRendering] = useState<Set<string>>(new Set());

  const generate = (append = false) =>
    startTransition(async () => {
      setError(false);
      setAppending(append);
      const res = await generateCapsuleOutfits(append);
      setAppending(false);
      if (!res.ok) setError(true);
      router.refresh();
    });

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

  function votar(index: number, up: boolean) {
    const next = up ? "up" : "down";
    setVotos((v) => ({ ...v, [index]: v[index] === next ? null : next }));
    void setCapsuleLookVote(index, up);
  }

  async function toggleFav(index: number, on: boolean) {
    setFavs((s) => {
      const n = new Set(s);
      if (on) n.add(index);
      else n.delete(index);
      return n;
    });
    const res = await favoriteCapsuleLook(index, on);
    if (!res.ok) {
      setFavs((s) => {
        const n = new Set(s);
        if (on) n.delete(index);
        else n.add(index);
        return n;
      });
    }
  }

  // Nunca generados → invitación.
  if (outfits === null) {
    return (
      <>
        {pending ? <GeneratingScreen phrases={PHRASES} /> : null}
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">¿Y qué armo con esto?</span>
            <span className="text-sm text-muted">
              Te muestro los looks que salen de las prendas que ya tienes de tu cápsula.
            </span>
          </div>
          {error ? (
            <p className="text-sm text-error">No pude armar tus looks — inténtalo otra vez.</p>
          ) : null}
          <button
            type="button"
            onClick={() => generate(false)}
            className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Ver mis looks
          </button>
        </div>
      </>
    );
  }

  // Generados pero ninguno armable (poca base cubierta).
  if (outfits.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <span className="text-sm text-muted">
          Con lo que ya tienes de tu cápsula todavía no alcanza para un look completo.
          Completa tu base en &quot;Tu cápsula&quot; y vuelve.
        </span>
        <button
          type="button"
          onClick={() => generate(false)}
          className="flex min-h-11 items-center justify-center rounded-sm border border-line bg-bg px-4 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  // Ocasiones que su vida pide pero que ningún look cubrió (no se omiten calladas).
  const cubiertas = new Set(outfits.map((o) => o.ocasion));
  const sinCubrir = ocasiones.filter((o) => !cubiertas.has(o));

  return (
    <div className="flex flex-col gap-4">
      {pending && !appending ? <GeneratingScreen phrases={PHRASES} /> : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {outfits.length} {outfits.length === 1 ? "look" : "looks"} con tu cápsula
        </span>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={pending}
            className="flex items-center gap-1 rounded-sm border border-accent bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
          >
            <Icon name="mas" size={13} strokeWidth={2} /> generar más
          </button>
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={pending}
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

      {stale ? (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent-soft p-3">
          <span className="text-sm text-ink">
            Cambiaste tu clóset — estos looks pueden estar viejos.
          </span>
          <button
            type="button"
            onClick={() => generate(false)}
            className="flex min-h-10 w-fit items-center justify-center rounded-sm bg-accent px-3 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Actualizar mis looks
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-error">No pude armar otros looks — inténtalo otra vez.</p>
      ) : null}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        {outfits.map((o, i) => (
          <LookCard
            key={`${o.titulo}-${i}`}
            look={o}
            voto={votos[i] ?? null}
            favorito={favs.has(i)}
            onVote={(up) => votar(i, up)}
            onDownReason={(r) => void saveCapsuleLookDownReason(i, r)}
            onFavorite={(on) => void toggleFav(i, on)}
            onRenderPrenda={renderPrenda}
            rendered={rendered}
            rendering={rendering}
            tryonImage={o.tryonImage}
            ensureOutfitId={async () => {
              const res = await ensureCapsuleLookOutfit(i);
              return res.outfitId ?? null;
            }}
            returnTo="/closet/capsula?tab=looks"
          />
        ))}
      </div>

      {sinCubrir.length > 0 ? (
        <p className="text-sm text-muted">
          Todavía no armo look para{" "}
          <span className="text-ink">
            {sinCubrir.map((o) => (OCC_LABEL.get(o) ?? o).toLowerCase()).join(", ")}
          </span>{" "}
          — te falta algo para eso. Revisa lo que te falta en &quot;la cápsula&quot;.
        </p>
      ) : null}
    </div>
  );
}
