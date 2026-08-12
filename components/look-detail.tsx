"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { FavoriteButton } from "@/components/favorite-button";
import { CoachPie } from "@/components/coach-pie";
import { PrendasGrid } from "@/components/prendas-grid";
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
  onInicio,
  seccionLabel,
  onFitCheck,
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
  /** Si viene, "hoy" es un botón a la home de la sección. El wow no lo pasa. */
  onInicio?: () => void;
  /** Etiqueta de la sección. Default "hoy"; un look planeado para otro día dice
   *  su fecha ("mañana") — decir "hoy" sobre el look del sábado sería mentir. */
  seccionLabel?: string;
  /** LA PROMESA FIJA del fit check (decisión de Roberto, 2026-08-11): abre el
   *  espejo. Reemplaza a la card "¿te lo pusiste ayer?" — oferta en vez de
   *  favor, y sin hora: justo al generar todavía no te lo has puesto, que era
   *  la trampa de preguntarlo. Solo la pasa el /hoy (en el wow y el historial
   *  no aplica). La señal de oro se mide por cercanía: fit check ≤24h después
   *  de un look generado (lib/senal-oro). */
  onFitCheck?: () => void;
}) {
  // Vista elegida a mano; si es null, el default sale del estado del render.
  const [manual, setManual] = useState<"look" | "me" | null>(null);

  const hasRender = !!tryonImage && !generating;
  const canMe = generating || hasRender;
  // Generando fuerza "así te queda"; con render, default "así te queda" salvo
  // que el usuario haya tocado "las prendas".
  const tab: "look" | "me" = generating
    ? "me"
    : hasRender
      ? manual ?? "me"
      : "look";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Título (v2): "hoy" + nombre lado a lado, sin punto y a todo el ancho —
          el corazón se mudó a la fila de pestañas, que tenía hueco muerto. */}
      <div className="flex items-start gap-3 pb-1">
        {/* "hoy" es el nombre de la sección, así que tocarlo lleva a la home de
            la sección — la convención del logo de toda la vida, sobre pixeles
            que ya estaban ahí sin hacer nada.
            OPCIONAL a propósito: este mismo componente pinta el wow del
            onboarding, donde no hay home a la que volver. Sin onInicio se
            queda como estaba, un <h1> y ya. */}
        {onInicio ? (
          <button
            type="button"
            onClick={onInicio}
            aria-label="Ir a inicio"
            className="mt-0.5 text-[29px] font-bold leading-none tracking-[-0.015em] text-ink transition-opacity hover:opacity-60"
          >
            {seccionLabel ?? "hoy"}
          </button>
        ) : (
          <h1 className="mt-0.5 text-[29px] font-bold leading-none tracking-[-0.015em] text-ink">
            {seccionLabel ?? "hoy"}
          </h1>
        )}
        <span className="font-display text-[27px] italic leading-[29px] text-ink">
          {nombre}
        </span>
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Pestañas (vistas del look) + corazón a la derecha. El coach ya NO vive
            aquí: es una voz, no una vista — se fue al pie (CoachPie). */}
        <div className="mt-2 flex items-center gap-1 border-b border-line">
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
          <div className="ml-auto self-center pb-1.5">
            <FavoriteButton
              outfitId={outfitId}
              initialFavorited={initialFavorited}
              variant="ring"
              confirmaDestino
            />
          </div>
        </div>

        {tab === "look" ? (
          <div className="mt-2.5 min-h-0 flex-1">
            {/* La retícula toma el alto flexible y se ajusta para que quepa. */}
            <PrendasGrid prendas={prendas} />
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <TryonView
              image={tryonImage}
              generating={generating}
              error={tryonError}
              prendas={prendas}
              nombre={nombre}
              onGenerar={onGenerar}
            />
          </div>
        )}

        {/* El pie del coach: por qué ⇄ cómo llevarlo, compartido por las dos
            vistas. Slot fijo — el texto nunca le cobra espacio a la foto. */}
        <CoachPie porQue={justificacion} como={tip} />
      </div>

      {/* Footer fijo. La primaria negra "verme…" sólo mientras NO hay render;
          con render desaparece (el voto es la acción del día). */}
      <div className="-mx-4 mt-2 border-t border-line bg-surface px-4 pb-6 pt-3">
        {!hasRender ? (
          avatarHref ? (
            <Link
              href={avatarHref}
              data-hint-target="hoy-tryon"
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Icon name="destello" size={18} /> crea tu avatar para verte
            </Link>
          ) : (
            <button
              type="button"
              onClick={onGenerar}
              disabled={generating}
              // El tip "aquí te lo pruebo puesto en ti" señala este botón. Vivía
              // en hoy-client hasta que esta pantalla lo absorbió y el atributo
              // se perdió en la mudanza: cuatro días de tip muerto. Si el botón
              // vuelve a moverse, el atributo se muda CON él (lo exige
              // lib/hints-catalog.test.ts).
              data-hint-target="hoy-tryon"
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

        {/* La promesa del fit check: una OFERTA quieta, no un recordatorio con
            hora ni un favor que contestar. Vive fija bajo las acciones del look. */}
        {onFitCheck ? (
          <button
            type="button"
            onClick={onFitCheck}
            className="flex min-h-10 w-full items-center justify-center gap-2 border-t border-line2 pt-1 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <Icon name="camara" size={15} />
            cuando te lo pongas, enséñamelo — te digo cómo se ve
          </button>
        ) : null}

        {/* LA SALIDA DEL ONBOARDING, con peso de botón.
            Era texto gris de 14px al fondo de la pantalla: el elemento MÁS
            débil de la vista, siendo la única puerta a la app. Quien no la veía
            se quedaba en el look sin saber qué seguía ("está muy escondido").
            Toma el lugar primario cuando ya hay render —ahí no compite con
            nada, porque el botón de "verme" desaparece— y se queda como
            secundaria con borde mientras el render sigue siendo la invitación
            principal. */}
        {enterApp ? (
          <button
            type="button"
            onClick={enterApp}
            className={
              hasRender
                ? "mt-1.5 flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
                : "mt-1.5 flex h-[48px] w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface text-[15px] font-semibold text-ink transition-colors hover:border-ink"
            }
          >
            entrar a la app <Icon name="flecha" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
