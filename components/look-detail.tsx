"use client";

import { useState, type ReactNode } from "react";
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
  bajoVotoNegativo,
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
}: {
  nombre: string;
  prendas: LookDetailPrenda[];
  justificacion: string;
  tip?: string | null;
  outfitId: string;
  initialFavorited: boolean;
  voto: "up" | "down" | null;
  onVote: (up: boolean) => void;
  /** Lo que aparece justo debajo de la fila de votos cuando el voto es 👎.
   *  El wow mete aquí "¿probamos otro de los tres?" con los otros dos looks:
   *  la persona dice que no le gustó ANTES de pedir otro, que es la señal que
   *  el botón suelto se saltaba (Hoy lo quitó por lo mismo, 2026-08-12). */
  bajoVotoNegativo?: ReactNode;
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
}) {
  // Vista elegida a mano; si es null, el default sale del estado del render.
  const [manual, setManual] = useState<"look" | "me" | null>(null);

  const hasRender = !!tryonImage && !generating;
  const canMe = generating || hasRender;
  // Generando fuerza "así te queda"; con render, default "así te queda" salvo
  // que el usuario haya tocado "las prendas".
  // EL VOTO ES EL CONTINUAR (2026-09-16). Con el render listo la pantalla se
  // quedaba sin siguiente paso: la primaria negra desaparecía y lo único que
  // quedaba eran dos pulgares chicos que, al tocarlos, no llevaban a ningún
  // lado. Roberto propuso un "continuar" grande que regresara a Inicio aun sin
  // calificar. No se hizo así por un dato: el wow ya tiene esa salida grande
  // ("entrar a la app") y sólo 5 de 24 votan su primer look — con un botón para
  // saltarse el voto, se lo saltan. Aquí el voto ocupa la primaria y el 👍 es
  // el que continúa (lo decide quien pasa `onVote`); la salida sin calificar
  // existe, pero es el "‹ inicio" de arriba, sin competir con el voto.
  // No aplica al wow: ahí la primaria es "entrar a la app".
  //
  // SIEMPRE que hay render, voten o no. La primera versión sólo lo ponía si el
  // look llegaba sin voto ("no pedir votar dos veces") y el resultado fue un
  // trío con dos pies distintos: el look 1 ya votado con la fila chica, el 2
  // con los botones grandes. Roberto lo leyó como falla. Ahora el voto hecho se
  // ve marcado en el mismo botón, y el 👍 marcado sigue sirviendo de continuar.
  const votoPrincipal = hasRender && !enterApp;

  const tab: "look" | "me" = generating
    ? "me"
    : hasRender
      ? manual ?? "me"
      : "look";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* SIN TÍTULO VISIBLE (2026-09-16). El nombre del look ("Saco y Mocasín
          de Domingo") ocupaba dos renglones de 27px y no le decía nada a nadie:
          las prendas ya están a la vista y el "por qué" explica el look mejor
          que un apodo. Roberto: "no agrega nada de valor y quita bastante
          espacio". Esos ~40px regresan a la foto.
          Se queda como h1 para lectores de pantalla (la página necesita un
          titular) y el nombre sigue vivo donde SÍ identifica algo: el diario,
          el render compartido. La fecha, cuando el look no es de hoy, sigue
          como eyebrow — ésa sí es información. */}
      <h1 className="sr-only">{nombre}</h1>
      {seccionLabel ? (
        <span className="pb-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-faint">
          {seccionLabel}
        </span>
      ) : null}

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Pestañas (vistas del look) + corazón a la derecha. El coach ya NO vive
            aquí: es una voz, no una vista — se fue al pie (CoachPie). */}
        <div className="flex items-center gap-1 border-b border-line">
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
        ) : votoPrincipal ? (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onVote(false)}
              disabled={disabled}
              aria-pressed={voto === "down"}
              className={`flex h-[54px] flex-1 items-center justify-center gap-2 rounded-sm border text-[15px] font-semibold transition-colors disabled:opacity-50 ${
                voto === "down"
                  ? "border-ink bg-tile text-ink"
                  : "border-line bg-surface text-ink hover:border-ink"
              }`}
            >
              <Icon name="pulgar" size={17} className="rotate-180" /> no es para mí
            </button>
            <button
              type="button"
              onClick={() => onVote(true)}
              disabled={disabled}
              aria-pressed={voto === "up"}
              className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              {voto === "up" ? (
                <>
                  <Icon name="check" size={17} /> te encanta
                </>
              ) : (
                <>
                  <Icon name="pulgar" size={17} /> me encanta
                </>
              )}
            </button>
          </div>
        ) : null}

        {/* La fila del voto, sola.
            Su izquierda la ocupó primero "otro look" (se fue el 2026-08-12:
            pedir otro vive bajo el 👎, que obliga a decir por qué) y después
            "te digo cómo te queda", la puerta al fit check. Esa también se fue
            (2026-09-16), por dos razones:
            · Se leía desconectada del look. Recién generado todavía no te lo
              has puesto, así que ofrecer feedback de cómo te queda no tiene
              con qué — y encima rimaba con la pestaña "así te queda", que es
              otra cosa (el render).
            · Y no estaba conectada: el fit check crea un look NUEVO a partir
              de la foto, no marca ESTE como puesto.
            La puerta al fit check sigue en Inicio, donde es la protagonista. */}
        {votoPrincipal ? null : (
          <div
            className={`flex min-h-11 items-center justify-end gap-2 ${!hasRender ? "mt-1.5" : ""}`}
          >
            <div className="flex shrink-0 items-center gap-2">
              <span className="mr-0.5 text-[13px] font-semibold text-muted">¿te gusta?</span>
              <VoteButton up={false} active={voto === "down"} onClick={() => onVote(false)} disabled={disabled} />
              <VoteButton up={true} active={voto === "up"} onClick={() => onVote(true)} disabled={disabled} />
            </div>
          </div>
        )}

        {voto === "down" && bajoVotoNegativo ? bajoVotoNegativo : null}

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
