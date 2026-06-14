"use client";

import { useState } from "react";
import Link from "next/link";
import { SEASONS, seasonPalette, type Season } from "@/lib/colorimetria";
import { updateColorimetria } from "@/app/onboarding/colorimetria/actions";

const ALL: Season[] = ["primavera", "verano", "otono", "invierno"];

function Swatches({ items }: { items: { nombre: string; hex: string }[] }) {
  return (
    <div className="flex gap-2">
      {items.map((c) => (
        <div key={c.nombre} className="flex flex-1 flex-col gap-1">
          <span
            className="h-12 rounded-lg border border-line"
            style={{ backgroundColor: c.hex }}
            title={c.nombre}
          />
          <span className="text-center text-xs text-muted">{c.nombre}</span>
        </div>
      ))}
    </div>
  );
}

// Reveal de colorimetría: lo comparten el quiz y la selfie. Muestra la paleta
// como tres listas accionables (mejores / prestados del flow / evita) y deja
// CAMBIAR la estación — porque ningún análisis automático es a prueba de balas
// y la usuaria es la autoridad final. `nota` opcional bajo la paleta.
export function SeasonReveal({
  season,
  flow = null,
  nota,
}: {
  season: Season;
  flow?: Season | null;
  nota?: string;
}) {
  const [base, setBase] = useState<Season>(season);
  const [flw, setFlw] = useState<Season | null>(flow);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { mejores, prestados, evita } = seasonPalette(base, flw);
  const sBase = SEASONS[base];
  const sFlow = flw ? SEASONS[flw] : null;

  async function pick(next: Season) {
    if (next === base && !flw) {
      setEditing(false);
      return;
    }
    setBase(next);
    setFlw(null); // editar = afirmar una estación definida
    setEditing(false);
    setSaving(true);
    await updateColorimetria(next, null);
    setSaving(false);
  }

  const headline = sFlow
    ? `Estás entre ${sBase.label} y ${sFlow.label} — y eso juega a tu favor.`
    : sBase.reveal;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 font-semibold text-ink">{headline}</h2>
        <p className="text-sm text-muted">
          {sFlow
            ? `Tu base es ${sBase.label}, pero te van también los tonos profundos de ${sFlow.label}. El stylist usa toda tu paleta.`
            : `Tu paleta es tipo ${sBase.label}. El stylist la usa para que cada look te favorezca.`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          ⭐ Tus mejores
        </span>
        <Swatches items={mejores} />
      </div>

      {prestados.length > 0 && sFlow && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            ✅ También te van · de {sFlow.label}
          </span>
          <Swatches items={prestados} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          🚫 Mejor sáltate estos · te apagan
        </span>
        <Swatches items={evita} />
      </div>

      {nota ? <p className="text-center text-xs text-muted">{nota}</p> : null}

      {editing ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">¿Cuál te suena más como tú?</span>
          <div className="flex flex-wrap gap-2">
            {ALL.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pick(s)}
                disabled={saving}
                className={`min-h-10 rounded-full border px-4 text-sm capitalize transition-colors duration-200 disabled:opacity-60 ${
                  s === base
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
          className="text-center text-xs text-muted underline"
        >
          Esta no es mi paleta · ajustar
        </button>
      )}

      <Link
        href="/onboarding/closet"
        className="flex min-h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        Vamos con tu clóset
      </Link>
    </div>
  );
}
