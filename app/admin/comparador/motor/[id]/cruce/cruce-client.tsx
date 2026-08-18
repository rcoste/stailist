"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { CajaCruce, LookCruzado, ResumenCruce } from "@/lib/comparador/cruce";
import type { PrendaUI } from "@/lib/comparador/motor-servidor";
import { calificarJuez } from "../../../motor-actions";

// CALIFICAR AL JUEZ, look por look, con el look a la vista.
//
// La diferencia con la pantalla de votar: ahí juzgas el OUTFIT, aquí juzgas el
// HALLAZGO. Roberto: "estoy viendo que muchos sí le pegó el juez, pero me
// gustaría poner yo ahí comentarios para que sea más fácil que lo proceses".
//
// Se guarda al tocar, sin botón de guardar: la sesión son ~20 tarjetas y un
// "guardar" al final es exactamente donde se pierde el trabajo (ya pasó en la
// ficha de prenda, ver TODOS.md). La nota se manda al salir del campo.

function Chip({ children, tono = "gris" }: { children: React.ReactNode; tono?: "gris" | "rojo" | "ink" }) {
  const clases =
    tono === "rojo"
      ? "border-error text-error"
      : tono === "ink"
        ? "border-ink text-ink"
        : "border-line text-muted";
  return (
    <span className={`shrink-0 rounded-sm border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${clases}`}>
      {children}
    </span>
  );
}

