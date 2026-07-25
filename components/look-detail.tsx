"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { FavoriteButton } from "@/components/favorite-button";

// Pantalla de detalle del look (handoff design_handoff_look_detalle, con las
// fuentes/tokens del proyecto — Outfit + Fraunces itálica, no Arimo/Instrument).
// Compartida por el wow del onboarding y el /hoy diario para que se vean igual.
//
// Principios: un solo negro por pantalla (el CTA "verme"); votos en círculos
// ghost; "otro look" es link; foto siempre 4/5; un solo texto a la vez
// (porqué ⇄ cómo); el footer no se mueve. "Me lo pongo" NO vive aquí: el worn
// se pregunta al día siguiente con la card "¿te lo pusiste?".
export type LookDetailPrenda = {
  nombre: string;
  swatch: string;
  imagen?: string | null;
};

type VermeMode = { href: string } | { onClick: () => void; sub?: string };

function Tile({ prenda }: { prenda: LookDetailPrenda }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-sm border border-line bg-tile">
      {prenda.imagen ? (
        <Image
          src={prenda.imagen}
          alt={prenda.nombre}
          fill
          sizes="(max-width: 430px) 50vw, 200px"
          className="object-cover"
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{ backgroundColor: prenda.swatch }}
          aria-hidden
        />
      )}
      {/* Nombre sobre la foto: scrim + una línea con ellipsis (title = completo). */}
      <span
        title={prenda.nombre}
        className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/[0.62] via-black/[0.34] to-transparent px-2.5 pb-[7px] pt-4 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white"
      >
        {prenda.nombre}
      </span>
    </div>
  );
}

// Grid por conteo: ≤4 → 2 columnas; 5+ → 2 protagonistas (2 col) + fila de apoyo
// con tantas columnas como prendas (tope 4). La huérfana no se estira.
function Grid({ prendas }: { prendas: LookDetailPrenda[] }) {
  const n = prendas.length;
  if (n <= 4) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {prendas.map((p, i) => (
          <Tile key={i} prenda={p} />
        ))}
      </div>
    );
  }
  const protag = prendas.slice(0, 2);
  const support = prendas.slice(2);
  const cols = Math.min(support.length, 4);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {protag.map((p, i) => (
          <Tile key={i} prenda={p} />
        ))}
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {support.map((p, i) => (
          <Tile key={i} prenda={p} />
        ))}
      </div>
    </div>
  );
}

function VoteButton({
  up,
  active,
  onClick,
  disabled,
}: {
  up: boolean;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={up ? "me gusta este look" : "no me gusta este look"}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors after:absolute after:-inset-0.5 after:content-[''] disabled:opacity-50 ${
        active
          ? "border-ink bg-tile text-ink"
          : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      <Icon name="pulgar" size={17} className={up ? "" : "rotate-180"} />
    </button>
  );
}

export function LookDetail({
  nombre,
  prendas,
  justificacion,
  tip,
  outfitId,
  initialFavorited,
  verme,
  voto,
  onVote,
  onOtroLook,
  enterApp,
  disabled,
}: {
  nombre: string;
  prendas: LookDetailPrenda[];
  justificacion: string;
  tip?: string | null;
  outfitId: string;
  initialFavorited: boolean;
  verme: VermeMode;
  voto: "up" | "down" | null;
  onVote: (up: boolean) => void;
  onOtroLook: () => void;
  /** Solo el wow del onboarding: salida explícita a la app. El voto ahí registra
   *  en el lugar (no navega); esta es la puerta clara para entrar cuando quieras. */
  enterApp?: () => void;
  disabled?: boolean;
}) {
  // Un solo slot de texto: porqué (default) ⇄ cómo llevarlo (tip). Sin hoja.
  const [swapped, setSwapped] = useState(false);
  const hasTip = !!tip?.trim();
  const showTip = swapped && hasTip;

  return (
    <div className="flex flex-1 flex-col">
      {/* Header: hoy · nombre + corazón */}
      <div className="flex items-baseline gap-2.5 pb-3">
        <h1 className="text-[25px] font-bold tracking-[-0.02em] text-ink">hoy</h1>
        <span className="text-faint">·</span>
        <span className="font-display text-[22px] italic text-muted">{nombre}</span>
        <div className="ml-auto self-center">
          <FavoriteButton outfitId={outfitId} initialFavorited={initialFavorited} />
        </div>
      </div>

      {/* Cuerpo: label + grid arriba, slot empujado al fondo (footer no se mueve) */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            el outfit · {prendas.length} {prendas.length === 1 ? "prenda" : "prendas"}
          </span>
          {hasTip ? (
            <button
              type="button"
              onClick={() => setSwapped((s) => !s)}
              className="ml-auto flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              {showTip ? "por qué este look" : "cómo llevarlo"}
              <Icon name="flecha" size={14} />
            </button>
          ) : null}
        </div>

        <div className="mt-2.5">
          <Grid prendas={prendas} />
        </div>

        {/* Slot: 92px reservados para que intercambiar no mueva el footer. */}
        <div className="mt-auto flex min-h-[92px] flex-col justify-start pt-3">
          {showTip ? (
            <div
              key="tip"
              className="flex gap-2.5 text-[14px] leading-[21px] text-ink"
              style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
            >
              <Icon name="destello" size={16} className="mt-0.5 shrink-0" />
              <span className="line-clamp-3">{tip}</span>
            </div>
          ) : (
            <p
              key="just"
              className="font-display text-[18px] italic leading-[25px] text-muted line-clamp-3"
              style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
            >
              {justificacion}
            </p>
          )}
        </div>
      </div>

      {/* Footer fijo: un solo negro (verme) + fila secundaria (otro look · votos) */}
      <div className="-mx-4 mt-2 border-t border-line bg-surface px-4 pb-6 pt-3">
        {"href" in verme ? (
          <Link
            href={verme.href}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={18} /> verme con este look
          </Link>
        ) : (
          <button
            type="button"
            onClick={verme.onClick}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={18} /> verme con este look
            {verme.sub ? (
              <span className="text-[12px] font-semibold opacity-70">{verme.sub}</span>
            ) : null}
          </button>
        )}

        <div className="mt-1.5 flex min-h-11 items-center justify-between">
          <button
            type="button"
            onClick={onOtroLook}
            disabled={disabled}
            className="flex min-h-11 items-center gap-2 text-[14px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            <Icon name="repetir" size={16} /> otro look
          </button>
          <div className="flex items-center gap-2">
            <span className="mr-0.5 text-[13px] font-semibold text-muted">¿te gusta?</span>
            <VoteButton up={false} active={voto === "down"} onClick={() => onVote(false)} disabled={disabled} />
            <VoteButton up={true} active={voto === "up"} onClick={() => onVote(true)} disabled={disabled} />
          </div>
        </div>

        {enterApp ? (
          <button
            type="button"
            onClick={enterApp}
            className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-[14px] font-semibold text-muted transition-colors hover:text-ink"
          >
            entrar a la app <Icon name="flecha" size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
