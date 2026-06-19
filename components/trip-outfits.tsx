"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { OCCASIONS } from "@/lib/trip";

// Un look del viaje ya resuelto contra el clóset (la página servidor mapea cada
// nombre de prenda a su imagen antes de pasarlo).
export type ResolvedOutfit = {
  ocasion: string;
  titulo: string;
  porque: string;
  prendas: { nombre: string; image: string | null }[];
};

const OCC_LABEL = new Map(OCCASIONS.map((o) => [o.value as string, o.label]));

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg text-muted">
      {src ? (
        <Image src={src} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <Icon name="gancho" size={16} />
      )}
    </span>
  );
}

// Sección "Tus looks": los outfits que la maleta hace. Si aún no se generan,
// un botón los pide (POST al endpoint → router.refresh para re-renderear con
// ellos). `outfits === null` = nunca generados; `[]` = generados pero ninguno
// armable con lo que empacas.
export function TripOutfits({
  tripId,
  outfits,
}: {
  tripId: string;
  outfits: ResolvedOutfit[] | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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

  // Hay looks.
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Tus looks · {outfits.length}
        </span>
        <button
          type="button"
          onClick={generar}
          className="text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          Armar otros
        </button>
      </div>

      {error ? (
        <p className="text-sm text-error">No pude armar otros looks — inténtalo otra vez.</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {outfits.map((o, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-col gap-1">
              <span className="w-fit rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent">
                {OCC_LABEL.get(o.ocasion) ?? o.ocasion}
              </span>
              <h3 className="editorial text-lg text-ink">{o.titulo}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {o.prendas.map((p, j) => (
                <span key={j} className="flex flex-col items-center gap-1" title={p.nombre}>
                  <Thumb src={p.image} />
                  <span className="max-w-[4.5rem] truncate text-[11px] text-muted">{p.nombre}</span>
                </span>
              ))}
            </div>
            <p className="text-sm text-muted">{o.porque}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
