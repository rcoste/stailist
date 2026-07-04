"use client";

import { useCallback, useContext, useMemo, useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { CapsuleTabsContext } from "@/components/capsule-tabs-context";
import { Spinner } from "@/components/spinner";
import { OwnedPhotoBanner } from "@/components/owned-photo-banner";
import { Toast } from "@/components/toast";
import { faltaImage, familiaToHex, faltaKey } from "@/lib/capsule-images";
import { outfitsNow, unlocksByIndex } from "@/lib/capsule-math";
import { markFaltaOwned, setCapsuleOverride } from "@/app/closet/capsula/actions";
import { toggleWishlistFromCapsule } from "@/lib/wishlist-actions";
import {
  IdealTileInner,
  SelCheck,
  VER_PRENDA_LABEL,
  idealArgs,
  isLightHex,
  useIdealRender,
  type RenderArgs,
} from "@/components/ideal-tile";
import {
  capsuleRows,
  type CapsuleDecision,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleRow,
  type CapsuleTarget,
} from "@/lib/capsule";

// Pantalla completa de la cápsula, "enfocada en lo que falta" (handoff Screen 4):
// lo faltante al frente con su porqué (bigcard), lo que hay que decidir, y lo que
// ya tienes en una fila de miniaturas. Las decisiones sobre las "parecido" son
// OPTIMISTAS: el tap se ve al instante y el guardado va en segundo plano.
export function CapsuleList({
  target,
  match,
  overrides,
  images,
  catalogImages = {},
  savedWishKeys = [],
  userId,
}: {
  target: CapsuleTarget;
  match: CapsuleMatch | null;
  overrides: CapsuleOverrides | null;
  images: Record<string, string>;
  // Imágenes de la biblioteca compartida (combos ideales ya rendereados), por faltaKey.
  catalogImages?: Record<string, string>;
  // faltaKeys de prendas de cápsula ya guardadas en la wishlist (para el estado del botón).
  savedWishKeys?: string[];
  userId: string;
}) {
  const [optOverrides, applyOpt] = useOptimistic(
    overrides ?? {},
    (state: CapsuleOverrides, action: { index: number; decision: CapsuleDecision }) => {
      const next = { ...state };
      const k = String(action.index);
      if (next[k] === action.decision) delete next[k]; // re-elegir lo mismo = deshacer
      else next[k] = action.decision;
      return next;
    }
  );
  const [, startTransition] = useTransition();
  // Cambiar a la pestaña "tus looks" desde el CTA "~N looks" (sin navegar).
  const { onViewLooks } = useContext(CapsuleTabsContext);

  // Caché de sesión de renders bajo demanda (por faltaKey). Sin esto, la URL
  // rendereada vive solo en el estado local del tile que la generó y se pierde
  // al remontar (elegir "la sugerida" → SumaCard, o "ya la tengo" → re-render):
  // el tile volvía a "ver cómo queda". Se fusiona sobre catalogImages para que
  // cualquier instancia nueva arranque ya con la imagen.
  const [rendered, setRendered] = useState<Record<string, string>>({});
  const onRendered = useCallback(
    (key: string, url: string) =>
      setRendered((m) => (m[key] === url ? m : { ...m, [key]: url })),
    []
  );
  const catImgs = useMemo(
    () => ({ ...catalogImages, ...rendered }),
    [catalogImages, rendered]
  );

  // "Ya la tengo" sobre una prenda que te falta: el server la suma al clóset y la
  // marca cubierta; al resolver, Next refresca la página y la prenda se reubica
  // sola en "Ya lo tienes" con el progreso al día. Solo llevamos un spinner por
  // botón mientras tanto (la fuente de verdad es el server, sin doble conteo).
  const [ownBusy, setOwnBusy] = useState<Set<number>>(new Set());
  // Tras "ya la tengo": la prenda recién agregada, para ofrecer subir su foto real
  // (no bloqueante). La fila ya se movió a "Ya lo tienes"; el banner vive aparte.
  const [lastOwned, setLastOwned] = useState<{ itemId: string; nombre: string } | null>(null);

  const decide = (index: number, decision: CapsuleDecision) =>
    startTransition(async () => {
      applyOpt({ index, decision });
      await setCapsuleOverride(index, decision);
    });

  const setBusy = (index: number, on: boolean) =>
    setOwnBusy((s) => {
      const n = new Set(s);
      if (on) n.add(index);
      else n.delete(index);
      return n;
    });

  const markOwned = (index: number, nombre: string) => {
    // setBusy FUERA del transition → update urgente: el spinner aparece al
    // instante. Dentro del transition era baja prioridad y se sentía muerto.
    setBusy(index, true);
    startTransition(async () => {
      const res = await markFaltaOwned(index);
      setBusy(index, false);
      // Ofrece subir la foto real (opcional) de la prenda recién agregada.
      if (res.ok && res.itemId) setLastOwned({ itemId: res.itemId, nombre });
    });
  };

  // Wishlist in-situ: mandar/quitar una prenda que te falta de "lo que deberías
  // comprar", sin sacarla de su sección. Optimista + toast al guardar. La verdad
  // vive en el server (dedup por faltaKey); al recargar, savedWishKeys se refresca.
  const [wishSaved, setWishSaved] = useState<Set<string>>(() => new Set(savedWishKeys));
  const [toast, setToast] = useState<string | null>(null);

  const toggleWish = (row: CapsuleRow) => {
    const key = faltaKey(row.item);
    const willSave = !wishSaved.has(key);
    setWishSaved((s) => {
      const n = new Set(s);
      if (willSave) n.add(key);
      else n.delete(key);
      return n;
    });
    if (willSave) {
      setToast("Guardada en tu wishlist");
      setTimeout(() => setToast(null), 2200);
    }
    startTransition(async () => {
      await toggleWishlistFromCapsule({
        capsuleKey: key,
        name: row.item.nombre,
        colorHex: familiaToHex(row.item.colorFamilia),
        imageUrl: rowImage(row, images, catImgs),
        porque: row.item.porque,
      });
    });
  };

  const rows = capsuleRows(target, match, optOverrides);
  const total = rows.length;
  const have = rows.filter((r) => r.covered).length;
  const pct = total ? Math.round((100 * have) / total) : 0;

  // El gancho: cuántos looks armas hoy + cuántos desbloquea cada prenda que falta.
  // (Optimista: aceptar un "parecido" sube el conteo al instante.)
  const looks = outfitsNow(rows);
  const unlocks = unlocksByIndex(rows);
  const unlockOf = (r: CapsuleRow) => unlocks.get(r.index) ?? 0;
  // ¿Hay alguna prenda que falta que de verdad desbloquee looks? (vs solo accesorios,
  // que rematan pero no multiplican). Evita prometer "desbloquea más" cuando no aplica.
  const maxUnlock = rows.reduce((m, r) => (r.base === "falta" ? Math.max(m, unlockOf(r)) : m), 0);

  // Agrupamos por estado BASE (lo que dijo el match) para que una "parecido" ya
  // decidida no salte de sección. Sin match → todo "pendiente".
  const byPrio = (a: CapsuleRow, b: CapsuleRow) => a.item.prioridad - b.item.prioridad;
  const pendiente = rows.filter((r) => r.base === "pendiente").sort(byPrio);
  const tienes = rows.filter((r) => r.base === "tienes").sort(byPrio);
  // Lo que falta, ordenado por lo que MÁS te suma (desbloquea más looks); a igualdad, prioridad.
  const falta = rows
    .filter((r) => r.base === "falta")
    .sort((a, b) => unlockOf(b) - unlockOf(a) || byPrio(a, b));
  const decidir = rows.filter((r) => r.base === "parecido").sort(byPrio);

  return (
    <div className="flex flex-col gap-7">
      <Toast message={toast} />

      {lastOwned ? (
        <OwnedPhotoBanner
          itemId={lastOwned.itemId}
          nombre={lastOwned.nombre}
          userId={userId}
          onDismiss={() => setLastOwned(null)}
        />
      ) : null}

      {/* Resumen: eyebrow + "N de M" + barra. */}
      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Tu cápsula ideal
          </span>
          <span className="display text-[16px] font-semibold text-ink">
            {match ? (
              <>
                <span className="tabular">{have}</span>{" "}
                <span className="text-xs text-muted">
                  de <span className="tabular">{total}</span>
                </span>
              </>
            ) : (
              <span className="tabular text-xs text-muted">{total} piezas</span>
            )}
          </span>
        </div>
        {match ? (
          <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {match ? (
          <p className="mt-2.5 text-[12.5px] leading-snug text-muted">
            {looks > 0 ? (
              <>
                Con lo que ya tienes armas{" "}
                <button
                  type="button"
                  onClick={onViewLooks}
                  className="inline-flex items-center gap-0.5 font-semibold text-accent underline decoration-accent/30 underline-offset-2"
                >
                  ~{looks} looks
                  <Icon name="chevron" size={12} />
                </button>
                .
                {maxUnlock > 0
                  ? " Completa tu base para desbloquear muchos más."
                  : falta.length > 0
                    ? " Lo de abajo le da el remate."
                    : ""}
              </>
            ) : (
              "Estás a unas piezas de tus primeros looks completos — abajo, las que más suman."
            )}
          </p>
        ) : null}
      </div>

      {/* Sin match: la cápsula ideal como lista simple (el botón "calcular" vive
          en la página). */}
      {pendiente.length > 0 ? (
        <Section title="Tu cápsula ideal" count={pendiente.length}>
          <ul className="flex flex-col gap-2.5">
            {pendiente.map((r) => (
              <BigCard
                key={rowKey(r)}
                row={r}
                images={images}
                catalogImages={catImgs}
                onRendered={(url) => onRendered(faltaKey(r.item), url)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {falta.length > 0 ? (
        <Section title="Lo que más te suma" count={falta.length}>
          <ul className="flex flex-col gap-2.5">
            {falta.map((r) => (
              <SumaCard
                key={rowKey(r)}
                row={r}
                catalogImages={catImgs}
                onRendered={(url) => onRendered(faltaKey(r.item), url)}
                unlock={unlockOf(r)}
                ownBusy={ownBusy.has(r.index)}
                onOwn={() => markOwned(r.index, r.item.nombre)}
                wishSaved={wishSaved.has(faltaKey(r.item))}
                onToggleWish={() => toggleWish(r)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {decidir.length > 0 ? (
        <Section title="Decide si te sirve" count={decidir.length}>
          <ul className="flex flex-col gap-2.5">
            {decidir.map((r) => (
              <DecideRow
                key={rowKey(r)}
                row={r}
                images={images}
                catalogImages={catImgs}
                onRendered={(url) => onRendered(faltaKey(r.item), url)}
                onDecide={decide}
                ownBusy={ownBusy.has(r.index)}
                onOwn={() => markOwned(r.index, r.item.nombre)}
                wishSaved={wishSaved.has(faltaKey(r.item))}
                onToggleWish={() => toggleWish(r)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {tienes.length > 0 ? (
        <Section title="Ya lo tienes" count={tienes.length}>
          <Rail rows={tienes} images={images} catalogImages={catImgs} />
        </Section>
      ) : null}
    </div>
  );
}

const rowKey = (r: CapsuleRow) => `${r.item.tipo}-${r.item.nombre}`;

// Imagen para una fila: la del clóset (por `by`) o, si es ideal (falta/pendiente),
// la de la biblioteca compartida y luego la curada estática del catálogo.
function rowImage(
  r: CapsuleRow,
  images: Record<string, string>,
  catalogImages: Record<string, string>
): string | null {
  const own = r.by ? images[r.by] : null;
  if (own) return own;
  if (r.base === "falta" || r.base === "pendiente") {
    return catalogImages[faltaKey(r.item)] ?? faltaImage(r.item);
  }
  return null;
}

// Miniatura de prenda con fallback DIGNO: si no hay imagen, un swatch del color de
// la prenda + un gancho (nunca un hueco vacío). Si recibe `renderArgs` (prenda
// sugerida ideal), el placeholder es un botón "ver" → genera la imagen bajo demanda
// (biblioteca compartida) y la muestra. `colorFamilia` viene del item ideal.
function Thumb({
  src,
  colorFamilia,
  sizes,
  icon = 18,
  renderArgs,
  onRendered,
}: {
  src: string | null;
  colorFamilia: string;
  sizes: string;
  icon?: number;
  renderArgs?: RenderArgs;
  // Reporta la URL rendereada al caché de sesión (ver useIdealRender.onReady).
  onRendered?: (url: string) => void;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = src ?? generated;
  if (shown) return <Image src={shown} alt="" fill sizes={sizes} className="object-cover" />;

  const hex = familiaToHex(colorFamilia);
  const light = isLightHex(hex);
  const tone = light ? "text-ink/45" : "text-white/65";

  if (!renderArgs) {
    return (
      <span className="flex h-full w-full items-center justify-center" style={{ background: hex }}>
        <Icon name="gancho" size={icon} className={light ? "text-ink/35" : "text-white/55"} />
      </span>
    );
  }

  const onRender = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/render-ideal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderArgs),
      });
      const j = (await res.json().catch(() => null)) as { url?: string } | null;
      if (j?.url) {
        setGenerated(j.url);
        onRendered?.(j.url);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onRender}
      disabled={busy}
      className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 disabled:opacity-80"
      style={{ background: hex }}
      title={VER_PRENDA_LABEL}
    >
      {busy ? (
        <Spinner className={`h-4 w-4 ${tone}`} />
      ) : (
        <>
          <Icon name="destello" size={icon} className={tone} />
          <span className={`text-center text-[9px] font-semibold leading-tight ${tone}`}>
            {VER_PRENDA_LABEL}
          </span>
        </>
      )}
    </button>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {title}
        </span>
        <span className="tabular text-[11px] text-muted">{count}</span>
      </div>
      {children}
    </div>
  );
}

// Tarjeta grande para lo que falta / la cápsula ideal: miniatura 56×72 + nombre
// (Instrument Serif) + porqué + control a la derecha (p. ej. "ya la tengo").
function BigCard({
  row,
  images,
  catalogImages,
  onRendered,
  right,
  unlock,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  catalogImages: Record<string, string>;
  onRendered?: (url: string) => void;
  right?: React.ReactNode;
  unlock?: number;
}) {
  const src = rowImage(row, images, catalogImages);
  return (
    <li className="flex items-center gap-[13px] rounded-lg border border-line bg-surface p-[13px]">
      <span className="relative h-[72px] w-[56px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg">
        <Thumb
          src={src}
          colorFamilia={row.item.colorFamilia}
          sizes="56px"
          onRendered={onRendered}
          renderArgs={{
            tipo: row.item.tipo,
            colorFamilia: row.item.colorFamilia,
            nombre: row.item.nombre,
            categoria: row.item.category,
            formalidad: row.item.formalidad,
            temporada: row.item.temporada,
            visual: row.item.visual,
          }}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold leading-tight text-ink">
          {row.item.nombre}
        </span>
        {unlock && unlock > 0 ? (
          <span className="mt-1 flex w-fit items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-[2px] text-[10.5px] font-semibold text-accent">
            <Icon name="destello" size={11} /> desbloquea ~{unlock} looks
          </span>
        ) : null}
        <span className="mt-1 text-[11.5px] leading-snug text-muted">{row.item.porque}</span>
      </div>
      {right ? <span className="shrink-0">{right}</span> : null}
    </li>
  );
}

// Tarjeta grande para "lo que más te suma" (y para el estado "quiero la sugerida"
// de Decide): tile grande tappable que GENERA la imagen enfrente + cuerpo con
// nombre/porqué y la fila de acciones "ya la tengo" · "wishlist".
function SumaCard({
  row,
  catalogImages,
  onRendered,
  unlock,
  ownBusy,
  onOwn,
  wishSaved,
  onToggleWish,
  reject,
  onChange,
}: {
  row: CapsuleRow;
  catalogImages: Record<string, string>;
  onRendered?: (url: string) => void;
  unlock?: number;
  ownBusy: boolean;
  onOwn: () => void;
  wishSaved: boolean;
  onToggleWish: () => void;
  reject?: boolean;
  onChange?: () => void;
}) {
  const { item } = row;
  // SIEMPRE la imagen ideal/sugerida — nunca la de la prenda del clóset (`by`):
  // esta tarjeta representa "la sugerida" (en falta y al rechazar un parecido).
  // Usar rowImage aquí mostraba la prenda que ya tienes al elegir la sugerida.
  const idealSrc = catalogImages[faltaKey(item)] ?? faltaImage(item);
  const render = useIdealRender(idealArgs(item), idealSrc, onRendered);
  const onTapTile = () => {
    if (render.state === "idle") void render.start();
  };
  return (
    <li className="relative flex overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onTapTile}
        className="relative flex min-h-[148px] w-[118px] shrink-0 items-center justify-center self-stretch overflow-hidden border-r border-line"
      >
        <IdealTileInner render={render} colorFamilia={item.colorFamilia} sizes="118px" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-[15px] pb-[13px] pt-[14px]">
        {reject ? (
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10.5px] leading-snug text-muted">
              preferiste la sugerida — sigue en lo que falta
            </span>
            {onChange ? (
              <button
                type="button"
                onClick={onChange}
                className="shrink-0 text-[11px] font-medium text-accent underline underline-offset-2"
              >
                cambiar
              </button>
            ) : null}
          </div>
        ) : unlock && unlock > 0 ? (
          <span className="flex w-fit items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-[2px] text-[10.5px] font-semibold text-accent">
            <Icon name="destello" size={11} /> desbloquea ~{unlock} looks
          </span>
        ) : null}
        <span className="text-[15px] font-semibold leading-tight text-ink">{item.nombre}</span>
        <span className="text-[11.5px] leading-snug text-muted">{item.porque}</span>

        <div className="mt-auto flex items-center gap-[9px]">
          <button
            type="button"
            onClick={onOwn}
            disabled={ownBusy}
            className={`flex min-h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm border bg-surface px-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-accent disabled:opacity-50 ${
              render.state === "ready" ? "border-accent" : "border-line"
            }`}
          >
            {ownBusy ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Icon name="mas" size={14} strokeWidth={2} />
            )}
            {ownBusy ? "agregando…" : "ya la tengo"}
          </button>
          <button
            type="button"
            onClick={onToggleWish}
            aria-pressed={wishSaved}
            className={`flex min-h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm border px-2.5 text-[13px] font-semibold transition-colors ${
              wishSaved
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink hover:border-accent"
            }`}
          >
            <Icon name={wishSaved ? "bookmarkFill" : "bookmark"} size={14} />
            {wishSaved ? "en wishlist" : "wishlist"}
          </button>
        </div>
      </div>
    </li>
  );
}

// "Ya lo tienes": fila horizontal de miniaturas (46px, 3:4) + celda "+N" si hay
// más de las que se muestran.
function Rail({
  rows,
  images,
  catalogImages,
}: {
  rows: CapsuleRow[];
  images: Record<string, string>;
  catalogImages: Record<string, string>;
}) {
  const MAX = 7;
  const shown = rows.slice(0, MAX);
  const extra = rows.length - shown.length;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {shown.map((r) => {
        const src = rowImage(r, images, catalogImages);
        return (
          <span
            key={rowKey(r)}
            className="relative aspect-[3/4] w-[46px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg"
            title={r.item.nombre}
          >
            <Thumb src={src} colorFamilia={r.item.colorFamilia} sizes="46px" icon={15} />
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="flex aspect-[3/4] w-[46px] shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-xs font-semibold text-muted">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

// Las "parecido": se deciden en su lugar con "elige tocando" (adiós al cruce de
// botones Sí/No). Sin decidir → tocas la prenda que prefieres → se marca → barra
// que NOMBRA el veredicto → Confirmar. Aceptada → estado marcado con "cambiar";
// rechazada ("quiero la sugerida") → adopta la SumaCard (tile + acciones).
function DecideRow({
  row,
  images,
  catalogImages,
  onRendered,
  onDecide,
  ownBusy,
  onOwn,
  wishSaved,
  onToggleWish,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  catalogImages: Record<string, string>;
  onRendered?: (url: string) => void;
  onDecide: (index: number, decision: CapsuleDecision) => void;
  ownBusy: boolean;
  onOwn: () => void;
  wishSaved: boolean;
  onToggleWish: () => void;
}) {
  const { item, by, decision, index } = row;
  const src = by ? images[by] : null;
  const idealSrc = catalogImages[faltaKey(item)] ?? faltaImage(item);
  const render = useIdealRender(idealArgs(item), idealSrc, onRendered);
  const [sel, setSel] = useState<null | "ideal" | "tuya">(null);

  const onTapIdeal = async () => {
    if (render.state === "ready") {
      setSel("ideal");
      return;
    }
    if (render.state === "generating") return;
    const ok = await render.start();
    if (ok) setSel("ideal");
  };

  if (decision === "accept") {
    return (
      <li className="flex items-center gap-2.5 rounded-md border border-line bg-accent-soft p-3.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="check" size={13} strokeWidth={2.4} />
        </span>
        {/* Lidera con TU prenda (lo que elegiste), no con la ideal: la palomita
            + el nombre ideal se leían como "elegí la ideal" cuando en realidad
            optaste por la tuya. */}
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">
            {by ? `Tu ${by}` : item.nombre}
          </span>
          {by ? (
            <span className="truncate text-xs text-muted">
              cubre el hueco de “{item.nombre}”
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDecide(index, "accept")}
          className="ml-auto shrink-0 text-xs font-medium text-accent underline underline-offset-2"
        >
          cambiar
        </button>
      </li>
    );
  }

  if (decision === "reject") {
    return (
      <SumaCard
        row={row}
        catalogImages={catalogImages}
        onRendered={onRendered}
        ownBusy={ownBusy}
        onOwn={onOwn}
        wishSaved={wishSaved}
        onToggleWish={onToggleWish}
        reject
        onChange={() => onDecide(index, "reject")}
      />
    );
  }

  // Sin decidir — "elige tocando": la sugerida (la que falta) vs la tuya. Tocar la
  // sugerida sin imagen la GENERA antes de poder elegirla (nunca eliges un vacío).
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-[13px]">
      <div className="flex flex-col">
        <span className="text-[15px] font-semibold leading-tight text-ink">{item.nombre}</span>
        <span className="mt-0.5 text-[11.5px] leading-snug text-muted">{item.porque}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {/* LA SUGERIDA (la que falta) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-accent">
            la sugerida
          </span>
          <button
            type="button"
            onClick={onTapIdeal}
            className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm border bg-tile ${
              sel === "ideal" ? "border-accent shadow-[0_0_0_2px] shadow-accent" : "border-line"
            }`}
          >
            <IdealTileInner render={render} colorFamilia={item.colorFamilia} sizes="120px" />
            {sel === "ideal" ? <SelCheck /> : null}
          </button>
          <span className="truncate text-[11px] font-medium text-ink">
            {item.nombre} <span className="font-normal text-muted">· la que falta</span>
          </span>
        </div>

        {/* YA LA TIENES (tu prenda) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
            ya la tienes
          </span>
          <button
            type="button"
            onClick={() => setSel("tuya")}
            className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm border bg-tile ${
              sel === "tuya" ? "border-accent shadow-[0_0_0_2px] shadow-accent" : "border-line"
            }`}
          >
            {src ? (
              <Image src={src} alt={by ?? ""} fill sizes="120px" className="object-cover" />
            ) : (
              <Icon name="gancho" size={20} className="text-muted" />
            )}
            {sel === "tuya" ? <SelCheck /> : null}
          </button>
          <span className="truncate text-[11px] font-medium text-ink">
            {by} <span className="font-normal text-muted">· en tu clóset</span>
          </span>
        </div>
      </div>

      {sel === null ? (
        <p className="text-center text-[11.5px] text-muted">
          Toca la prenda que prefieras para este hueco
        </p>
      ) : (
        <div className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">
            {sel === "tuya" ? (
              <>
                Te quedas con tus <b>{by}</b>
                <span className="block text-[10.5px] text-muted">
                  cubren el hueco de “{item.nombre}”
                </span>
              </>
            ) : (
              <>
                Quieres los <b>{item.nombre}</b>
                <span className="block text-[10.5px] text-muted">
                  siguen en tu lista de lo que falta
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => onDecide(index, sel === "tuya" ? "accept" : "reject")}
            className="min-h-10 shrink-0 rounded-sm bg-accent px-4 text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-deep"
          >
            Confirmar
          </button>
        </div>
      )}
    </li>
  );
}
