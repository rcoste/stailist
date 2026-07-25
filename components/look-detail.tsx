"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { FavoriteButton } from "@/components/favorite-button";

// Detalle del look (handoff design_handoff_look_detalle + design_handoff_try_on).
// Compartido por el wow del onboarding y el /hoy diario para que se vean igual.
//
// El try-on YA NO es un modal oscuro aparte: el render vive en el MISMO lienzo de
// papel, como una segunda vista del look. La fila de etiqueta se vuelve dos
// pestañas — "las prendas" (el collage) y "así te queda" (el avatar vestido) —
// que morfan según exista o no el render:
//   · sin render → sólo "las prendas"; primaria "verme con este look" (genera).
//   · generando  → "así te queda" activa con la animación dentro del marco 3:4.
//   · con render → las dos, "así te queda" por defecto; ya no se ofrece generar.
//
// Decisión de producto (Roberto): "me lo pongo" NO vive aquí. El worn del mismo
// día generaba señales falsas (se tocaba sólo para avanzar), así que la acción
// del día es el voto 👍/👎; el worn se pregunta al día siguiente con la card
// "¿te lo pusiste?". Por eso, con render, la primaria negra simplemente
// desaparece: el render es el premio y el voto es lo que capturamos.
export type LookDetailPrenda = {
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
      <span
        title={prenda.nombre}
        className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/[0.62] via-black/[0.34] to-transparent px-2.5 pb-[7px] pt-4 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white"
      >
        {prenda.nombre}
      </span>
    </div>
  );
}

// Grid por conteo: ≤4 → 2 columnas; 5+ → 2 protagonistas + fila de apoyo.
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
  prendas: LookDetailPrenda[];
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
  const [full, setFull] = useState(false);
  // Slot de texto de "las prendas": justificación (default) ⇄ tip.
  const [swapped, setSwapped] = useState(false);
  // Bloque "por qué y cómo" bajo el render (vista "así te queda").
  const [whyOpen, setWhyOpen] = useState(false);
  // Frase del coach que cicla mientras genera (se reinicia en cada generación).
  const [fase, setFase] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(
      () => setFase((f) => (f + 1) % FASES_COACH.length),
      1250
    );
    // Reinicia la frase al terminar (siguiente generación arranca en la 1ª).
    return () => {
      clearInterval(id);
      setFase(0);
    };
  }, [generating]);

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
          <>
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
          </>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Marco 3:4: el render, la animación de generación, o el error. */}
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] shrink-0 overflow-hidden rounded-sm border border-line bg-tile">
              {hasRender ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tryonImage!}
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

              {tryonError && !generating && !hasRender ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-tile px-6 text-center">
                  <p className="text-[13px] font-medium text-ink">{tryonError}</p>
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

      {full && hasRender && typeof document !== "undefined" ? (
        <Lupa
          image={tryonImage!}
          nombre={nombre}
          prendas={prendas}
          onClose={() => setFull(false)}
        />
      ) : null}
    </div>
  );
}
