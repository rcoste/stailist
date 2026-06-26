"use client";

import { useState } from "react";
import Link from "next/link";
import { SEASONS, seasonPalette, seasonDisplayLabel, type Season } from "@/lib/colorimetria";
import { updateColorimetria } from "@/app/onboarding/colorimetria/actions";
import { Icon } from "@/components/icon";

const ALL: Season[] = ["primavera", "verano", "otono", "invierno"];
const DISPLAY: Record<Season, string> = {
  primavera: "Primavera",
  verano: "Verano",
  otono: "Otoño",
  invierno: "Invierno",
};
// Calidez → metal: paletas cálidas van con oro, frías con plata.
const isWarm = (s: Season) => s === "primavera" || s === "otono";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted">
      {children}
    </span>
  );
}

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
            className="relative block h-[50px] overflow-hidden rounded-[4px] border border-line"
            style={{ backgroundColor: c.hex }}
            title={c.nombre}
          >
            {avoid ? (
              <span className="absolute left-[-8%] top-1/2 w-[116%] -rotate-[20deg] border-t-2 border-ink/50" />
            ) : null}
          </span>
          <span className="text-center text-[9px] text-muted">{c.nombre}</span>
        </div>
      ))}
    </div>
  );
}

// Reveal de colorimetría v3: la paleta del usuario va a TODO COLOR sobre chrome
// monocromo (es la única función literalmente sobre color). Dos estaciones:
// base + prestada. Metal como selector de placas diagonales. Deja editar la
// estación — la usuaria es la autoridad final.
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
  const metalVa: "oro" | "plata" = isWarm(base) ? "oro" : "plata";

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

  // Nombre: "otoño profundo" con la última palabra en serif itálica.
  const label = seasonDisplayLabel(base, flw);
  const words = label.trim().split(" ");
  const last = words.length > 1 ? words.pop() : null;
  const head = words.join(" ");

  const phrase = sFlow
    ? `Estás entre ${DISPLAY[base]} y ${DISPLAY[flw!]} — y eso juega a tu favor: el stylist usa toda tu paleta.`
    : sBase.reveal;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Label>tu estación</Label>
        <h2 className="text-[36px] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
          {head.toLowerCase()}
          {last ? (
            <>
              {" "}
              <em className="font-display font-normal italic tracking-normal">
                {last.toLowerCase()}
              </em>
            </>
          ) : null}
          {sFlow ? (
            <span className="mt-1 block font-display text-[21px] italic text-muted">
              con guiños de {DISPLAY[flw!].toLowerCase()}
            </span>
          ) : null}
        </h2>
        <p className="editorial mt-2 text-[16px] leading-snug text-ink">{phrase}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label>tu paleta</Label>
        <Swatches items={mejores} />
      </div>

      {prestados.length > 0 && sFlow ? (
        <div className="flex flex-col gap-2.5">
          <Label>
            te prestan{" "}
            <span className="font-medium normal-case tracking-normal text-muted">
              · de {DISPLAY[flw!].toLowerCase()}
            </span>
          </Label>
          <div className="flex items-end gap-2">
            {prestados.slice(0, 3).map((c) => (
              <div key={c.nombre} className="flex w-[58px] flex-col gap-1">
                <span
                  className="block h-[42px] overflow-hidden rounded-[4px] border border-line"
                  style={{ backgroundColor: c.hex }}
                  title={c.nombre}
                />
                <span className="text-center text-[9px] text-muted">{c.nombre}</span>
              </div>
            ))}
            <span className="editorial pb-3 text-[13px] italic text-muted">
              úsalos como acento
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <Label>mejor evita</Label>
        <Swatches items={evita} avoid />
      </div>

      <div className="flex items-center gap-3">
        <Label>tu metal</Label>
        <div className="flex gap-2">
          {(["oro", "plata"] as const).map((m) => {
            const on = m === metalVa;
            return (
              <span
                key={m}
                className={`inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[13px] font-semibold ${
                  on ? "border-ink text-ink" : "border-line text-muted opacity-50"
                }`}
              >
                <span
                  className="block h-[14px] w-[22px] rounded-[2px]"
                  style={{
                    background: m === "oro" ? "var(--metal-oro)" : "var(--metal-plata)",
                    boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
                  }}
                />
                {m === "oro" ? "oro" : "plata"}
              </span>
            );
          })}
        </div>
      </div>

      {nota ? <p className="text-center text-xs text-muted">{nota}</p> : null}

      <div className="mt-1 flex flex-col gap-3">
        <Link
          href="/onboarding/closet"
          className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          guardar mi paleta <Icon name="flecha" size={19} />
        </Link>

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
                      ? "border-ink text-ink"
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
            className="inline-flex items-center justify-center gap-1.5 self-center text-[13px] font-semibold text-muted underline underline-offset-[3px]"
          >
            <Icon name="lapiz" size={14} /> esta no es mi colorimetría
          </button>
        )}
      </div>
    </div>
  );
}
