"use client";

import { useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { faltaImage, familiaToHex } from "@/lib/capsule-images";
import { outfitsNow, unlocksByIndex } from "@/lib/capsule-math";
import { markFaltaOwned, setCapsuleOverride } from "@/app/closet/capsula/actions";
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
}: {
  target: CapsuleTarget;
  match: CapsuleMatch | null;
  overrides: CapsuleOverrides | null;
  images: Record<string, string>;
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

  // "Ya la tengo" sobre una prenda que te falta: el server la suma al clóset y la
  // marca cubierta; al resolver, Next refresca la página y la prenda se reubica
  // sola en "Ya lo tienes" con el progreso al día. Solo llevamos un spinner por
  // botón mientras tanto (la fuente de verdad es el server, sin doble conteo).
  const [ownBusy, setOwnBusy] = useState<Set<number>>(new Set());

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

  const markOwned = (index: number) => {
    // setBusy FUERA del transition → update urgente: el spinner aparece al
    // instante. Dentro del transition era baja prioridad y se sentía muerto.
    setBusy(index, true);
    startTransition(async () => {
      await markFaltaOwned(index);
      setBusy(index, false);
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
                <Link
                  href="/closet/capsula/looks"
                  className="inline-flex items-center gap-0.5 font-semibold text-accent underline decoration-accent/30 underline-offset-2"
                >
                  ~{looks} looks
                  <Icon name="chevron" size={12} />
                </Link>
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
              <BigCard key={rowKey(r)} row={r} images={images} />
            ))}
          </ul>
        </Section>
      ) : null}

      {falta.length > 0 ? (
        <Section title="Lo que más te suma" count={falta.length}>
          <ul className="flex flex-col gap-2.5">
            {falta.map((r) => (
              <BigCard
                key={rowKey(r)}
                row={r}
                images={images}
                unlock={unlockOf(r)}
                right={
                  <OwnControl busy={ownBusy.has(r.index)} onOwn={() => markOwned(r.index)} />
                }
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {decidir.length > 0 ? (
        <Section title="Decide si te sirve" count={decidir.length}>
          <ul className="flex flex-col gap-2.5">
            {decidir.map((r) => (
              <DecideRow key={rowKey(r)} row={r} images={images} onDecide={decide} />
            ))}
          </ul>
        </Section>
      ) : null}

      {tienes.length > 0 ? (
        <Section title="Ya lo tienes" count={tienes.length}>
          <Rail rows={tienes} images={images} />
        </Section>
      ) : null}
    </div>
  );
}

const rowKey = (r: CapsuleRow) => `${r.item.tipo}-${r.item.nombre}`;

// Imagen para una fila: la del clóset (por `by`) o, si falta, la curada del catálogo.
function rowImage(r: CapsuleRow, images: Record<string, string>): string | null {
  return (r.by ? images[r.by] : null) ?? (r.base === "falta" ? faltaImage(r.item) : null);
}

// ¿El color es claro? (para elegir icono oscuro/claro encima del swatch).
function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

// Miniatura de prenda con fallback DIGNO: si no hay imagen, un swatch del color de
// la prenda + un gancho (nunca un hueco vacío). `colorFamilia` viene del item ideal.
function Thumb({
  src,
  colorFamilia,
  sizes,
  icon = 18,
}: {
  src: string | null;
  colorFamilia: string;
  sizes: string;
  icon?: number;
}) {
  if (src) return <Image src={src} alt="" fill sizes={sizes} className="object-cover" />;
  const hex = familiaToHex(colorFamilia);
  return (
    <span className="flex h-full w-full items-center justify-center" style={{ background: hex }}>
      <Icon name="gancho" size={icon} className={isLightHex(hex) ? "text-ink/35" : "text-white/55"} />
    </span>
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
// (Bodoni) + porqué + control a la derecha (p. ej. "ya la tengo").
function BigCard({
  row,
  images,
  right,
  unlock,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  right?: React.ReactNode;
  unlock?: number;
}) {
  const src = rowImage(row, images);
  return (
    <li className="flex items-center gap-[13px] rounded-lg border border-line bg-surface p-[13px]">
      <span className="relative h-[72px] w-[56px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg">
        <Thumb src={src} colorFamilia={row.item.colorFamilia} sizes="56px" />
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

// Control "Ya la tengo" para una prenda faltante: la suma al clóset y la cuenta
// como cubierta. Al resolver, la prenda se reubica en "Ya lo tienes".
function OwnControl({ busy, onOwn }: { busy: boolean; onOwn: () => void }) {
  return (
    <button
      type="button"
      onClick={onOwn}
      disabled={busy}
      className="flex min-h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:border-accent disabled:opacity-50"
    >
      {busy ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="mas" size={14} strokeWidth={2} />}
      {busy ? "agregando…" : "ya la tengo"}
    </button>
  );
}

// "Ya lo tienes": fila horizontal de miniaturas (46px, 3:4) + celda "+N" si hay
// más de las que se muestran.
function Rail({ rows, images }: { rows: CapsuleRow[]; images: Record<string, string> }) {
  const MAX = 7;
  const shown = rows.slice(0, MAX);
  const extra = rows.length - shown.length;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {shown.map((r) => {
        const src = rowImage(r, images);
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

// Las "parecido": se deciden en su lugar. Sin decidir → la card con la ideal vs lo
// tuyo y los botones Sí/No. Decidida → estado marcado con "cambiar" para reabrir.
function DecideRow({
  row,
  images,
  onDecide,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  onDecide: (index: number, decision: CapsuleDecision) => void;
}) {
  const { item, by, decision, index } = row;
  const src = by ? images[by] : null;

  if (decision === "accept") {
    return (
      <li className="flex items-center gap-2.5 rounded-md border border-line bg-accent-soft p-3.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="check" size={13} strokeWidth={2.4} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">{item.nombre}</span>
          {by ? <span className="truncate text-xs text-muted">lo cubres con tu {by}</span> : null}
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
      <li className="flex items-center gap-2.5 rounded-md border border-line bg-surface p-3.5">
        <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-accent" />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">{item.nombre}</span>
          <span className="text-xs text-muted">preferiste la ideal — te falta</span>
        </div>
        <button
          type="button"
          onClick={() => onDecide(index, "reject")}
          className="ml-auto shrink-0 text-xs font-medium text-accent underline underline-offset-2"
        >
          cambiar
        </button>
      </li>
    );
  }

  // Lado a lado (handoff inc4): la ideal (catálogo) vs la tuya (tu foto), veredicto,
  // y decides "me sirve" (tu parecido cuenta) / "quiero la ideal" (queda como falta).
  const idealSrc = faltaImage(item);
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-[13px]">
      <div className="flex flex-col">
        <span className="text-[15px] font-semibold leading-tight text-ink">{item.nombre}</span>
        <span className="mt-0.5 text-[11.5px] leading-snug text-muted">{item.porque}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-accent">la ideal</span>
          <span className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm border border-line bg-bg text-muted">
            <Thumb src={idealSrc} colorFamilia={item.colorFamilia} sizes="120px" icon={22} />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">la tuya</span>
          <span className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm border border-line bg-bg text-muted">
            {src ? (
              <Image src={src} alt={by ?? ""} fill sizes="120px" className="object-cover" />
            ) : (
              <Icon name="gancho" size={20} />
            )}
          </span>
          {by ? <span className="truncate text-[11px] font-medium text-ink">{by}</span> : null}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDecide(index, "accept")}
          className="min-h-10 flex-1 rounded-sm bg-accent text-xs font-semibold text-on-accent transition-colors hover:bg-accent-deep"
        >
          me sirve
        </button>
        <button
          type="button"
          onClick={() => onDecide(index, "reject")}
          className="min-h-10 flex-1 rounded-sm border border-line bg-surface text-xs font-semibold text-ink transition-colors hover:border-ink"
        >
          quiero la ideal
        </button>
      </div>
    </li>
  );
}
