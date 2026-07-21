"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Heart } from "@/components/heart";
import { Spinner } from "@/components/spinner";
import { DownReason } from "@/components/down-reason";
import { useTryon } from "@/lib/use-tryon";
import { useWakeLock } from "@/lib/use-wake-lock";
import { ocasionLabel, type HistoryOutfit, type EstadoItem } from "./history-list";

// Detalle del look — vista con back real (reemplaza el bottom-sheet). Alineado al
// patrón "el outfit" de Hoy. Dos estados, según la regla de imagen de la app
// (try-on cuando existe; grid de prendas cuando no):
//   3a · SIN avatar — claro: grid de prendas + "verme con este look" (entra al
//        flujo de avatar → genera el try-on).
//   3b · CON avatar — try-on oscuro a sangre (mismo lenguaje que el modal de Hoy),
//        con las acciones propias del historial (votar / me lo vuelvo a poner).
// El back ("‹ historial") siempre cierra el detalle y vuelve al diario.

const firstWord = (n: string) => n.trim().split(" ")[0];

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
    revealMode: "modal",
    returnTo: "/historial",
  });
  // Pantalla despierta mientras se genera el try-on (~20-30s).
  useWakeLock(t.mode === "gen");

  // Oscuro cuando hay foto (3b) o estamos generándola/erroramos. La vista clara
  // (3a) sólo aparece sin foto y sin generación en curso.
  const dark =
    t.mode === "gen" ||
    t.mode === "full" ||
    t.mode === "error" ||
    (!!t.image && t.mode === "idle");

  // "verme con este look": si ya hay foto, ábrela; si no, genérala (revealMode
  // "modal" la abre en grande al terminar). Sin avatar → t.mode pasa a sin_avatar
  // y el CTA se vuelve un link al wizard de avatar.
  function verme() {
    if (t.image) t.openFull();
    else t.generar();
  }

  if (dark) {
    return (
      <DarkDetail
        o={o}
        e={e}
        rewearing={rewearing}
        mode={t.mode}
        image={t.image}
        errMsg={t.errMsg}
        onClose={onClose}
        onVote={onVote}
        onFav={onFav}
        onRewear={onRewear}
        onDelete={onDelete}
        onRetry={t.generar}
      />
    );
  }

  // --- 3a · detalle claro (sin avatar / sin try-on) ---
  const { head, tail } = splitName(o.nombre);
  const cols = o.prendas.length <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg">
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
      <div className="flex flex-none flex-wrap items-baseline gap-x-2.5 px-5 pb-3.5 pt-0.5">
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

      <div className="flex flex-1 flex-col px-5">
        {/* Meta: sello "Puesto" (si se puso) + fecha · ocasión */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
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

        {/* El outfit · N prendas */}
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          el outfit · {o.prendas.length} prendas
        </p>
        <div className={`grid gap-3 ${cols}`}>
          {o.prendas.map((p, i) => (
            <figure key={i} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
                {p.imagen ? (
                  <Image
                    src={p.imagen}
                    alt={p.nombre}
                    fill
                    sizes="(max-width: 430px) 33vw, 130px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="absolute inset-0 flex items-end justify-center pb-2 text-[8.5px] font-bold uppercase tracking-wide text-muted"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, var(--c-line) 0 7px, var(--c-surface) 7px 14px)",
                    }}
                  >
                    sin foto
                  </span>
                )}
              </div>
              <figcaption className="text-[10px] font-bold uppercase leading-tight tracking-[0.05em] text-ink">
                {p.nombre}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* ¿por qué este look? — abre la justificación */}
        {o.explicacion ? <WhyToggle texto={o.explicacion} /> : null}

        {/* Footer: "verme con este look" + votar / me lo vuelvo a poner */}
        <div className="mt-auto pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-4">
          {t.mode === "sin_avatar" ? (
            <Link
              href={t.avatarHref}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Icon name="destello" size={18} /> crea tu avatar para verte
            </Link>
          ) : (
            <button
              type="button"
              onClick={verme}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Icon name="destello" size={18} /> verme con este look
              <span className="text-[12px] font-semibold opacity-70">~20 s</span>
            </button>
          )}

          <div className="mt-2.5 flex gap-2.5">
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
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-error"
          >
            <Icon name="equis" size={14} /> borrar este look
          </button>
        </div>
      </div>
    </div>
  );
}

// Botón de voto cuadrado (3a, claro): relleno negro cuando activo.
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
      className={`flex h-[50px] w-[50px] items-center justify-center rounded-sm border transition-colors ${
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-surface text-ink hover:border-ink"
      }`}
    >
      <Icon name="pulgar" size={18} rotate={up ? 0 : 180} active={active} />
    </button>
  );
}

