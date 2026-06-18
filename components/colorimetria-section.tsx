"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SEASONS, type Season } from "@/lib/colorimetria";
import { updateColorimetria } from "@/app/onboarding/colorimetria/actions";

const ORDEN: Season[] = ["primavera", "verano", "otono", "invierno"];

// Sección de colorimetría del Perfil: muestra tu estación con su copy cálido y su
// paleta, y deja CORREGIRLA directo (selector de 4 estaciones → updateColorimetria,
// que actualiza la paleta sin tocar el onboarding). Optimista. Cambiarla afecta
// los outfits que se generen de aquí en adelante.
export function ColorimetriaSection({ season }: { season: Season | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<Season | null>(season);
  const [pending, startTransition] = useTransition();

  function pick(s: Season) {
    setCurrent(s); // optimista
    setEditing(false);
    startTransition(async () => {
      await updateColorimetria(s, null);
      router.refresh();
    });
  }

  const data = current ? SEASONS[current] : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        Tu colorimetría
      </span>
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        {data ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="editorial text-xl capitalize text-ink">{data.label}</span>
              <span className="text-xs text-muted">{data.reveal}</span>
            </div>
            <div className="flex gap-2">
              {data.colores.map((c) => (
                <span
                  key={c.hex}
                  title={c.nombre}
                  aria-label={c.nombre}
                  className="h-7 w-7 rounded-full border border-line"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </>
        ) : (
          <span className="text-sm text-muted">Aún no tienes colorimetría definida.</span>
        )}

        {editing ? (
          <div className="flex flex-col gap-2">
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
