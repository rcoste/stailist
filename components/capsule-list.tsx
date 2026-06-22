"use client";

import { useOptimistic, useTransition } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { faltaImage } from "@/lib/capsule-images";
import { setCapsuleOverride } from "@/app/closet/capsula/actions";
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

  const decide = (index: number, decision: CapsuleDecision) =>
    startTransition(async () => {
      applyOpt({ index, decision });
      await setCapsuleOverride(index, decision);
    });

  const rows = capsuleRows(target, match, optOverrides);
  const total = rows.length;
  const have = rows.filter((r) => r.covered).length;
  const pct = total ? Math.round((100 * have) / total) : 0;

  // Agrupamos por estado BASE (lo que dijo el match) para que una "parecido" ya
  // decidida no salte de sección. Sin match → todo "pendiente".
  const byPrio = (a: CapsuleRow, b: CapsuleRow) => a.item.prioridad - b.item.prioridad;
  const pendiente = rows.filter((r) => r.base === "pendiente").sort(byPrio);
  const tienes = rows.filter((r) => r.base === "tienes").sort(byPrio);
  const falta = rows.filter((r) => r.base === "falta").sort(byPrio);
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
      </div>

      {/* Sin match: la cápsula ideal como lista simple (el botón "calcular" vive
          en la página). */}
      {pendiente.length > 0 ? (
        <Section title="Tu cápsula ideal" count={pendiente.length}>
          <ul className="flex flex-col gap-2.5">
            {pendiente.map((r) => (
              <BigCard key={rowKey(r)} row={r} images={images} ring={false} />
            ))}
          </ul>
        </Section>
      ) : null}

      {falta.length > 0 ? (
        <Section title="Te falta — por prioridad" count={falta.length}>
          <ul className="flex flex-col gap-2.5">
            {falta.map((r) => (
              <BigCard key={rowKey(r)} row={r} images={images} ring />
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
// (Bodoni) + porqué + anillo vacío.
function BigCard({
  row,
  images,
  ring,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  ring: boolean;
}) {
  const src = rowImage(row, images);
  return (
    <li className="flex items-center gap-[13px] rounded-lg border border-line bg-surface p-[13px]">
      <span className="relative h-[72px] w-[56px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg">
        {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="display text-[16px] font-semibold leading-tight text-ink">
          {row.item.nombre}
        </span>
        <span className="mt-1 text-[11.5px] leading-snug text-muted">{row.item.porque}</span>
      </div>
      {ring ? (
        <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-accent" />
      ) : null}
    </li>
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
            {src ? <Image src={src} alt="" fill sizes="46px" className="object-cover" /> : null}
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
      <li className="flex items-center gap-2.5 rounded-md border border-success/30 bg-success/5 p-3.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Icon name="check" size={13} />
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

  return (
    <li className="flex flex-col gap-0 rounded-md border border-line bg-surface p-[13px]">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-accent">La ideal</span>
      <span className="mt-1 text-sm font-semibold text-ink">{item.nombre}</span>
      <span className="mt-0.5 text-[11.5px] leading-snug text-muted">{item.porque}</span>
      {by ? (
        <div className="my-2.5 flex items-center gap-2.5 rounded-sm bg-bg p-2.5">
          {src ? (
            <span className="relative h-[42px] w-[34px] shrink-0 overflow-hidden rounded-sm border border-line">
              <Image src={src} alt="" fill sizes="34px" className="object-cover" />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.05em] text-muted">
              Ya tienes algo parecido
            </span>
            <span className="truncate text-[13px] font-semibold text-ink">{by}</span>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDecide(index, "accept")}
          className="min-h-9 flex-1 rounded-sm border border-line bg-surface text-xs font-semibold text-ink transition-colors hover:border-ink"
        >
          Sí, me sirve
        </button>
        <button
          type="button"
          onClick={() => onDecide(index, "reject")}
          className="min-h-9 flex-1 rounded-sm border border-line bg-surface text-xs font-semibold text-ink transition-colors hover:border-ink"
        >
          Prefiero la ideal
        </button>
      </div>
    </li>
  );
}