// "¿por qué este look? ›" — toggle que revela la justificación.
function WhyToggle({ texto }: { texto: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-[18px] border-t border-line pt-[18px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-ink"
      >
        ¿por qué este look?
        <Icon name="chevron" size={15} rotate={open ? 90 : 0} />
      </button>
      {open ? (
        <p className="editorial mt-3 text-center text-[13px] leading-relaxed text-muted">
          {texto}
        </p>
      ) : null}
    </div>
  );
}

// --- 3b · detalle oscuro a sangre (con try-on) + estados de carga/error ---
function DarkDetail({
  o,
  e,
  rewearing,
  mode,
  image,
  errMsg,
  onClose,
  onVote,
  onFav,
  onRewear,
  onDelete,
  onRetry,
}: {
  o: HistoryOutfit;
  e: EstadoItem;
  rewearing: boolean;
  mode: string;
  image: string | null;
  errMsg: string;
  onClose: () => void;
  onVote: (up: boolean) => void;
  onFav: () => void;
  onRewear: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  // Generando: el modal abre oscuro de inmediato y revela la foto al llegar.
  if (mode === "gen") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-accent px-8 text-center">
        <Spinner className="h-10 w-10 text-on-accent" />
        <p className="text-sm font-semibold text-on-accent">Creando tu look…</p>
        <p className="text-xs text-on-accent/60">Tarda unos segundos.</p>
      </div>
    );
  }

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

  const { head, tail } = splitName(o.nombre);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-accent">
      {/* Foto a sangre, a color, con degradado para legibilidad del pie */}
      <div className="absolute inset-0">
        <Image
          src={image}
          alt={`Tú con ${o.nombre}`}
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover object-[50%_12%]"
        />
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgb(10 10 10/.5) 0%, transparent 22%, transparent 38%, rgb(10 10 10/.92) 100%)",
          }}
        />
      </div>

      {/* Back bar: ‹ historial + corazón (claros sobre la foto) */}
      <div className="relative z-[5] flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-[15px] font-semibold text-on-accent"
        >
          <Icon name="chevron" size={19} rotate={180} /> historial
        </button>
        <button
          type="button"
          onClick={onFav}
          aria-pressed={e.fav}
          aria-label={e.fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-on-accent/15 text-on-accent"
        >
          <Heart on={e.fav} size={17} className="text-on-accent" />
        </button>
      </div>

      {/* Sello "Puesto" sobre la imagen */}
      {e.worn ? (
        <span className="relative z-[5] ml-4 mt-3 inline-flex items-center gap-1 self-start rounded-sm bg-success/90 px-2 py-1 text-[10px] font-bold text-white">
          <Icon name="check" size={11} /> Puesto
        </span>
      ) : null}

      {/* Pie: fecha · ocasión, nombre, tira de prendas en vidrio, acciones */}
      <div className="relative z-[5] mt-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-on-accent">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-accent/80">
          {metaLine(o).toUpperCase()}
        </p>
        <h2 className="mt-2 text-[34px] font-bold leading-[0.94] tracking-[-0.035em]">
          {head}{" "}
          {tail ? (
            <em className="font-display font-normal italic tracking-normal text-on-accent/90">
              {tail}
            </em>
          ) : null}
        </h2>

        <div className="mt-4 flex gap-2">
          {o.prendas.slice(0, 4).map((p, i) => (
            <div
              key={i}
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
                {firstWord(p.nombre)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-[18px] flex gap-2.5">
          <DarkVote up active={e.voto === "up"} onClick={() => onVote(true)} />
          <DarkVote up={false} active={e.voto === "down"} onClick={() => onVote(false)} />
          <button
            type="button"
            onClick={onRewear}
            disabled={rewearing}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-sm bg-on-accent text-[15px] font-bold text-accent transition-opacity disabled:opacity-70"
          >
            <Icon name="repetir" size={16} />
            {rewearing ? "poniéndomelo…" : "me lo vuelvo a poner"}
          </button>
        </div>

        {/* Borrar: discreto y al final — es la salida, no una acción del día. */}
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-on-accent/60 transition-colors hover:text-on-accent"
        >
          <Icon name="equis" size={14} /> borrar este look
        </button>
      </div>
    </div>
  );
}

// Botón de voto sobre fondo oscuro (3b): relleno blanco cuando activo.
function DarkVote({
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
      className={`flex h-[50px] w-[50px] flex-none items-center justify-center rounded-sm border transition-colors ${
        active
          ? "border-on-accent bg-on-accent text-accent"
          : "border-on-accent/30 bg-on-accent/15 text-on-accent"
      }`}
    >
      <Icon name="pulgar" size={18} rotate={up ? 0 : 180} active={active} />
    </button>
  );
}
