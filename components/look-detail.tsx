"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { FavoriteButton } from "@/components/favorite-button";
import { TryonView, type TryonPrenda } from "@/components/tryon-view";

// Detalle del look (handoff design_handoff_look_detalle + design_handoff_try_on).
// Compartido por el wow del onboarding y el /hoy diario para que se vean igual.
//
// El try-on YA NO es un modal oscuro aparte: el render vive en el MISMO lienzo de
// papel (componente TryonView), como una segunda vista del look. La fila de
// etiqueta se vuelve dos pestañas — "las prendas" (el collage) y "así te queda"
// (el avatar vestido) — que morfan según exista o no el render:
//   · sin render → sólo "las prendas"; primaria "verme con este look" (genera).
//   · generando  → "así te queda" activa con la animación dentro del marco 3:4.
//   · con render → las dos, "así te queda" por defecto; ya no se ofrece generar.
//
// Decisión de producto (Roberto): "me lo pongo" NO vive aquí. El worn del mismo
// día generaba señales falsas (se tocaba sólo para avanzar), así que la acción
// del día es el voto 👍/👎; el worn se pregunta al día siguiente con la card
// "¿te lo pusiste?". Por eso, con render, la primaria negra simplemente
// desaparece: el render es el premio y el voto es lo que capturamos.
export type LookDetailPrenda = TryonPrenda;

function Tile({ prenda }: { prenda: LookDetailPrenda }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-sm border border-line bg-tile">
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
      <span
        title={prenda.nombre}
        className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/[0.62] via-black/[0.34] to-transparent px-2.5 pb-[7px] pt-4 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white"
      >
        {prenda.nombre}
      </span>
    </div>
  );
}

