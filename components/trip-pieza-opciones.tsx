"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Spinner } from "@/components/spinner";
import {
  COLORES_VARIANTE,
  cambiarColor,
  cambiarMetal,
  colorDeNombre,
  metalDeNombre,
  tieneHerraje,
  type ColorVariante,
  type Metal,
} from "@/lib/variante-pieza";
import type { VariantePieza } from "@/lib/trip-actions";

// LAS SALIDAS DE UNA PIEZA QUE FALTA EN LA MALETA (bloque B, 2026-10-14;
// boceto aprobado por Roberto: "luz verde").
//
// "Ya lo tengo" y "wishlist" siguen a la vista; lo demás vive tras "···":
// Roberto, sobre la primera versión: "'ya lo tengo' va a haber gente que diga
// 'no, no es cierto, no lo tengo'". Las cuatro salidas cubren lo que una usuaria real
// necesitó armando una maleta real y no tenía cómo decir.

export type OpcionPieza = "parecido" | "elegir" | "fuera" | "cambiar";

const OPCIONES: { id: OpcionPieza; titulo: string; sub: (cosa: string) => string }[] = [
  { id: "parecido", titulo: "tengo uno parecido", sub: () => "me dices qué tiene distinto el tuyo, o le tomas foto" },
  { id: "elegir", titulo: "lo elijo de mi clóset", sub: (cosa) => `escoges tú entre tus ${cosa}` },
  { id: "fuera", titulo: "no lo necesito en este viaje", sub: () => "lo quito de la maleta" },
  { id: "cambiar", titulo: "no me gusta esta pieza", sub: () => "me dices por qué y te propongo otra" },
];

/** "tus cinturones", "tus abrigos"… sale de la categoría: el nombre es libre. */
const PLURAL_CATEGORIA: Record<string, string> = {
  top: "tops",
  saco: "sacos",
  bottom: "pantalones y faldas",
  abrigo: "abrigos",
  vestido: "vestidos",
  calzado: "zapatos",
  accesorio: "accesorios",
};

export function MasOpcionesSheet({
  open,
  onClose,
  nombre,
  categoria,
  onElegir,
}: {
  open: boolean;
  onClose: () => void;
  nombre: string;
  categoria: string;
  onElegir: (o: OpcionPieza) => void;
}) {
  const cosa = PLURAL_CATEGORIA[categoria] ?? "prendas";
  return (
    <Sheet open={open} onClose={onClose}>
      <h3 className="display text-[23px] font-normal italic leading-[27px] text-ink">{nombre.toLowerCase()}</h3>
      <ul className="mt-3 flex flex-col pb-1">
        {OPCIONES.map((o) => (
          <li key={o.id} className="border-t border-line2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onElegir(o.id);
              }}
              className="flex min-h-14 w-full flex-col justify-center py-2.5 text-left transition-colors hover:bg-tile"
            >
              <b className="text-[14px] font-bold text-ink">{o.titulo}</b>
              <span className="text-[12px] text-muted">{o.sub(cosa)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * "¿Cómo es el tuyo?": la pieza sugerida, ya escrita, para cambiar sólo lo que
 * es distinto. El nombre manda (es lo que leen el motor y el dibujo); los chips
 * son atajos que lo reescriben. El material no cambia el nombre: va aparte.
 */
export function ParecidoSheet({
  open,
  onClose,
  sugerida,
  busy,
  onGuardar,
  onFoto,
}: {
  open: boolean;
  onClose: () => void;
  sugerida: { nombre: string; color: string };
  busy: boolean;
  onGuardar: (v: VariantePieza) => void;
  onFoto: () => void;
}) {
  const [nombre, setNombre] = useState(sugerida.nombre);
  const [color, setColor] = useState<ColorVariante | null>(null);
  const [material, setMaterial] = useState<string | null>(null);
  const metal = metalDeNombre(nombre);
  const conHerraje = tieneHerraje(sugerida.nombre);
  const hayColor = colorDeNombre(sugerida.nombre) !== null;
  const cambio = nombre.trim() !== sugerida.nombre.trim() || material !== null;

  const chip = (activo: boolean) =>
    `flex min-h-10 items-center border px-3 text-[12.5px] font-semibold transition-colors ${
      activo ? "border-ink bg-ink text-on-accent" : "border-line bg-surface text-ink2 hover:border-ink"
    }`;
  const rotulo = "mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted";

  return (
    <Sheet open={open} onClose={onClose}>
      <h3 className="display text-[23px] font-normal italic leading-[27px] text-ink">¿cómo es el tuyo?</h3>
      <p className="mt-[5px] text-[12.5px] leading-[18px] text-muted">cambia sólo lo que es distinto.</p>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={120}
        aria-label="cómo se llama el tuyo"
        className="mt-3 w-full border border-ink bg-surface px-3 py-2.5 text-[14px] text-ink focus:outline-none"
      />

      {hayColor ? (
        <>
          <div className={rotulo}>color</div>
          <div className="flex flex-wrap gap-1.5">
            {COLORES_VARIANTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setNombre((n) => cambiarColor(n, c));
                }}
                className={chip(color === c)}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {conHerraje ? (
        <>
          <div className={rotulo}>herraje</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["dorado", "dorado"],
                ["plateado", "plateado"],
                ["sin", "sin herraje"],
              ] as [Metal, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setNombre((n) => cambiarMetal(n, m))}
                className={chip(m === "sin" ? metal === null && nombre !== sugerida.nombre : metal === m)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className={rotulo}>material</div>
      <div className="flex flex-wrap gap-1.5">
        {["piel", "tela", "lana", "sintético"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMaterial((x) => (x === m ? null : m))}
            className={chip(material === m)}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || !nombre.trim()}
        onClick={() =>
          onGuardar({
            nombre: nombre.trim(),
            color: color ?? sugerida.color,
            material,
          })
        }
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-[14px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {busy ? <Spinner className="h-4 w-4" /> : null}
        {busy ? "guardando…" : cambio ? "guardar en mi clóset" : "es igual — guardar en mi clóset"}
      </button>
      <button
        type="button"
        onClick={() => {
          onClose();
          onFoto();
        }}
        className="mt-1 flex min-h-11 w-full items-center justify-center text-[13px] font-semibold text-ink2 underline underline-offset-2"
      >
        mejor le tomo foto
      </button>
      <p className="pb-1 text-center text-[11.5px] leading-4 text-muted">
        se guarda como tuyo y cubre este lugar de la maleta.
      </p>
    </Sheet>
  );
}
