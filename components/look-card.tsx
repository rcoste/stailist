"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { DownReason } from "@/components/down-reason";
import { PrendaZoom, type PrendaZoomData } from "@/components/prenda-zoom";
import { TryonView } from "@/components/tryon-view";
import { VER_PRENDA_LABEL } from "@/components/ideal-tile";
import { useTryon } from "@/lib/use-tryon";
import { OCCASIONS } from "@/lib/trip";

// LA CARD DE UN LOOK — pieza ÚNICA para los looks del viaje y los de la cápsula.
// Antes eran dos: la del viaje tenía corazón, voto y zoom, y la de la cápsula era
// una versión pobre (solo fotos y texto) que se fue quedando atrás sin que nadie
// lo notara. Fuente única: lo que se agregue aquí llega a los dos módulos.
//
// El try-on vive AQUÍ y no solo en el Historial: antes, para probarte un look de
// viaje tenías que marcarlo favorito, ir al Historial y probártelo allá.
//
// Y el render es el PROTAGONISTA de la card, no un adjunto: ocupa el lugar de la
// tira de prendas (que se va a una columna al lado) en cuanto existe. La primera
// versión lo dejaba en una miniatura de 42px con un "toca para verlo en grande" —
// un toque de más para ver algo que tarda ~20 s y cuesta en cada generación.
// Reusa TryonView, la misma pieza del detalle del look: la lupa, la animación de
// generación y la voz del coach vienen incluidas.

const OCC_LABEL = new Map(OCCASIONS.map((o) => [o.value as string, o.label]));

export type LookCardPrenda = {
  nombre: string;
  image: string | null;
  /** Id del clóset: habilita generar la foto de la prenda al tocarla. */
  id?: string | null;
};

export type LookCardData = {
  ocasion: string;
  titulo: string;
  porque: string;
  tip: string | null;
  prendas: LookCardPrenda[];
};

// Corazón de favorito (relleno cuando on). Inline porque necesita fill; el Icon
// del set es siempre stroke.
function Heart({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={on ? "text-accent" : "text-muted"}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />
    </svg>
  );
}

