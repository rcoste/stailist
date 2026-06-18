"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SEASONS,
  seasonPalette,
  seasonMetal,
  type Season,
} from "@/lib/colorimetria";
import { updateColorimetria } from "@/app/onboarding/colorimetria/actions";

const ORDEN: Season[] = ["primavera", "verano", "otono", "invierno"];

function Swatches({ items }: { items: { nombre: string; hex: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <span
          key={c.hex + c.nombre}
          title={c.nombre}
          aria-label={c.nombre}
          className="h-7 w-7 rounded-full border border-line"
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

// Sección de colorimetría del Perfil: tu estación con su copy cálido, tu paleta
// COMPLETA (mejores · complementarios prestados de tu frontera · lo que evitas) y
// tu metal (oro/plata). Se puede corregir la estación directo (updateColorimetria,
// sin tocar el onboarding). Cambiarla afecta los outfits futuros.
export function ColorimetriaSection({
  season,
  flow,
}: {
  season: Season | null;
  flow: Season | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<Season | null>(season);
  const [curFlow, setCurFlow] = useState<Season | null>(flow);
  const [pending, startTransition] = useTransition();

  function pick(s: Season) {
    setCurrent(s);
    setCurFlow(null); // declarar la estación a mano = caso claro, sin frontera
    setEditing(false);
    startTransition(async () => {
      await updateColorimetria(s, null);
      router.refresh();
    });
  }

  const data = current ? SEASONS[current] : null;
  const palette = current ? seasonPalette(current, curFlow) : null;
  const metal = current ? seasonMetal(current, curFlow) : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        Tu colorimetría
      </span>
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
        {data && palette ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="editorial text-xl capitalize text-ink">{data.label}</span>
                <span className="text-xs text-muted">{data.reveal}</span>
              </div>
              {metal ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 py-1 text-xs text-muted">
                  <span
                    className="h-3 w-3 rounded-full border border-line"
                    style={{ backgroundColor: metal === "oro" ? "#C8973D" : "#C2C2CC" }}
                  />
                  {metal === "oro" ? "Oro" : "Plata"}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink">Tus mejores colores</span>
              <Swatches items={palette.mejores} />
            </div>

            {palette.prestados.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink">También te funcionan</span>
                {curFlow ? (
                  <span className="text-[11px] text-muted">
                    Prestados de tu frontera con {SEASONS[curFlow].label}.
                  </span>
                ) : null}
                <Swatches items={palette.prestados} />
              </div>
            ) : null}

            {palette.evita.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink">Mejor evita</span>
                <Swatches items={palette.evita} />
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-sm text-muted">Aún no tienes colorimetría definida.</span>
        )}

        {editing ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">¿Cuál te suena más?</span>
            <div className="grid grid-cols-2 gap-2">
              {ORDEN.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pick(s)}
                  disabled={pending}
                  className={`min-h-10 rounded-sm border text-sm font-medium capitalize transition-colors duration-200 disabled:opacity-60 ${
                    s === current
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {SEASONS[s].label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start text-xs font-medium text-accent underline underline-offset-2"
          >
            ¿No te suena? Ajústala
          </button>
        )}
      </div>
    </div>
  );
}
