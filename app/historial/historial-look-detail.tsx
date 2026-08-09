"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Heart } from "@/components/heart";
import { DownReason } from "@/components/down-reason";
import { CoachPie } from "@/components/coach-pie";
import { PrendasGrid } from "@/components/prendas-grid";
import { TryonView } from "@/components/tryon-view";
import { useTryon } from "@/lib/use-tryon";
import { useWakeLock } from "@/lib/use-wake-lock";
import { ocasionLabel, type HistoryOutfit, type EstadoItem } from "./history-list";

// Detalle del look en Historial — misma anatomía v2 que el detalle de Hoy
//
// Se llama HistorialLookDetail y NO LookDetail a secas: había DOS componentes
// con ese nombre (éste y components/look-detail.tsx, el de Hoy y el wow), y era
// el único nombre repetido del repo. Cuesta caro — al añadir el acuse del
// corazón se editó uno y se probó el otro, y por un rato pareció que el arreglo
// estaba roto. El nombre ahora dice de cuál se habla.
// (handoff design_handoff_look_detalle_v2): back en vez de wordmark, nombre en
// serif + sub de fecha, pestañas con corazón y ⋯ a la derecha, pie del coach, y
// la TAB BAR VISIBLE (el overlay termina arriba de ella — antes la tapaba).
// Lo propio del historial: "me lo vuelvo a poner" y borrar (en el menú ⋯).
// Compartir vive en la lupa (arriba a la derecha), no en este menú.

