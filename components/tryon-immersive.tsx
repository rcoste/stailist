"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";

type Prenda = { nombre: string; swatch: string; imagen?: string | null };

// Loading del try-on: mismo lenguaje que el resto (frases que se funden, nunca un
// spinner), pero en tono oscuro porque el try-on es el único momento negro.
// Exportado para reusarlo en el try-on del Wishlist.
export const TRYON_PHRASES: GenPhrase[] = [
  { a: "poniéndote el ", k: "look", b: "…" },
  { a: "ajustando cada ", k: "prenda", b: "…" },
  { a: "buscando tu mejor ", k: "ángulo", b: "…" },
  { a: "revelando tu ", k: "foto", b: "…" },
];

// Try-on inmersivo (rebrand v3): el ÚNICO momento oscuro de la app. Takeover a
// sangre sobre #0a0a0a (= bg-accent, token). Tres modos: gen (loading), full
// (foto + tira "lleva puesto" + acciones) y error. Tocar la foto la amplía a
// fullscreen (estado 8), ocultando el chrome.
const short = (n: string) => n.trim().split(" ")[0];

export function TryonImmersive({
  mode,
  image,
  lookName,
  prendas,
  errMsg,
  worn,
  onClose,
  onRetry,
  onOtro,
  onMeLoPongo,
  changeHref,
}: {
  mode: "gen" | "full" | "error";
  image: string | null;
  lookName?: string;
  prendas: Prenda[];
  errMsg?: string;
  worn: boolean;
  onClose: () => void;
  onRetry: () => void;
  onOtro: () => void;
  onMeLoPongo: () => void;
  changeHref: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Nombre del look con la última palabra en serif itálica de acento.
  const words = (lookName ?? "tu look").trim().split(" ");
  const last = words.length > 1 ? words.pop() : null;
  const head = words.join(" ");

  // --- Loading: el modal abre oscuro de inmediato y revela la foto al llegar ---
  if (mode === "gen") {
    return <GeneratingScreen phrases={TRYON_PHRASES} tone="dark" />;
  }

  // --- Error ---
  if (mode === "error" || !image) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-accent px-8 text-center">
        <p className="text-sm font-semibold text-on-accent">
          {errMsg || "No pude crear tu look."}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-sm border border-on-accent/40 px-6 text-sm font-semibold text-on-accent"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-sm bg-on-accent px-6 text-sm font-bold text-accent"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // --- Estado 8 · ampliar (fullscreen, chrome oculto) ---
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] bg-accent">
        <Image
          src={image}
          alt={lookName ? `Tú con ${lookName}` : "Tú con este look"}
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover object-[50%_14%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85" />
        <div className="absolute inset-x-0 top-0 z-[5] flex justify-end px-[22px] pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Cerrar ampliación"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-on-accent/50 text-on-accent"
          >
            <Icon name="equis" size={17} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[5] px-[22px] pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-on-accent">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-accent/75">
            Así te queda
          </p>
          <p className="mt-1.5 font-display text-[30px] italic">{lookName}</p>
          <p className="mt-3 text-xs text-on-accent/60">
            pellizca para acercar · toca la ✕ para cerrar
          </p>
        </div>
      </div>
    );
  }

  // --- Estado 7 · try-on inmersivo ---
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-accent">
      {/* Foto a sangre, a color; tap → ampliar */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Ampliar tu foto"
        className="absolute inset-0 z-0"
      >
        <Image
          src={image}
          alt={lookName ? `Tú con ${lookName}` : "Tú con este look"}
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover object-[50%_8%]"
        />
        <span className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/95" />
      </button>

      {/* Top: volver al outfit + ampliar */}
      <div className="relative z-[5] flex items-center justify-between px-[22px] pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-semibold text-on-accent"
        >
          <Icon name="chevron" size={18} rotate={180} /> el outfit
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Ampliar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-on-accent/50 text-on-accent"
        >
          <Icon name="expandir" size={16} />
        </button>
      </div>

      {/* Chip */}
      <span className="relative z-[5] ml-[22px] mt-3.5 inline-flex items-center gap-1.5 self-start rounded-sm bg-on-accent/95 px-3 py-2 text-[12px] font-bold text-ink">
        <Icon name="destello" size={13} /> tú con este look
      </span>

      {/* Pie: nombre + tira "lleva puesto" + acciones */}
      <div className="relative z-[5] mt-auto px-[22px] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-on-accent">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-accent/80">
          Así te queda
        </p>
        <h2 className="mt-2 text-[34px] font-bold leading-[0.94] tracking-[-0.035em]">
          {head}{" "}
          {last ? (
            <em className="font-display font-normal italic tracking-normal text-on-accent/90">
              {last}
            </em>
          ) : null}
        </h2>

        <div className="mt-4 flex gap-2">
          {prendas.slice(0, 4).map((p) => (
            <div
              key={p.nombre}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-md border border-on-accent/20 bg-on-accent/10 p-1.5"
            >
              <div className="aspect-square w-full overflow-hidden rounded-sm bg-on-accent/20">
                {p.imagen ? (
                  <Image
                    src={p.imagen}
                    alt={p.nombre}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="block h-full w-full"
                    style={{ backgroundColor: p.swatch }}
                    aria-hidden
                  />
                )}
              </div>
              <span className="text-center text-[8.5px] font-bold uppercase leading-tight text-on-accent/90">
                {short(p.nombre)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-[18px] flex gap-2.5">
          <button
            type="button"
            onClick={onOtro}
            className="h-[52px] flex-1 rounded-sm border border-on-accent/55 text-[15px] font-semibold text-on-accent"
          >
            otro look
          </button>
          <button
            type="button"
            onClick={onMeLoPongo}
            disabled={worn}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-sm bg-on-accent text-[15px] font-bold text-accent disabled:opacity-70"
          >
            {worn ? (
              <>
                <Icon name="check" size={17} /> es tu look
              </>
            ) : (
              "me lo pongo"
            )}
          </button>
        </div>

        <Link
          href={changeHref}
          className="mt-3 block text-center text-xs font-medium text-on-accent/60 underline underline-offset-4"
        >
          ¿No te pareces? Cambia tu avatar
        </Link>
      </div>
    </div>
  );
}
