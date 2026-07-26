"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";

// Vista "así te queda": el render del try-on DENTRO del lienzo de papel (no un
// modal oscuro). Marco 3:4 con la imagen o la animación de generación, la voz
// del coach, la tira de prendas y la lupa a pantalla completa. Compartida por el
// detalle del look (Hoy/wow) y el detalle del Historial — misma pieza en todos.
export type TryonPrenda = {
  nombre: string;
  swatch: string;
  imagen?: string | null;
};

const firstWord = (n: string) => n.trim().split(" ")[0] || n;

// La voz del coach mientras genera: cambia cada ~1.25 s, en primera persona.
const FASES_COACH = [
  "recorto tus prendas…",
  "las pruebo en tu silueta…",
  "ajusto caídas y largos…",
  "le doy los últimos toques…",
];

export function TryonView({
  image,
  generating,
  error,
  prendas,
  nombre,
  onGenerar,
}: {
  image: string | null;
  generating: boolean;
  error?: string | null;
  prendas: TryonPrenda[];
  nombre: string;
  onGenerar?: () => void;
}) {
  const [full, setFull] = useState(false);
  const [fase, setFase] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(
      () => setFase((f) => (f + 1) % FASES_COACH.length),
      1250
    );
    return () => {
      clearInterval(id);
      setFase(0);
    };
  }, [generating]);

  const hasRender = !!image && !generating;

  // Layout v2 (handoff design_handoff_look_detalle_v2 §5): el render MANDA la
  // altura — llena el alto disponible y de ahí sale su ancho (3:4); las
  // miniaturas van en una COLUMNA de 56px al lado (la tira horizontal de abajo
  // gastaba ~79px de alto que ahora son render). Sigue siendo flexible: en
  // pantallas cortas el marco se encoge (decisión de Roberto: nada de scroll).
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-stretch justify-center gap-2">
        <div className="relative aspect-[3/4] h-full min-h-0 max-w-[calc(100%-3.5rem-0.5rem)] overflow-hidden rounded-sm border border-line bg-tile">
        {hasRender ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image!}
              alt={`tú con ${nombre}`}
              className="tryon-reveal absolute inset-0 h-full w-full object-cover object-[50%_6%]"
            />
            {/* La lupa del marco se oculta mientras la pantalla completa está
                abierta (como el mock del handoff: evita que se asome encima). */}
            {!full ? (
              <button
                type="button"
                onClick={() => setFull(true)}
                aria-label="ver a pantalla completa"
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink backdrop-blur transition-colors hover:bg-surface"
              >
                <Icon name="expandir" size={16} />
              </button>
            ) : null}
          </>
        ) : null}

        {generating ? (
          <div className="absolute inset-0 bg-tile">
            <span className="tryon-gen-sil" aria-hidden />
            <div className="tryon-gen-pc" aria-hidden>
              {prendas.map((p, i) =>
                p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p.imagen} alt="" />
                ) : null
              )}
            </div>
            <span className="tryon-gen-sweep" aria-hidden />
            <span className="tryon-gen-bar" aria-hidden>
              <i />
            </span>
          </div>
        ) : null}

        {error && !generating && !hasRender ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-tile px-6 text-center">
            <p className="text-[13px] font-medium text-ink">{error}</p>
            {onGenerar ? (
              <button
                type="button"
                onClick={onGenerar}
                className="min-h-11 rounded-sm border border-line bg-surface px-5 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
              >
                reintentar
              </button>
            ) : null}
          </div>
        ) : null}
        </div>

        {/* Columna de prendas al lado del render (nunca encima — se probó
            superpuesta y se ve pegoteada). Las miniaturas van en proporción FIJA
            4/5 (la de todos los tiles de la app), NO estiradas a igualar el alto
            del render: estiradas (handoff) el cover recortaba la prenda misma
            (feedback de Roberto en el teléfono real). Con muchas prendas la
            columna hace scroll interno. */}
        {hasRender ? (
          <div className="flex w-14 shrink-0 flex-col gap-1.5 overflow-y-auto">
            {prendas.map((p, i) => (
              <div
                key={i}
                className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-sm border border-line bg-tile"
              >
                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imagen}
                    alt={p.nombre}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="absolute inset-0"
                    style={{ backgroundColor: p.swatch }}
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* La voz del coach mientras genera (serif itálica, primera persona). */}
      {generating ? (
        <p className="font-display mt-3.5 flex shrink-0 items-start gap-2.5 text-[18px] italic leading-[25px] text-muted">
          <Icon name="destello" size={16} className="mt-1 shrink-0 text-ink" />
          <span>{FASES_COACH[fase]}</span>
        </p>
      ) : null}

      {full && hasRender && typeof document !== "undefined" ? (
        <Lupa
          image={image!}
          nombre={nombre}
          prendas={prendas}
          onClose={() => setFull(false)}
        />
      ) : null}
    </div>
  );
}

// Pantalla completa (lupa): editorial a sangre + paleta del look. Portal a body
// para escapar de cualquier ancestro con transform (la tab bar confina fixed).
function Lupa({
  image,
  nombre,
  prendas,
  onClose,
}: {
  image: string;
  nombre: string;
  prendas: TryonPrenda[];
  onClose: () => void;
}) {
  // Compartir la foto del render (pedido de Roberto 2026-07-26 — sale de la
  // lista fuera-del-MVP). Mismo patrón que el pasaporte: share con archivo si
  // el dispositivo puede; si no (desktop), descarga. Cancelar no es error.
  const [sharing, setSharing] = useState(false);
  async function compartir() {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], "stailist-look.jpg", {
        type: blob.type || "image/jpeg",
      });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombre });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "stailist-look.jpg";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // AbortError (canceló el diálogo) o fetch fallido: sin drama.
    }
    setSharing(false);
  }

  // Paleta del look: colores dominantes de las prendas (dedup por hex), máx 5.
  const seen = new Set<string>();
  const paleta = prendas
    .filter((p) => {
      const k = p.swatch.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-bg"
      style={{ animation: "var(--dur-short) var(--ease-enter) step-in" }}
    >
      {/* Foto a sangre arriba. SIN velo: el gradiente del handoff era para darle
          contraste a la barra de estado cuando la foto sangra hasta el borde
          superior — en el teléfono real la foto NO llega ahí, y el velo solo se
          veía como una mancha gris (feedback de Roberto). */}
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={`tú con ${nombre}`}
          className="h-full w-full object-cover object-[50%_15%]"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="cerrar"
        className="absolute left-3.5 top-[max(3.5rem,calc(env(safe-area-inset-top)+1rem))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
      >
        <Icon name="equis" size={20} />
      </button>

      {/* Bloque de papel (no puede quedar vacío): nombre + paleta + tira. */}
      <div className="absolute inset-x-0 bottom-0 top-[64%] flex flex-col px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          así te queda
        </span>
        <span className="font-display mt-1 text-[27px] italic leading-[30px] text-ink">
          {nombre}
        </span>

        <div className="mt-auto flex">
          {paleta.map((p, i) => (
            <div key={i} className="flex flex-1 flex-col gap-1.5">
              <span className="h-11" style={{ backgroundColor: p.swatch }} />
              <span className="truncate pr-2 text-[9.5px] font-bold uppercase tracking-[0.09em] text-muted">
                {firstWord(p.nombre)}
              </span>
            </div>
          ))}
        </div>

        {/* Tira más grande (56px): abajo sobraba aire muerto bajo los thumbs de
            38px (feedback de Roberto) — mejor que lo ocupe la prenda. Compartir
            al final de la fila, como el mock del handoff. */}
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
          {prendas.map((p, i) =>
            p.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.imagen}
                alt={p.nombre}
                className="aspect-[4/5] w-14 shrink-0 rounded-sm border border-line object-cover"
              />
            ) : null
          )}
          <button
            type="button"
            onClick={compartir}
            disabled={sharing}
            aria-label="compartir el look"
            className="relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink disabled:opacity-50 after:absolute after:-inset-1 after:content-['']"
          >
            {sharing ? (
              <Spinner className="h-4 w-4 text-ink" />
            ) : (
              <Icon name="compartir" size={17} />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