export function HistorialLookDetail({
  o,
  e,
  rewearing,
  onClose,
  onVote,
  onFav,
  onRewear,
  onDelete,
}: {
  o: HistoryOutfit;
  e: EstadoItem;
  rewearing: boolean;
  onClose: () => void;
  onVote: (up: boolean) => void;
  onFav: () => void;
  onRewear: () => void;
  /** Borrar el look (vive en el menú ⋯; la confirmación la pone el padre). */
  onDelete: () => void;
}) {
  const t = useTryon({
    outfitId: o.id,
    initialImage: o.tryonImage,
    revealMode: "inline",
    returnTo: "/historial",
  });
  // Pantalla despierta mientras se genera el try-on (~20-30s).
  useWakeLock(t.mode === "gen");

  const [manual, setManual] = useState<"look" | "me" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const generating = t.mode === "gen";
  const hasRender = !!t.image && !generating;
  const canMe = generating || hasRender;
  const tab: "look" | "me" = generating
    ? "me"
    : hasRender
      ? manual ?? "me"
      : "look";

  // "espejo" es una clave interna, no algo que decirle a nadie: el subtítulo
  // decía "8 ago · espejo". Lo que significa esa entrada es que se lo puso.
  const sub =
    o.origen === "espejo"
      ? `${o.fecha} · me lo puse`
      : o.occasion
        ? `${o.fecha} · ${ocasionLabel(o.occasion).toLowerCase()}`
        : o.fecha;

  return (
    // El overlay termina ARRIBA de la tab bar (z-30 < z-40 de la barra): el
    // detalle convive con la navegación, como en Hoy. En desktop (lg) la barra
    // no existe → el overlay vuelve a llegar al fondo.
    <div className="fixed inset-x-0 top-0 z-30 flex flex-col bg-bg bottom-[calc(57px+env(safe-area-inset-bottom))] lg:bottom-0">
      {/* Back: ‹ historial (sustituye al wordmark; el corazón vive abajo). */}
      <div className="flex flex-none items-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 items-center gap-1.5 px-1 text-[15px] font-semibold text-ink"
        >
          <Icon name="chevron" size={19} rotate={180} /> historial
        </button>
      </div>

      {/* Nombre en serif + sub de fecha (+ sellos que el mock no cubre pero no
          se pierden: Puesto y Viaje). */}
      <div className="flex-none px-4 pt-1">
        <h1 className="font-display text-[27px] italic leading-[29px] text-ink">
          {o.nombre}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {o.origen === "viaje" ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-[7px] py-0.5 text-[10px] font-semibold text-ink">
              <Icon name="maleta" size={11} /> Viaje
            </span>
          ) : null}
          {e.worn ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
              <Icon name="check" size={11} /> Puesto
            </span>
          ) : null}
          <span className="tabular">{sub}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4">
        {/* Pestañas + corazón + ⋯ (el menú cuelga del contenedor relativo de la
            fila — nunca un top absoluto medido a ojo). */}
        <div className="relative mt-2 flex items-center gap-1 border-b border-line">
          <SegTab
            label="las prendas"
            active={tab === "look"}
            onClick={() => setManual("look")}
          />
          {canMe ? (
            <SegTab
              // En una entrada del espejo NO es un render de cómo te QUEDARÍA:
              // es la foto de cómo saliste. Llamarla igual sería vender un
              // avatar donde hay una foto real.
              label={o.origen === "espejo" ? "tu foto" : "así te queda"}
              active={tab === "me"}
              pulse={generating}
              onClick={() => setManual("me")}
            />
          ) : null}
          <div className="ml-auto flex gap-2 self-center pb-1.5">
            <button
              type="button"
              onClick={onFav}
              aria-pressed={e.fav}
              aria-label={e.fav ? "Quitar de favoritos" : "Guardar en favoritos"}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:border-ink after:absolute after:-inset-1 after:content-['']"
            >
              <Heart on={e.fav} size={17} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="más opciones"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink after:absolute after:-inset-1 after:content-['']"
            >
              <Icon name="puntos" size={18} />
            </button>
          </div>

          {menuOpen ? (
            <>
              {/* Cierra al tocar fuera. */}
              <button
                type="button"
                aria-label="cerrar menú"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-[8] cursor-default"
              />
              <div
                className="absolute right-0 top-[calc(100%+7px)] z-[9] min-w-[186px] border border-line bg-surface shadow-[0_14px_34px_-14px_rgba(0,0,0,0.28)]"
                style={{ animation: "var(--dur-short) var(--ease-enter) step-in" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex min-h-[46px] w-full items-center gap-2.5 px-3.5 text-left text-sm font-medium text-error transition-colors hover:bg-bg"
                >
                  <Icon name="equis" size={16} /> borrar este look
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* Cuerpo: retícula flexible o render + columna (mismas piezas que Hoy). */}
        {tab === "look" ? (
          <div className="mt-2.5 min-h-0 flex-1">
            <PrendasGrid prendas={o.prendas} />
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <TryonView
              image={t.image}
              generating={generating}
              error={t.mode === "error" ? t.errMsg : null}
              prendas={o.prendas}
              nombre={o.nombre}
              // SIN "rehacer" en el espejo, y no es cosmético: regenerar
              // escribiría un try-on, y la imagen del try-on GANA sobre la foto
              // — o sea que el botón le cambiaría su foto real por un avatar
              // dibujado, sin avisar y sin vuelta atrás.
              onGenerar={o.origen === "espejo" ? undefined : t.generar}
            />
          </div>
        )}

        {/* El pie del coach (por qué ⇄ cómo llevarlo). */}
        {o.explicacion ? <CoachPie porQue={o.explicacion} como={o.tip} /> : null}

        {/* Botonera: verme (si no hay render) + me lo vuelvo a poner + votos. */}
        <div className="-mx-4 mt-2 flex-none border-t border-line bg-surface px-4 pb-4 pt-2.5">
          {/* NADA DE GENERAR TRY-ON EN EL ESPEJO. Ésta era la otra puerta —la
              del pie, no la de TryonView— y hace lo mismo: escribe un try-on, y
              el try-on GANA sobre la foto al resolver la imagen. O sea que este
              botón le cambiaría su foto real por un avatar dibujado. En una
              entrada del espejo no hay nada que imaginar: ya se lo puso. */}
          {!hasRender && o.origen !== "espejo" ? (
            t.mode === "sin_avatar" ? (
              <Link
                href={t.avatarHref}
                className="mb-2 flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
              >
                <Icon name="destello" size={18} /> crea tu avatar para verte
              </Link>
            ) : (
              <button
                type="button"
                onClick={t.generar}
                disabled={generating}
                className="mb-2 flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
              >
                <Icon name="destello" size={18} />
                {generating ? "te estoy vistiendo…" : "verme con este look"}
                {!generating ? (
                  <span className="text-[12px] font-semibold opacity-70">~20 s</span>
                ) : null}
              </button>
            )
          ) : null}

          <div className="flex min-h-11 items-center justify-between">
            <button
              type="button"
              onClick={onRewear}
              disabled={rewearing}
              className="flex min-h-11 items-center gap-2 text-[14px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              <Icon name="repetir" size={16} />
              {rewearing ? "poniéndomelo…" : "me lo vuelvo a poner"}
            </button>
            <div className="flex items-center gap-2">
              <span className="mr-0.5 text-[13px] font-semibold text-muted">
                ¿te gustó?
              </span>
              <VoteButton up={false} active={e.voto === "down"} onClick={() => onVote(false)} />
              <VoteButton up active={e.voto === "up"} onClick={() => onVote(true)} />
            </div>
          </div>

          {e.voto === "down" ? (
            <div className="mt-2.5">
              <DownReason outfitId={o.id} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Pestaña del segmento (igual que en el detalle de Hoy).
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

// Voto en círculo ghost (mismo lenguaje que Hoy).
function VoteButton({
  up,
  active,
  onClick,
}: {
  up: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={up ? "Me gusta" : "No me gusta"}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors after:absolute after:-inset-0.5 after:content-[''] ${
        active
          ? "border-ink bg-tile text-ink"
          : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      <Icon name="pulgar" size={17} className={up ? "" : "rotate-180"} />
    </button>
  );
}
