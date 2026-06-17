"use client";

import { useState } from "react";
import Link from "next/link";
import { SEASONS, seasonPalette, type Season } from "@/lib/colorimetria";
import { updateColorimetria } from "@/app/onboarding/colorimetria/actions";
import { Icon, type IconName } from "@/components/icon";

const ALL: Season[] = ["primavera", "verano", "otono", "invierno"];
const DISPLAY: Record<Season, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};
// Calidez → metal: paletas cálidas van con oro, frías con plata.
const isWarm = (s: Season) => s === "primavera" || s === "otono";

function Swatches({
  items,
  avoid = false,
}: {
  items: { nombre: string; hex: string }[];
  avoid?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {items.map((c) => (
        <div key={c.nombre} className="flex flex-1 flex-col gap-1">
          <span
            className="relative block h-12 overflow-hidden rounded-sm border border-line"
            style={{ backgroundColor: c.hex }}
            title={c.nombre}
          >
            {avoid ? (
              <span className="absolute left-[-8%] top-1/2 w-[116%] -rotate-[20deg] border-t-2 border-ink/55" />
            ) : null}
          </span>
          <span className="text-center text-xs text-muted">{c.nombre}</span>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
      <Icon name={icon} size={15} /> {children}
    </span>
  );
}

// Chip del metal: el que va (dorado/plata real, acento) o el que apaga (atenuado
// + tachado, bajo los colores a evitar). Color desde var(--metal-*), no hex.
function MetalChip({
  caption,
  metal,
  ok,
}: {
  caption: string;
  metal: "oro" | "plata";
  ok: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {caption}
      </span>
      <span
        className={`inline-flex items-center gap-2 self-start rounded-sm border px-3 py-1.5 text-sm font-medium ${
          ok
            ? "border-accent bg-accent-soft text-ink"
            : "border-line bg-surface text-muted"
        }`}
      >
        <span
          className="relative block h-4 w-4 overflow-hidden rounded-full"
          style={{
            background:
              metal === "oro" ? "var(--metal-oro)" : "var(--metal-plata)",
            opacity: ok ? 1 : 0.75,
          }}
        >
          {!ok ? (
            <span className="absolute left-[-10%] top-1/2 w-[120%] -rotate-[20deg] border-t-2 border-ink/50" />
          ) : null}
        </span>
        <span className={ok ? "" : "line-through decoration-ink/40"}>
          {metal === "oro" ? "Oro" : "Plata"}
        </span>
      </span>
    </div>
  );
}

// Reveal de colorimetría (rebrand v2): estación en Bodoni, metal oro/plata, y
// los colores que apagan tachados. Orden: mejores → metal que va → evita →
// metal que apaga. Deja CAMBIAR la estación — la usuaria es la autoridad final.
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
  const metalVa = isWarm(base) ? "oro" : "plata";
  const metalApaga = isWarm(base) ? "plata" : "oro";

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

  const phrase = sFlow
    ? `Estás entre ${DISPLAY[base]} y ${DISPLAY[flw!]} — y eso juega a tu favor. El stylist usa toda tu paleta.`
    : sBase.reveal;

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Tu estación
        </span>
        <h2 className="text-display font-semibold text-ink">{DISPLAY[base]}</h2>
        <p className="editorial mt-1 text-base text-ink">{phrase}</p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel icon="estrella">Tus mejores</SectionLabel>
        <Swatches items={mejores} />
      </div>

      {prestados.length > 0 && sFlow && (
        <div className="flex flex-col gap-2">
          <SectionLabel icon="check">
            También te van · de {DISPLAY[flw!]}
          </SectionLabel>
          <Swatches items={prestados} />
        </div>
      )}

      <MetalChip caption="Tu metal" metal={metalVa} ok />

      <div className="flex flex-col gap-2">
        <SectionLabel icon="prohibido">
          Mejor sáltate estos · te apagan
        </SectionLabel>
        <Swatches items={evita} avoid />
      </div>

      <MetalChip caption="El metal que te apaga" metal={metalApaga} ok={false} />

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
                className={`min-h-10 rounded-sm border px-4 text-sm transition-colors duration-200 disabled:opacity-60 ${
                  s === base
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                {DISPLAY[s]}
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
        className="flex min-h-12 items-center justify-center rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        Vamos con tu clóset
      </Link>
    </div>
  );
}
