"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SEASONS,
  seasonPalette,
  seasonDisplayLabel,
  seasonNeighbors,
  metalForSeason,
  type Season,
} from "@/lib/colorimetria";
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
  // Edición en dos pasos: estación → sub-estación (opcional), como en el perfil.
  const [editStep, setEditStep] = useState<"season" | "flow">("season");
  const [draft, setDraft] = useState<Season>(season);

  const { mejores, prestados, evita } = seasonPalette(base, flw);
  const sBase = SEASONS[base];
  const sFlow = flw ? SEASONS[flw] : null;
  // Considera base Y flow: en la frontera cálido↔frío devuelve "ambos" (los dos
  // metales le van) — antes usaba solo la base e ignoraba el guiño (bug: a la
  // persona invierno-con-otoño le salía plata cuando el oro también le va).
  const metalVa = metalForSeason(base, flw);

  function startEdit() {
    setDraft(base);
    setEditStep("season");
    setEditing(true);
  }

  function pickSeason(s: Season) {
    setDraft(s);
    setEditStep("flow");
  }

  async function pickFlow(f: Season | null) {
    setBase(draft);
    setFlw(f);
    setEditing(false);
    setSaving(true);
    await updateColorimetria(draft, f);
    setSaving(false);
  }

  // Sub-estaciones del borrador: la pura + sus dos vecinas, con su nombre real.
  const flowOptions = [
    { flow: null as Season | null, label: seasonDisplayLabel(draft, null) },
    ...seasonNeighbors(draft).map((n) => ({
      flow: n as Season | null,
      label: seasonDisplayLabel(draft, n),
    })),
  ];

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
            // En la frontera ("ambos") los DOS metales quedan encendidos.
            const on = metalVa === "ambos" || m === metalVa;
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
        {metalVa === "ambos" ? (
          <span className="editorial text-xs text-muted">los dos te van</span>
        ) : null}
      </div>

      {nota ? <p className="text-center text-xs text-muted">{nota}</p> : null}

      <div className="mt-1 flex flex-col gap-3">
        <Link
          href="/onboarding/acentos"
          className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          guardar mi paleta <Icon name="flecha" size={19} />
        </Link>

        {editing ? (
          editStep === "season" ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">¿Cuál te suena más como tú?</span>
              <div className="flex flex-wrap gap-2">
                {ALL.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSeason(s)}
                    disabled={saving}
                    className={`min-h-10 rounded-sm border px-4 text-sm transition-colors duration-200 disabled:opacity-60 ${
                      s === draft
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
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Afina tu tono (opcional)</span>
              <div className="flex flex-wrap gap-2">
                {flowOptions.map((o) => {
                  const active = draft === base && o.flow === flw;
                  return (
                    <button
                      key={o.flow ?? "pura"}
                      type="button"
                      onClick={() => pickFlow(o.flow)}
                      disabled={saving}
                      className={`min-h-10 rounded-sm border px-4 text-sm transition-colors duration-200 disabled:opacity-60 ${
                        active
                          ? "border-ink text-ink"
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
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center justify-center gap-1.5 self-center text-[13px] font-semibold text-muted underline underline-offset-[3px]"
          >
            <Icon name="lapiz" size={14} /> esta no es mi colorimetría
          </button>
        )}
      </div>
    </div>
  );
}