export function LookCard({
  look,
  voto,
  favorito,
  onVote,
  onDownReason,
  onFavorite,
  onRenderPrenda,
  rendered = {},
  rendering,
  tryonImage = null,
  ensureOutfitId,
  returnTo,
}: {
  look: LookCardData;
  voto: "up" | "down" | null;
  favorito: boolean;
  onVote: (up: boolean) => void;
  onDownReason: (reason: string) => void;
  onFavorite: (on: boolean) => void;
  /** Render bajo demanda de una prenda sin foto (tap en su recuadro). */
  onRenderPrenda?: (itemId: string) => void;
  rendered?: Record<string, string>;
  rendering?: Set<string>;
  /** Try-on ya generado antes (URL firmada) → arranca mostrando la miniatura. */
  tryonImage?: string | null;
  /** Crea/recupera la fila de outfits de este look. Sin esto no hay try-on. */
  ensureOutfitId?: () => Promise<string | null>;
  /** A dónde vuelve el wizard de avatar si aún no tiene uno. */
  returnTo: string;
}) {
  const [zoom, setZoom] = useState<PrendaZoomData | null>(null);
  const t = useTryon({
    ensureOutfitId,
    initialImage: tryonImage,
    revealMode: "inline",
    returnTo,
  });
  // El render ocupa el sitio de la tira desde que ARRANCA la generación: la
  // animación de TryonView (silueta + prendas que entran) es la espera, y así no
  // hay un salto de layout al terminar.
  const puedeProbar = !!ensureOutfitId;
  const mostrarRender = puedeProbar && (!!t.image || t.mode === "gen");

  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-[var(--shadow-hairline)]">
      <div className="flex items-start justify-between gap-2">
        <div className="pt-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-accent">
          {OCC_LABEL.get(look.ocasion) ?? look.ocasion}
        </div>
        <button
          type="button"
          onClick={() => onFavorite(!favorito)}
          aria-pressed={favorito}
          aria-label={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center"
        >
          <Heart on={favorito} />
        </button>
      </div>

      <h3 className="mt-1 text-[18px] font-semibold leading-tight text-ink">
        {look.titulo}
      </h3>

      {/* El render manda en cuanto existe (o mientras se genera): ocupa el sitio
          de la tira y las prendas pasan a la columna de al lado. */}
      {mostrarRender ? (
        <div className="my-3">
          <TryonView
            fit="ancho"
            image={t.image}
            generating={t.mode === "gen"}
            error={t.mode === "error" ? t.errMsg : null}
            prendas={look.prendas.map((p) => ({
              // El id viaja para que la miniatura abra la ficha de la prenda,
              // igual que en la retícula del detalle.
              id: p.id,
              nombre: p.nombre,
              swatch: "var(--c-tile)",
              imagen: (p.id ? rendered[p.id] : null) ?? p.image,
            }))}
            nombre={look.titulo}
            onGenerar={t.generar}
          />
        </div>
      ) : (
        <div className="my-3 flex gap-[7px]">
          {look.prendas.map((p, j) => {
            const img = (p.id ? rendered[p.id] : null) ?? p.image;
            const isRendering = p.id ? !!rendering?.has(p.id) : false;
            const canRender = !img && !!p.id && !isRendering && !!onRenderPrenda;
            return (
              <button
                key={j}
                type="button"
                onClick={() => {
                  if (img) setZoom({ image: img, nombre: p.nombre });
                  else if (canRender) onRenderPrenda?.(p.id as string);
                }}
                title={p.nombre}
                aria-label={
                  img ? `Ver ${p.nombre}` : canRender ? `Generar ${p.nombre}` : p.nombre
                }
                className="relative aspect-[3/4] flex-1 overflow-hidden rounded-md border border-line bg-bg"
              >
                {img ? (
                  <Image src={img} alt={p.nombre} fill sizes="120px" className="object-cover" />
                ) : isRendering ? (
                  <span className="flex h-full w-full items-center justify-center">
                    <Spinner className="h-4 w-4 text-accent" />
                  </span>
                ) : canRender ? (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-accent">
                    <Icon name="destello" size={16} />
                    <span className="text-center text-[8px] font-bold uppercase leading-tight tracking-wide">
                      {VER_PRENDA_LABEL}
                    </span>
                  </span>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted">
                    <Icon name="gancho" size={18} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="display text-[13.5px] font-medium leading-relaxed text-ink">
        {look.porque}
      </p>
      {look.tip ? (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-accent">
          <Icon name="destello" size={14} className="mt-0.5 shrink-0" />
          <span>{look.tip}</span>
        </p>
      ) : null}

      {/* Una sola fila de acción. Sin render: la primaria es probártelo (negra —
          es la acción que nadie sabe que existe) y los votos van al lado. Con
          render ya no hay nada que generar, así que la fila es solo el voto y
          nada le compite: el feedback es la señal más escasa que tenemos y no
          puede quedar de sobra visual. */}
      <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        {mostrarRender || !puedeProbar ? (
          <span className="text-[11.5px] text-muted">¿te gusta?</span>
        ) : t.mode === "sin_avatar" ? (
          <Link
            href={t.avatarHref}
            className="flex min-h-11 items-center gap-1.5 rounded-sm bg-ink px-3.5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <Icon name="destello" size={15} /> crea tu avatar
          </Link>
        ) : (
          <button
            type="button"
            onClick={t.generar}
            className="flex min-h-11 items-center gap-1.5 rounded-sm bg-ink px-3.5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <Icon name="destello" size={15} /> verme con este look
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <VoteButton
            active={voto === "up"}
            label="Me gusta este look"
            onClick={() => onVote(true)}
          />
          <VoteButton
            active={voto === "down"}
            label="No me gusta este look"
            rotate
            onClick={() => onVote(false)}
          />
        </div>
      </div>

      {/* El error de generación vive fuera del marco cuando aún no hay render
          (dentro del marco solo se ve si el marco existe). */}
      {t.mode === "error" && !t.image ? (
        <p className="mt-2 text-[12px] text-error">{t.errMsg}</p>
      ) : null}

      {voto === "down" ? (
        <div className="mt-3">
          <DownReason onSave={onDownReason} />
        </div>
      ) : null}

      <PrendaZoom data={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}

function VoteButton({
  active,
  label,
  rotate,
  onClick,
}: {
  active: boolean;
  label: string;
  rotate?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`flex h-[34px] w-[34px] items-center justify-center rounded-sm border transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-muted hover:border-ink"
      }`}
    >
      <Icon name="pulgar" size={17} rotate={rotate ? 180 : undefined} active={active} />
    </button>
  );
}
