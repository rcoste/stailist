"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { OCCASIONS } from "@/lib/trip";
import { generateCapsuleOutfits } from "@/app/closet/capsula/looks-actions";

const OCC_LABEL = new Map(OCCASIONS.map((o) => [o.value as string, o.label]));

const PHRASES: GenPhrase[] = [
  { a: "mirando tu ", k: "cápsula", b: "…" },
  { a: "cruzando tus ", k: "prendas", b: "…" },
  { a: "armando ", k: "combinaciones", b: "…" },
];

type Look = {
  ocasion: string;
  titulo: string;
  porque: string;
  tip: string | null;
  prendas: { nombre: string; image: string | null }[];
};

// "Los looks de tu cápsula": el payoff de la métrica "~N looks". Outfits armados
// con lo que YA tienes de tu cápsula (motor del viaje). Generación on-demand,
// cacheada; el loading reusa la pantalla de frases de Hoy/Viaje.
export function CapsuleLooks({ outfits, stale }: { outfits: Look[] | null; stale: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const generate = (append = false) =>
    startTransition(async () => {
      setError(false);
      const res = await generateCapsuleOutfits(append);
      if (!res.ok) setError(true);
      router.refresh();
    });

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

  return (
    <div className="flex flex-col gap-4">
      {pending ? <GeneratingScreen phrases={PHRASES} /> : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {outfits.length} {outfits.length === 1 ? "look" : "looks"} con tu cápsula
        </span>
        <button
          type="button"
          onClick={() => generate(false)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          <Icon name="repetir" size={13} /> Rehacer
        </button>
      </div>

      {stale ? (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent-soft p-3">
          <span className="text-sm text-ink">Cambiaste tu clóset — estos looks pueden estar viejos.</span>
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
          </div>
        ))}
      </div>
    </div>
  );
}