function Tarjeta({
  look,
  prendas,
  etiqueta,
}: {
  look: LookCruzado;
  prendas: Record<string, PrendaUI>;
  etiqueta: string;
}) {
  const [v, setV] = useState(look.veredicto?.v ?? null);
  const [nota, setNota] = useState(look.veredicto?.nota ?? "");
  const [guardando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const guardar = (
    siguienteV: "acuerdo" | "exagero" | null,
    siguienteNota: string
  ) =>
    empezar(async () => {
      const r = await calificarJuez(
        look.parId,
        look.variante,
        look.indice,
        siguienteV,
        siguienteNota
      );
      setError(r.ok ? null : (r.error ?? "no se guardó"));
    });

  const tocar = (opcion: "acuerdo" | "exagero") => {
    const siguiente = v === opcion ? null : opcion;
    setV(siguiente);
    guardar(siguiente, nota);
  };

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight text-ink">{look.nombre}</h3>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
          par {look.parN} · {etiqueta}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {look.itemIds.map((id) => {
          const p = prendas[id];
          return (
            <span
              key={id}
              title={p?.nombre}
              className="relative block h-14 w-14 overflow-hidden rounded-sm border border-line bg-tile"
            >
              {p?.imagen ? (
                <Image src={p.imagen} alt={p.nombre} fill sizes="56px" className="object-cover" />
              ) : (
                <span className="absolute inset-0" style={{ backgroundColor: p?.swatch }} aria-hidden />
              )}
            </span>
          );
        })}
      </div>

      {/* Las dos lecturas, sin promediar: si discrepan, esa discrepancia ES el
          dato. Promediarlas sería justo lo que esconde el hallazgo. */}
      <div className="flex gap-3 text-xs">
        <div className="flex min-w-0 flex-1 flex-col gap-1 border-r border-line pr-3">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            tú {look.humano.marca === "abajo" ? "👎" : look.humano.marca === "arriba" ? "👍" : ""}
          </span>
          {look.humano.defectos.length ? (
            <span className="flex flex-wrap gap-1">
              {look.humano.defectos.map((d) => (
                <Chip key={d} tono="ink">{d}</Chip>
              ))}
            </span>
          ) : null}
          {look.humano.comentario ? (
            <p className="text-ink">“{look.humano.comentario}”</p>
          ) : !look.humano.defectos.length ? (
            <p className="italic text-muted">sin peros</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">el juez</span>
          {look.juez.hallazgos.length ? (
            <>
              <span className="flex flex-wrap gap-1">
                {look.juez.defectos.map((d) => (
                  <Chip key={d} tono={look.juez.rompe > 0 ? "rojo" : "gris"}>{d}</Chip>
                ))}
              </span>
              {look.juez.hallazgos.slice(0, 2).map((h, i) => (
                <p key={i} className="text-ink">
                  <span className="font-medium">{h.pieza}:</span> {h.problema}
                </p>
              ))}
            </>
          ) : (
            <p className="italic text-muted">no marcó nada</p>
          )}
        </div>
      </div>

      {/* El control sólo aparece si hay hallazgo que calificar: sin él no hay
          juez que medir, y un control muerto invita a llenarlo por llenar. */}
      {look.juez.hallazgos.length ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted">el juez…</span>
            <button
              type="button"
              onClick={() => tocar("acuerdo")}
              className={`rounded-sm border px-2 py-0.5 text-xs font-semibold transition-colors ${
                v === "acuerdo" ? "border-ink bg-ink text-bg" : "border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              tiene razón
            </button>
            <button
              type="button"
              onClick={() => tocar("exagero")}
              className={`rounded-sm border px-2 py-0.5 text-xs font-semibold transition-colors ${
                v === "exagero" ? "border-error bg-error text-on-accent" : "border-line text-muted hover:border-error hover:text-error"
              }`}
            >
              se pasó
            </button>
            {guardando ? <span className="text-[10px] text-muted">guardando…</span> : null}
            {error ? <span className="text-[10px] text-error">{error}</span> : null}
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => {
              if ((look.veredicto?.nota ?? "") !== nota.trim()) guardar(v, nota);
            }}
            rows={2}
            placeholder="por qué (opcional) — esto es lo que leo yo"
            className="w-full resize-y rounded-sm border border-line bg-bg px-2 py-1 text-xs text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
        </div>
      ) : null}
    </article>
  );
}

const CAJAS: { clave: CajaCruce; titulo: string; sub: string }[] = [
  {
    clave: "soloJuez",
    titulo: "Sólo el juez lo vio",
    sub: "Los aprobaste sin peros. Aquí se decide si el juez es útil o pedante — y eso sólo lo dices tú. Es la caja que hay que calificar.",
  },
  {
    clave: "coinciden",
    titulo: "Coincidieron",
    sub: "Los dos marcaron el mismo look. Es donde el juez ya está haciendo tu trabajo.",
  },
  {
    clave: "soloHumano",
    titulo: "Sólo tú lo viste",
    sub: "El punto ciego del juez: lo marcaste y él no dijo nada. Si esta caja se queda en cero varias rondas, el juez se ganó correr sin ti.",
  },
  { clave: "limpios", titulo: "Los dos limpios", sub: "Ni tú ni el juez tuvieron nada que decir." },
];

export function CruceClient({
  resumen,
  prendas,
  etiquetas,
}: {
  resumen: ResumenCruce;
  prendas: Record<string, PrendaUI>;
  etiquetas: Record<string, string>;
}) {
  const { conteo } = resumen;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CAJAS.map((c) => (
          <a
            key={c.clave}
            href={`#${c.clave}`}
            className="flex flex-col rounded-lg border border-line bg-surface px-3 py-2"
          >
            <span className="text-h2 font-semibold tabular-nums text-ink">{conteo[c.clave]}</span>
            <span className="text-[11px] leading-tight text-muted">{c.titulo}</span>
          </a>
        ))}
      </div>

      {/* El avance se mide SOLO sobre lo que el juez marcó (ver cruce.ts). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
        <span className="font-semibold text-ink">
          calificados {resumen.calificados} de {resumen.calificados + resumen.porCalificar}
        </span>
        <span className="text-muted">
          le diste la razón <b className="tabular-nums text-ink">{resumen.acuerdo}</b> ·
          dijiste que se pasó <b className="tabular-nums text-ink">{resumen.exagero}</b>
        </span>
      </div>

      {CAJAS.map((c) => {
        const looks = resumen.looks.filter((l) => l.caja === c.clave);
        return (
          <section key={c.clave} id={c.clave} className="flex flex-col gap-3 scroll-mt-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-ink">
                {c.titulo} <span className="font-normal text-muted">{looks.length}</span>
              </h2>
              <p className="max-w-[70ch] text-xs text-muted">{c.sub}</p>
            </div>
            {looks.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {looks.map((l) => (
                  <Tarjeta
                    key={`${l.parId}-${l.variante}-${l.indice}`}
                    look={l}
                    prendas={prendas}
                    etiqueta={etiquetas[l.variante] ?? l.variante}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs italic text-muted">
                ninguno.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
