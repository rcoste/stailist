"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { MotivoSheet } from "@/components/motivo-sheet";
import { Spinner } from "@/components/spinner";
import { type VetoReason } from "@/lib/capsule";

// El card de prenda sugerida — cápsula ideal y viaje (handoff
// design_handoff_capsula_card). Antes eran dos cards distintas para el mismo
// trabajo y las dos arrancaban mal:
//
//  · abrían con META-TEXTO ("preferiste la sugerida — sigue en lo que falta")
//    partido en dos renglones; el nombre de la prenda, que es el tema, entraba
//    en tercer lugar;
//  · tenían CUATRO acciones y dos significaban lo mismo ("cambiar" y "esta no me
//    convence — cámbiala");
//  · los dos botones principales pesaban igual, ambos con icono y ambos
//    partiendo su texto en dos líneas.
//
// La estructura separa dos ejes que estaban revueltos:
//  · el PIE son veredictos sobre la prenda (me la quedo / la quiero / no me va);
//  · la acción de ARRIBA no es un veredicto — es otro camino: en cápsula,
//    "cambiar" DESHACE tu decisión entre tu prenda y la sugerida; en viaje,
//    "en mi clóset" busca cubrir el hueco con lo que ya tienes.
//
// OJO con "cambiar" (corrección de Roberto, 2026-07-29): nunca significa
// "búscame otra sugerencia". El primer corte de esta card lo usó así y revolvía
// los dos ejes otra vez. Pedir un reemplazo es una CONSECUENCIA de que la prenda
// no te va, así que vive dentro de "no me va": motivo primero (obligatorio),
// y con el motivo en mano, la resolución — reemplazo o fuera.

export type SuggestionFooterAction = {
  label: string;
  icon: IconName;
  onClick: () => void;
  busy?: boolean;
  /** La primera va en tinta; las demás en gris. Nada aquí es negro relleno: el
   *  negro sólido está reservado a "generar" en toda la app. */
  primary?: boolean;
  /** Estado activo (p. ej. ya está en la wishlist). */
  active?: boolean;
};

