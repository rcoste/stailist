"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  seasonPalette,
  seasonMetal,
  seasonDisplayLabel,
  seasonNeighbors,
  METAL_HEX,
  type Season,
} from "@/lib/colorimetria";
import { updateColorimetria } from "@/app/onboarding/colorimetria/actions";

const DISPLAY: Record<Season, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};

const ORDEN: Season[] = ["primavera", "verano", "otono", "invierno"];

function Swatches({ items }: { items: { nombre: string; hex: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
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

// Segmento "Colorimetría" del ADN de estilo (pestaña Estilo): tu estación + metal
// + tus mejores colores, editable in-place (updateColorimetria, sin tocar el
// onboarding). Render sin card propia — vive dentro de la card del ADN, separado
// por hairlines. Cambiar la estación afecta los outfits futuros.
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
  // Edición en dos pasos: primero la estación, luego (opcional) hacia qué vecina
  // se inclina — así editar a mano NO borra la sub-estación.
  const [editStep, setEditStep] = useState<"season" | "flow">("season");
  const [draftSeason, setDraftSeason] = useState<Season | null>(null);

  function startEdit() {
    setDraftSeason(current);
    setEditStep("season");
    setEditing(true);
  }

  function pickSeason(s: Season) {
    setDraftSeason(s);
    setEditStep("flow");
  }

  function pickFlow(f: Season | null) {
    const s = draftSeason as Season;
    setCurrent(s);
    setCurFlow(f);
    setEditing(false);
    startTransition(async () => {
      await updateColorimetria(s, f);
      router.refresh();
    });
  }

  const palette = current ? seasonPalette(current, curFlow) : null;
  const metal = current ? seasonMetal(current, curFlow) : null;

  // Sub-estaciones seleccionables del borrador: la pura + sus dos vecinas, cada
  // una con su nombre real ("Invierno profundo") — no el genérico de la vecina.
  const flowOptions = draftSeason
    ? [
        { flow: null as Season | null, label: seasonDisplayLabel(draftSeason, null) },
        ...seasonNeighbors(draftSeason).map((n) => ({
          flow: n as Season | null,
          label: seasonDisplayLabel(draftSeason, n),
        })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Colorimetría
        </span>
        {metal ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-sm border border-line bg-bg px-2.5 py-1 text-xs text-muted">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: METAL_HEX[metal] }}
            />
            {metal === "oro" ? "Oro" : "Plata"}
          </span>
        ) : null}
      </div>

      {current && palette ? (
        <>
          <span className="editorial text-h3 leading-tight text-ink">
            {seasonDisplayLabel(current, curFlow)}
          </span>
          {palette.mejores.length > 0 ? <Swatches items={palette.mejores} /> : null}
          <Link
            href="/cartera"
            className="flex min-h-10 items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
          >
            <Icon name="destello" size={16} /> abrir mi cartera de colores
          </Link>
        </>
      ) : (
        <span className="text-sm text-muted">Aún no tienes colorimetría definida.</span>
      )}

      {editing ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {editStep === "season" ? (
            <>
              <span className="text-xs text-muted">¿Cuál te suena más?</span>
              <div className="grid grid-cols-2 gap-2">
                {ORDEN.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSeason(s)}
                    disabled={pending}
                    className={`min-h-10 rounded-sm border text-sm font-medium transition-colors duration-200 disabled:opacity-60 ${
                      s === draftSeason
                        ? "border-accent bg-accent-soft text-ink ring-1 ring-inset ring-accent"
                        : "border-line bg-surface text-ink hover:border-ink"
                    }`}
                  >
                    {DISPLAY[s]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-muted">Afina tu tono (opcional)</span>
              <div className="flex flex-col gap-2">
                {flowOptions.map((o) => {
                  const active = draftSeason === current && o.flow === curFlow;
                  return (
                    <button
                      key={o.flow ?? "pura"}
                      type="button"
                      onClick={() => pickFlow(o.flow)}
                      disabled={pending}
                      className={`min-h-10 rounded-sm border text-sm font-medium transition-colors duration-200 disabled:opacity-60 ${
                        active
                          ? "border-accent bg-accent-soft text-ink ring-1 ring-inset ring-accent"
                          : "border-line bg-surface text-ink hover:border-ink"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setEditStep("season")}
                className="self-start text-xs font-medium text-muted hover:text-ink"
              >
                ← Cambiar estación
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="self-start text-xs font-medium text-accent underline underline-offset-2"
        >
          ¿no te suena? ajústala
        </button>
      )}
    </div>
  );
}