// Retícula de 2 columnas que LLENA el alto disponible (filas de igual fracción):
// las prendas escalan para que todo el detalle quepa sin scroll, más chicas en
// pantallas cortas y grandes en las altas. object-cover recorta sólo el aire de
// los flat-lays, así que la prenda se mantiene centrada.
function Grid({ prendas }: { prendas: LookDetailPrenda[] }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2 [grid-auto-rows:minmax(0,1fr)]">
      {prendas.map((p, i) => (
        <Tile key={i} prenda={p} />
      ))}
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

// Pestaña del segmento "las prendas | así te queda".
function SegTab({
  label,
  active,
  pulse,
  onClick,
}: {
  label: string;
  active: boolean;
  pulse?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative mr-[18px] min-h-10 pb-2.5 pt-1 text-[13.5px] font-semibold transition-colors ${
        active
          ? "text-ink after:absolute after:bottom-[-1px] after:left-0 after:right-[18px] after:h-0.5 after:bg-ink after:content-['']"
          : "text-faint hover:text-muted"
      }`}
    >
      {label}
      {pulse ? <span className="tryon-gen-pulse ml-1.5 align-middle" /> : null}
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
  voto,
  onVote,
  onOtroLook,
  enterApp,
  disabled,
  // — try-on —
  tryonImage = null,
  generating = false,
  tryonError = null,
  onGenerar,
  avatarHref = null,
  vermeSub,
}: {
  nombre: string;
  prendas: LookDetailPrenda[];
  justificacion: string;
  tip?: string | null;
  outfitId: string;
  initialFavorited: boolean;
  voto: "up" | "down" | null;
  onVote: (up: boolean) => void;
  onOtroLook: () => void;
  /** Solo el wow: salida explícita a la app (el voto registra en el lugar). */
  enterApp?: () => void;
  disabled?: boolean;
  /** Render del try-on (URL firmada) ya existente o recién generado. */
  tryonImage?: string | null;
  /** El render se está generando → animación dentro del marco, primaria inerte. */
  generating?: boolean;
  /** Mensaje de error de la generación (se muestra dentro del marco). */
  tryonError?: string | null;
  /** Dispara la generación (y el reintento desde error). */
  onGenerar?: () => void;
  /** Si no hay avatar todavía: la primaria es un link al wizard, no genera. */
  avatarHref?: string | null;
  /** Sub-etiqueta de la primaria "verme…" (ej. "~20 s"). */
  vermeSub?: string;
}) {
  // Vista elegida a mano; si es null, el default sale del estado del render.
  const [manual, setManual] = useState<"look" | "me" | null>(null);
  // Slot de texto de "las prendas": justificación (default) ⇄ tip.
  const [swapped, setSwapped] = useState(false);
  // Bloque "por qué y cómo" bajo el render (vista "así te queda").
  const [whyOpen, setWhyOpen] = useState(false);

  const hasRender = !!tryonImage && !generating;
  const canMe = generating || hasRender;
  // Generando fuerza "así te queda"; con render, default "así te queda" salvo
  // que el usuario haya tocado "las prendas".
  const tab: "look" | "me" = generating
    ? "me"
    : hasRender
      ? manual ?? "me"
      : "look";

  const hasTip = !!tip?.trim();
  const showTip = swapped && hasTip;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: hoy · nombre + corazón */}
      <div className="flex items-baseline gap-2.5 pb-3">
        <h1 className="text-[25px] font-bold tracking-[-0.02em] text-ink">hoy</h1>
        <span className="text-faint">·</span>
        <span className="font-display text-[22px] italic text-muted">{nombre}</span>
        <div className="ml-auto self-center">
          <FavoriteButton outfitId={outfitId} initialFavorited={initialFavorited} />
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Segmento: pestañas + enlace de texto a la derecha */}
        <div className="flex items-center border-b border-line">
          <SegTab
            label="las prendas"
            active={tab === "look"}
            onClick={() => setManual("look")}
          />
          {canMe ? (
            <SegTab
              label="así te queda"
              active={tab === "me"}
              pulse={generating}
              onClick={() => setManual("me")}
            />
          ) : null}

          {tab === "look" && hasTip ? (
            <button
              type="button"
              onClick={() => setSwapped((s) => !s)}
              className="ml-auto flex min-h-10 items-center gap-1.5 pb-2.5 pt-1 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              {showTip ? "por qué este look" : "cómo llevarlo"}
              <Icon name="flecha" size={14} />
            </button>
          ) : null}
          {tab === "me" ? (
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              className="ml-auto flex min-h-10 items-center gap-1.5 pb-2.5 pt-1 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              por qué y cómo
              <Icon name="chevron" size={14} className={whyOpen ? "rotate-90" : ""} />
            </button>
          ) : null}
        </div>

        {tab === "look" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* La retícula toma el alto flexible y se ajusta para que quepa. */}
            <div className="mt-2.5 min-h-0 flex-1">
              <Grid prendas={prendas} />
            </div>
            {/* Justificación / cómo llevarlo: alto natural, no empuja al footer. */}
            <div className="flex shrink-0 flex-col justify-start pt-3">
              {showTip ? (
                <div
                  key="tip"
                  className="flex gap-2.5 text-[14px] leading-[20px] text-ink"
                  style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
                >
                  <Icon name="destello" size={16} className="mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{tip}</span>
                </div>
              ) : (
                <p
                  key="just"
                  className="font-display text-[17px] italic leading-[23px] text-muted line-clamp-2"
                  style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
                >
                  {justificacion}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TryonView
              image={tryonImage}
              generating={generating}
              error={tryonError}
              prendas={prendas}
              nombre={nombre}
              onGenerar={onGenerar}
            />

            {/* "por qué y cómo": justificación + tip, colapsable (evita desbordar). */}
            {hasRender && whyOpen ? (
              <div
                className="mt-3 shrink-0 border-t border-line pt-3"
                style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
              >
                <p className="font-display text-[16px] italic leading-[23px] text-muted">
                  {justificacion}
                </p>
                {hasTip ? (
                  <div className="mt-2.5 flex gap-2.5 text-[13.5px] leading-[20px] text-ink">
                    <Icon name="destello" size={15} className="mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer fijo. La primaria negra "verme…" sólo mientras NO hay render;
          con render desaparece (el voto es la acción del día). */}
      <div className="-mx-4 mt-2 border-t border-line bg-surface px-4 pb-6 pt-3">
        {!hasRender ? (
          avatarHref ? (
            <Link
              href={avatarHref}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Icon name="destello" size={18} /> crea tu avatar para verte
            </Link>
          ) : (
            <button
              type="button"
              onClick={onGenerar}
              disabled={generating}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
            >
              <Icon name="destello" size={18} />
              {generating ? "te estoy vistiendo…" : "verme con este look"}
              {!generating && vermeSub ? (
                <span className="text-[12px] font-semibold opacity-70">{vermeSub}</span>
              ) : null}
            </button>
          )
        ) : null}

        <div
          className={`flex min-h-11 items-center justify-between ${!hasRender ? "mt-1.5" : ""}`}
        >
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