export function SuggestionCard({
  eyebrow,
  nombre,
  porque,
  chip,
  foto,
  topAction,
  footer,
  noMeVa,
  resolved,
  busy = false,
  busyLabel,
  error,
  /** Recorta la razón a una línea. Para listas de 6+ sugerencias. */
  razonCompacta = false,
}: {
  /** La categoría del hueco (o lo que vale), NO la razón. Va en versalitas. */
  eyebrow: string;
  nombre: string;
  /** La voz del coach. Opcional: la wishlist no siempre tiene un porqué. */
  porque?: string | null;
  /** Un distintivo bajo el nombre (p. ej. el veredicto de color de la wishlist),
   *  para lo que no cabe en el eyebrow porque lleva color con significado. */
  chip?: React.ReactNode;
  /** El tile de la foto — cada módulo trae el suyo (genera bajo demanda). */
  foto: React.ReactNode;
  /** "cambiar" (deshacer tu decisión) en cápsula, "en mi clóset" en viaje. */
  topAction?: {
    label: string;
    icon: IconName;
    onClick: () => void;
  } | null;
  footer: SuggestionFooterAction[];
  /** "no me va": pide el motivo (obligatorio) y con él en mano, la resolución —
   *  reemplazo o fuera. Los DOS reciben el motivo: el reemplazo lo usa el motor
   *  para no repetir el error; el retiro lo guarda como veto. */
  noMeVa?: {
    /** false cuando ya no se ofrecen más reemplazos (tope de swaps). */
    puedeReemplazar: boolean;
    onReemplazar: (reason: VetoReason) => void;
    onQuitar: (reason: VetoReason) => void;
    /** id de hint que apunta al botón "no me va" (lo busca el coach-mark). */
    hintTarget?: string;
  } | null;
  /** Ya resuelto: el card colapsa a este acuse (sin toast — el card ES el acuse). */
  resolved?: { motivo: string } | null;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  razonCompacta?: boolean;
}) {
  const [preguntando, setPreguntando] = useState(false);
  // Motivo elegido en el paso 1 de la hoja; null = todavía en los chips.
  const [motivo, setMotivo] = useState<VetoReason | null>(null);

  const cerrarHoja = () => {
    setPreguntando(false);
    setMotivo(null);
  };

  // Estado resuelto. El texto va en UN SOLO span junto al icono: partido en
  // nodos sueltos, el gap del flex se mete entre las palabras.
  if (resolved) {
    return (
      <li className="flex items-center gap-2 border border-line bg-surface px-[13px] py-3.5 text-[13px] text-muted">
        <Icon name="equis" size={15} className="shrink-0" />
        <span>
          vale — <b className="font-bold text-ink">{resolved.motivo}</b>. no te la
          vuelvo a sugerir.
        </span>
      </li>
    );
  }

  return (
    <li className="border border-line bg-surface">
      <div className="flex gap-[13px] p-[12px_13px]">
        {/* 4:5 con object-contain sobre el tile: la prenda va recortada contra su
            fondo y volver a recortarla con `cover` la decapita. Si la foto no es
            4:5 sobra tile a los lados, y eso es correcto. */}
        <div className="relative aspect-[4/5] w-[86px] shrink-0 overflow-hidden bg-tile">
          {foto}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            {/* Una línea SIEMPRE: partido en dos empuja el nombre hacia abajo y
                rompe el ritmo del card (y el nombre es el tema). Si el texto no
                cabe, se corta — la señal de que hay que acortar la copy. */}
            <span className="truncate pt-px text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
              {eyebrow}
            </span>
            {topAction ? (
              // 44px de área táctil con márgenes negativos simétricos, para que
              // la zona tocable no cruce el baseline del nombre.
              <button
                type="button"
                onClick={topAction.onClick}
                className="relative -my-[15px] -mr-1.5 ml-auto flex min-h-11 shrink-0 items-center gap-[5px] px-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-ink"
              >
                <Icon name={topAction.icon} size={14} />
                {topAction.label}
              </button>
            ) : null}
          </div>

          {/* El nombre primero: es el tema del card. */}
          <p className="mt-[5px] text-[15.5px] font-bold leading-[19px] tracking-[-0.01em] text-ink">
            {nombre}
          </p>
          {/* La razón en la voz del coach — la misma serif itálica del detalle
              del look y de los hints. `.display` y no `.editorial`: esa fuerza
              font-style:normal fuera de las cascade layers y la serif saldría
              en redonda. */}
          {chip ? <div className="mt-[7px] flex">{chip}</div> : null}
          {porque ? (
            <p
              className={`display mt-[7px] text-[16px] italic leading-5 text-ink2 ${
                razonCompacta ? "line-clamp-1" : ""
              }`}
            >
              {porque}
            </p>
          ) : null}
        </div>
      </div>

      {busy ? (
        <div className="flex min-h-[46px] items-center justify-center gap-2 border-t border-line text-[13px] text-muted">
          <Spinner className="h-3.5 w-3.5" /> {busyLabel ?? "un segundo…"}
        </div>
      ) : footer.length === 0 && !noMeVa ? (
        // Sin salidas no hay pie: el `border-t` sin botones dejaba una raya
        // suelta bajo el contenido. Pasa en el estado "en tu clóset" del card de
        // duelo, donde la decisión ya no tiene veredictos que ofrecer.
        null
      ) : (
        <div className="flex border-t border-line">
          {footer.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.busy}
              aria-pressed={a.active}
              className={`flex h-[46px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-line text-[13px] transition-colors first:border-l-0 [&:not(:first-child)]:border-l hover:bg-tile hover:text-ink disabled:opacity-50 ${
                a.primary ? "font-bold text-ink" : "font-semibold text-muted"
              } ${a.active ? "text-ink" : ""}`}
            >
              {a.busy ? <Spinner className="h-3.5 w-3.5" /> : <Icon name={a.icon} size={15} />}
              {a.label}
            </button>
          ))}
          {noMeVa ? (
            <button
              type="button"
              onClick={() => setPreguntando(true)}
              data-hint-target={noMeVa.hintTarget}
              className="flex h-[46px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-l border-line text-[13px] font-semibold text-muted transition-colors hover:bg-tile hover:text-ink"
            >
              <Icon name="equis" size={15} /> no me va
            </button>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="border-t border-line px-[13px] py-2 text-[11px] text-error">{error}</p>
      ) : null}

      {/* La hoja de motivo es OBLIGATORIA: "no me va" no resuelve sin motivo.
          Es la MISMA que abre la salida del duelo (`ninguna de las dos me va`)
          — por eso vive en su propio componente. */}
      {noMeVa ? (
        <MotivoSheet
          open={preguntando}
          onClose={cerrarHoja}
          motivo={motivo}
          onMotivo={setMotivo}
          puedeReemplazar={noMeVa.puedeReemplazar}
          onReemplazar={noMeVa.onReemplazar}
          onQuitar={noMeVa.onQuitar}
        />
      ) : null}
    </li>
  );
}
