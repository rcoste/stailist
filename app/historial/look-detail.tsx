"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Heart } from "@/components/heart";
import { DownReason } from "@/components/down-reason";
import { TryonView } from "@/components/tryon-view";
import { useTryon } from "@/lib/use-tryon";
import { useWakeLock } from "@/lib/use-wake-lock";
import { ocasionLabel, type HistoryOutfit, type EstadoItem } from "./history-list";

// Detalle del look en Historial — pantalla completa con back real. Mismo lenguaje
// "así te queda" que Hoy/wow (handoff design_handoff_try_on): el try-on ya NO abre
// un modal oscuro, vive DENTRO del detalle como una segunda vista (componente
// TryonView compartido). Lo propio del historial se conserva: back "‹ historial",
// "me lo vuelvo a poner" (re-usar un look pasado) y borrar.
//
// Vista por defecto: si el look ya trae render, abre en "así te queda" (el avatar
// vestido ES la imagen del outfit); si no, en "las prendas" con "verme con este
// look" (que genera el render).

// Parte el nombre en "cabeza" (sans) + "cola" (serif itálica), como Hoy/try-on.
function splitName(nombre: string) {
  const words = nombre.trim().split(" ");
  const tail = words.length > 1 ? words.pop()! : null;
  return { head: words.join(" "), tail };
}

function metaLine(o: HistoryOutfit) {
  return o.occasion ? `${o.fecha} · ${ocasionLabel(o.occasion)}` : o.fecha;
}

export function LookDetail({
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
  /** Borrar el look. Vive aquí (no en la tarjeta) para no ensuciar el diario. */
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
  const [whyOpen, setWhyOpen] = useState(false);

  const generating = t.mode === "gen";
  const hasRender = !!t.image && !generating;
  const canMe = generating || hasRender;
  const tab: "look" | "me" = generating
    ? "me"
    : hasRender
      ? manual ?? "me"
      : "look";

  const { head, tail } = splitName(o.nombre);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Back bar: ‹ historial + corazón */}
      <div className="flex flex-none items-center justify-between px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-1 py-1 text-[15px] font-semibold text-ink"
        >
          <Icon name="chevron" size={19} rotate={180} /> historial
        </button>
        <button
          type="button"
          onClick={onFav}
          aria-pressed={e.fav}
          aria-label={e.fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className="flex h-9 w-9 items-center justify-center"
        >
          <Heart on={e.fav} size={20} />
        </button>
      </div>

      {/* Header: nombre del look (sans + serif) */}
      <div className="flex flex-none flex-wrap items-baseline gap-x-2.5 px-5 pb-2 pt-0.5">
        <h1 className="text-[25px] font-bold leading-none tracking-[-0.02em] text-ink">
          {head}
        </h1>
        {tail ? (
          <>
            <span className="text-sm text-muted">·</span>
            <span className="font-display text-[23px] italic leading-none text-muted">
              {tail}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5">
        {/* Meta: sello "Puesto" (si se puso) + fecha · ocasión */}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          {o.origen === "viaje" ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-[7px] py-0.5 text-[10px] font-semibold text-ink">
              <Icon name="maleta" size={11} /> Viaje
            </span>
          ) : null}
          {e.worn ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-2 py-1 text-[10px] font-bold text-success">
              <Icon name="check" size={11} /> Puesto
            </span>
          ) : null}
          <span className="tabular">{metaLine(o)}</span>
        </div>

        {/* Segmento: pestañas + "por qué" a la derecha */}
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
          {o.explicacion ? (
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              className="ml-auto flex min-h-10 items-center gap-1.5 pb-2.5 pt-1 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              por qué
              <Icon name="chevron" size={14} className={whyOpen ? "rotate-90" : ""} />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            {tab === "look" ? (
              <Grid prendas={o.prendas} />
            ) : (
              <TryonView
                image={t.image}
                generating={generating}
                error={t.mode === "error" ? t.errMsg : null}
                prendas={o.prendas}
                nombre={o.nombre}
                onGenerar={t.generar}
              />
            )}
          </div>

          {/* "por qué este look": la justificación, colapsable. */}
          {whyOpen && o.explicacion ? (
            <div
              className="mt-3 shrink-0 border-t border-line pt-3"
              style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
            >
              <p className="font-display text-[16px] italic leading-[23px] text-muted">
                {o.explicacion}
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer: verme (si no hay render) + votar / me lo vuelvo a poner + borrar */}
        <div className="-mx-5 mt-2 flex-none border-t border-line bg-surface px-5 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-3">
          {!hasRender ? (
            t.mode === "sin_avatar" ? (
              <Link
                href={t.avatarHref}
                className="mb-2.5 flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
              >
                <Icon name="destello" size={18} /> crea tu avatar para verte
              </Link>
            ) : (
              <button
                type="button"
                onClick={t.generar}
                disabled={generating}
                className="mb-2.5 flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
              >
                <Icon name="destello" size={18} />
                {generating ? "te estoy vistiendo…" : "verme con este look"}
                {!generating ? (
                  <span className="text-[12px] font-semibold opacity-70">~20 s</span>
                ) : null}
              </button>
            )
          ) : null}

          <div className="flex gap-2.5">
            <div className="flex flex-none gap-2">
              <VoteButton up active={e.voto === "up"} onClick={() => onVote(true)} />
              <VoteButton up={false} active={e.voto === "down"} onClick={() => onVote(false)} />
            </div>
            <button
              type="button"
              onClick={onRewear}
              disabled={rewearing}
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
            >
              <Icon name="repetir" size={16} />
              {rewearing ? "poniéndomelo…" : "me lo vuelvo a poner"}
            </button>
          </div>

          {e.voto === "down" ? (
            <div className="mt-3">
              <DownReason outfitId={o.id} />
            </div>
          ) : null}

          {/* Borrar: discreto y al final — es la salida, no una acción del día. */}
          <button
            type="button"
            onClick={onDelete}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-error"
          >
            <Icon name="equis" size={14} /> borrar este look
          </button>
        </div>
      </div>
    </div>
  );
}

type Prenda = HistoryOutfit["prendas"][number];

function Tile({ prenda }: { prenda: Prenda }) {
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

// Retícula de 2 columnas que llena el alto disponible (igual que en Hoy).
function Grid({ prendas }: { prendas: Prenda[] }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2 [grid-auto-rows:minmax(0,1fr)]">
      {prendas.map((p, i) => (
        <Tile key={i} prenda={p} />
      ))}
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
      className={`relative flex h-[50px] w-[50px] items-center justify-center rounded-sm border transition-colors ${
        active
          ? "border-ink bg-tile text-ink"
          : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      <Icon name="pulgar" size={18} rotate={up ? 0 : 180} active={active} />
    </button>
  );
}
