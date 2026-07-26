"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";

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

  // Contenedor sin scroll propio: el consumidor decide el scroll (para poder
  // meter debajo su bloque de "por qué y cómo" en el mismo área).
  return (
    <div className="flex flex-col">
      {/* Marco 3:4: el render, la animación de generación, o el error. */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] shrink-0 overflow-hidden rounded-sm border border-line bg-tile">
        {hasRender ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image!}
              alt={`tú con ${nombre}`}
              className="tryon-reveal absolute inset-0 h-full w-full object-cover object-[50%_6%]"
            />
            <button
              type="button"
              onClick={() => setFull(true)}
              aria-label="ver a pantalla completa"
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink backdrop-blur transition-colors hover:bg-surface"
            >
              <Icon name="expandir" size={16} />
            </button>
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

      {/* La voz del coach mientras genera (serif itálica, primera persona). */}
      {generating ? (
        <p className="font-display mt-3.5 flex shrink-0 items-start gap-2.5 text-[18px] italic leading-[25px] text-muted">
          <Icon name="destello" size={16} className="mt-1 shrink-0 text-ink" />
          <span>{FASES_COACH[fase]}</span>
        </p>
      ) : null}

      {/* Tira de prendas (sin nombres: ya se leyeron en la otra vista). */}
      {hasRender ? (
        <div className="mt-3 flex shrink-0 gap-1.5">
          {prendas.map((p, i) => (
            <div
              key={i}
              className="relative aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-sm border border-line bg-tile"
            >
              {p.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imagen}
                  alt={p.nombre}
                  className="h-full w-full object-cover"
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
      {/* Foto a sangre arriba, con velo para el contraste de la barra de estado. */}
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={`tú con ${nombre}`}
          className="h-full w-full object-cover object-[50%_15%]"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[150px]"
          style={{
            background:
              "linear-gradient(to bottom, rgb(12 12 12/.42), rgb(12 12 12/0))",
          }}
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

        <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-3.5">
          {prendas.map((p, i) =>
            p.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.imagen}
                alt={p.nombre}
                className="aspect-[4/5] w-[38px] shrink-0 rounded-sm border border-line object-cover"
              />
            ) : null
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
