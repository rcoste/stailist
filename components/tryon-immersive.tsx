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
  minimal = false,
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
  /** Primer uso: oculta "me lo pongo" (esa acción vive en /hoy). */
  minimal?: boolean;
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
  // La foto va COMPLETA (object-contain sobre la misma foto blurreada, el patrón
  // del split de desktop). En cover cortaba los pies, y "ampliar" sin poder ver
  // el look entero es no ampliar nada: el zoom de la PWA está apagado
  // (userScalable: false), así que esta pantalla es la única oportunidad de ver
  // el cuerpo completo (feedback de Alberto).
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] bg-accent">
        <Image
          src={image}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="object-cover blur-3xl brightness-50"
        />
        <div className="absolute inset-0 flex items-center justify-center px-3 pb-32 pt-[max(3.5rem,env(safe-area-inset-top))]">
          <span className="relative block h-full w-full">
            <Image
              src={image}
              alt={lookName ? `Tú con ${lookName}` : "Tú con este look"}
              fill
              sizes="(max-width: 430px) 100vw, 430px"
              className="object-contain"
            />
          </span>
        </div>
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
          {/* Sin "pellizca para acercar": el zoom de la PWA está deshabilitado
              y el hint prometía algo que no funcionaba. */}
          <p className="mt-3 text-xs text-on-accent/60">
            toca la ✕ para cerrar
          </p>
        </div>
      </div>
    );
  }

  // --- Estado 7 · try-on inmersivo ---
  // Móvil: foto a sangre con el pie encima (intacto). Desktop (handoff
  // desktop_f3): split — foto completa object-contain a la izquierda (con la
  // misma foto blurreada de fondo) + rail de 480px con nombre/prendas/acciones.
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-accent lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
      {/* Foto: a sangre en móvil; panel propio en desktop. Tap → ampliar. */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Ampliar tu foto"
        className="absolute inset-0 z-0 lg:relative lg:inset-auto lg:z-auto lg:h-full lg:overflow-hidden"
      >
        {/* Capa móvil: cover + gradiente para el pie */}
        <span className="lg:hidden">
          <Image
            src={image}
            alt={lookName ? `Tú con ${lookName}` : "Tú con este look"}
            fill
            sizes="100vw"
            className="object-cover object-[50%_8%]"
          />
          <span className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/95" />
        </span>
        {/* Capa desktop: fondo = la misma foto blurreada; encima, cuerpo completo */}
        <span className="hidden lg:block">
          <Image
            src={image}
            alt=""
            aria-hidden
            fill
            sizes="60vw"
            className="object-cover blur-3xl brightness-50"
          />
          <span className="absolute inset-0 flex items-center justify-center py-7">
            <span className="relative block aspect-[3/4] h-full max-w-full">
              <Image
                src={image}
                alt={lookName ? `Tú con ${lookName}` : "Tú con este look"}
                fill
                sizes="(min-width: 1024px) 55vh, 100vw"
                className="rounded-md object-cover shadow-2xl"
              />
            </span>
          </span>
        </span>
      </button>

      {/* Top móvil: volver al outfit + ampliar (en desktop vive en el rail) */}
      <div className="relative z-[5] flex items-center justify-between px-[22px] pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
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

      {/* Chip (solo móvil — en desktop el eyebrow del rail cumple ese rol) */}
      <span className="relative z-[5] ml-[22px] mt-3.5 inline-flex items-center gap-1.5 self-start rounded-sm bg-on-accent/95 px-3 py-2 text-[12px] font-bold text-ink lg:hidden">
        <Icon name="destello" size={13} /> tú con este look
      </span>

      {/* Pie en móvil / rail derecho en desktop: nombre + prendas + acciones */}
      <div className="relative z-[5] mt-auto px-[22px] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-on-accent lg:mt-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:px-11 lg:pb-7 lg:pt-5">
        {/* Fila superior del rail (solo desktop): volver + ampliar */}
        <div className="mb-9 hidden items-center justify-between lg:flex">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-semibold text-on-accent/85 transition-colors hover:text-on-accent"
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

        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-accent/80">
          Así te queda
        </p>
        <h2 className="mt-2 text-[34px] font-bold leading-[0.94] tracking-[-0.035em] lg:text-[36px]">
          {head}{" "}
          {last ? (
            <em className="font-display font-normal italic tracking-normal text-on-accent/90">
              {last}
            </em>
          ) : null}
        </h2>

        <hr className="hidden border-on-accent/15 lg:my-6 lg:block" />
        <p className="hidden text-[11px] font-bold uppercase tracking-[0.2em] text-on-accent/60 lg:block">
          Las prendas
        </p>

        <div className="mt-4 flex gap-2 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-3">
          {prendas.slice(0, 4).map((p) => (
            <div
              key={p.nombre}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-md border border-on-accent/20 bg-on-accent/10 p-1.5 lg:flex-none lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0"
            >
              <div className="aspect-square w-full overflow-hidden rounded-sm bg-on-accent/20 lg:aspect-[3/4] lg:w-[84px] lg:shrink-0">
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
              <span className="text-center text-[8.5px] font-bold uppercase leading-tight text-on-accent/90 lg:text-left lg:text-[11px] lg:tracking-[0.06em]">
                {short(p.nombre)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-[18px] flex gap-2.5 lg:mt-auto lg:flex-col lg:gap-3 lg:pt-8">
          <button
            type="button"
            onClick={onOtro}
            className={`h-[52px] rounded-sm border border-on-accent/55 text-[15px] font-semibold text-on-accent lg:order-2 lg:h-auto lg:self-center lg:border-0 lg:px-2 lg:py-1 lg:text-sm lg:font-medium lg:text-on-accent/65 lg:underline-offset-4 lg:hover:text-on-accent lg:hover:underline ${
              minimal ? "w-full lg:w-auto lg:flex-none" : "flex-1 lg:flex-none"
            }`}
          >
            otro look
          </button>
          {/* "me lo pongo" solo en usos posteriores (/hoy); en el primer uso
              (minimal) la decisión es el 👍/👎 de abajo, no un compromiso. */}
          {!minimal && (
            <button
              type="button"
              onClick={onMeLoPongo}
              disabled={worn}
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-sm bg-on-accent text-[15px] font-bold text-accent disabled:opacity-70 lg:order-1 lg:w-full lg:flex-none"
            >
              {worn ? (
                <>
                  <Icon name="check" size={17} /> es tu look
                </>
              ) : (
                "me lo pongo"
              )}
            </button>
          )}
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
