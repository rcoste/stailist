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
  /** Eyebrow de fecha, SOLO cuando el look no es de hoy ("el jueves 13"). Sin
   *  él no se pinta nada: sobre el look de hoy, "hoy" es ruido. */
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
      {/* TÍTULO (v3): el nombre del look manda, a todo el ancho.
          Antes la etiqueta de sección ("hoy" / "el jueves 13") iba a su lado en
          29px bold, o sea al mismo peso visual que el nombre — y encima le
          robaba el ancho, partiendo "Esmeralda a prueba de lluvia" en dos
          líneas. La jerarquía estaba invertida: el nombre es el contenido, la
          fecha es un dato al margen.
          Ahora la fecha es un eyebrow y SOLO aparece cuando el look NO es de
          hoy: decir "hoy" sobre el look de hoy no le dice nada a nadie.
          (Roberto, viendo la pantalla en prod: "la fecha tan grande no aporta
          en nada, y solo se vuelve relevante si se genera para X día".)
          Se fue con ella el atajo de tocar la sección para ir a Inicio: la
          pestaña Inicio de la barra hace exactamente eso, y era la única razón
          por la que el bloque existía como botón. */}
      <div className="flex flex-col pb-1">
        {seccionLabel ? (
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-faint">
            {seccionLabel}
          </span>
        ) : null}
        <h1 className="font-display text-[27px] italic leading-[30px] text-ink">
          {nombre}
        </h1>
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
          <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
            {/* "TRAJE COMPLETO": la confirmación de que las dos piezas son del
                MISMO traje y no una mezcla que parece un traje.

                Roberto lo pidió primero para el comparador y luego aclaró que
                va también aquí: "es para identificar visualmente que si el AI
                propone un traje completo, tipo para un abogado, sí está
                haciendo el match correcto y no lo está haciendo parchado".

                SÓLO SE PINTA LA CONFIRMACIÓN, nunca el aviso de parchado. Aquí
                no estás evaluando el motor, estás por vestirte: un cartel que
                diga "esto está mal" sin nada que puedas hacer con él sólo
                quita confianza. El caso malo lo ataja antes la regla
                `saco-de-traje-suelto` (v0.2.242.0), y el comparador —que sí es
                para evaluar— sigue enseñando las tres respuestas.

                Y DESDE QUE EL PAR SE DIBUJA JUNTO, esa confirmación ya no se
                escribe: `PrendasGrid` agrupa las dos piezas en una celda con su
                pie ("Traje gris carbón"), así que la etiqueta repetía en texto
                lo que la retícula enseña. Era además la parte que no funcionaba
                — Roberto: "ya se ve que sí son del mismo color, pero quedamos
                que los ibas a englobar". */}
            {/* La retícula toma el alto flexible y se ajusta para que quepa. */}
            <div className="min-h-0 flex-1">
              <PrendasGrid prendas={prendas} />
            </div>
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

        {/* UNA fila de acciones, no dos.
            "otro look" ocupaba esta izquierda y se fue (Roberto, 2026-08-12):
            · Regenerar sigue a la mano por DOS caminos — el 👎 abre la hoja de
              razones, que remata con "Ver otro look", y el botón ✦ de la barra
              genera desde cualquier pantalla.
            · Y lo que se pierde es justamente lo que conviene perder: el atajo
              de pedir otro sin decir por qué. Ese atajo es sospechoso número
              uno de que el feedback esté seco (<10% de votos) — si puedes
              saltar sin explicar, no explicas.
            En su lugar sube la promesa del fit check, que antes vivía en una
            tercera fila al pie leyéndose como letra chica. Es la única puerta
            a la señal de oro: merece la posición, no el sótano. */}
        <div
          className={`flex min-h-11 items-center justify-between gap-2 ${!hasRender ? "mt-1.5" : ""}`}
        >
          {onFitCheck ? (
            <button
              type="button"
              onClick={onFitCheck}
              className="flex min-h-11 items-center gap-2 text-left text-[14px] font-semibold text-muted transition-colors hover:text-ink"
            >
              <Icon name="camara" size={16} className="shrink-0" />
              te digo cómo te queda
            </button>
          ) : (
            // El wow y el historial no ofrecen fit check: ahí sigue "otro look".
            <button
              type="button"
              onClick={onOtroLook}
              disabled={disabled}
              className="flex min-h-11 items-center gap-2 text-[14px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              <Icon name="repetir" size={16} /> otro look
            </button>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <span className="mr-0.5 text-[13px] font-semibold text-muted">¿te gusta?</span>
            <VoteButton up={false} active={voto === "down"} onClick={() => onVote(false)} disabled={disabled} />
            <VoteButton up={true} active={voto === "up"} onClick={() => onVote(true)} disabled={disabled} />
          </div>
        </div>

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
