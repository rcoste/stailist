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

// Pantalla completa de la cápsula. Las decisiones sobre las prendas "parecido"
// son OPTIMISTAS: el tap se ve al instante y el guardado va en segundo plano.
// Agrupamos por estado BASE (lo que dijo el match), NO por efectivo, para que
// una "parecido" ya decidida NO salte de sección — se queda en "Decide" marcada
// en su lugar, con un "cambiar" para reabrir. El conteo sí cuenta lo cubierto.
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

  // Mismo toggle que el server: re-elegir la decisión actual la borra (= "cambiar").
  const decide = (index: number, decision: CapsuleDecision) =>
    startTransition(async () => {
      applyOpt({ index, decision });
      await setCapsuleOverride(index, decision);
    });

  const rows = capsuleRows(target, match, optOverrides);
  const total = rows.length;
  const have = rows.filter((r) => r.covered).length;
  const pct = total ? Math.round((100 * have) / total) : 0;

  const pendiente = rows.filter((r) => r.base === "pendiente");
  const tienes = rows.filter((r) => r.base === "tienes");
  const falta = rows.filter((r) => r.base === "falta");
  const decidir = rows.filter((r) => r.base === "parecido");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tu cápsula ideal
          </span>
          <span className="editorial text-2xl text-ink">
            {match ? `Tienes ${have} de ${total}` : `${total} prendas`}
          </span>
        </div>
        {match ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>

      {pendiente.length > 0 ? (
        <Section title={`Tu cápsula (${pendiente.length})`}>
          {pendiente.map((r) => (
            <SimpleRow key={rowKey(r)} row={r} images={images} />
          ))}
        </Section>
      ) : null}

      {falta.length > 0 ? (
        <Section title={`Te falta (${falta.length})`}>
          {falta.map((r) => (
            <SimpleRow key={rowKey(r)} row={r} images={images} />
          ))}
        </Section>
      ) : null}

      {decidir.length > 0 ? (
        <Section
          title={`Decide: ¿lo que tienes te sirve? (${decidir.length})`}
          explanation="Para cada prenda ideal ya tienes algo parecido. Si te sirve, cuenta como cumplida; si prefieres la ideal, se cuenta como que te falta."
        >
          {decidir.map((r) => (
            <DecideRow key={rowKey(r)} row={r} images={images} onDecide={decide} />
          ))}
        </Section>
      ) : null}

      {tienes.length > 0 ? (
        <Section title={`Ya lo tienes (${tienes.length})`}>
          {tienes.map((r) => (
            <SimpleRow key={rowKey(r)} row={r} images={images} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

const rowKey = (r: CapsuleRow) => `${r.item.tipo}-${r.item.nombre}`;

function Section({
  title,
  explanation,
  children,
}: {
  title: string;
  explanation?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{title}</span>
        {explanation ? <span className="text-xs text-muted">{explanation}</span> : null}
      </div>
      <ul className="flex flex-col gap-3">{children}</ul>
    </div>
  );
}

// Las "parecido": se deciden en su lugar. Sin decidir → la card con la ideal vs lo
// tuyo y los botones Sí/No. Decidida → estado marcado (verde "lo cubres" / muted
// "preferiste la ideal") con "cambiar" para reabrir. Nunca salta de sección.
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
      <li className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/5 p-3.5">
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
      <li className="flex items-center gap-2.5 rounded-lg border border-line bg-surface p-3.5">
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
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
          La ideal
        </span>
        <span className="text-sm font-semibold text-ink">{item.nombre}</span>
        <span className="text-xs text-muted">{item.porque}</span>
      </div>
      {by ? (
        <div className="flex items-center gap-2.5 rounded-md bg-bg p-2">
          {src ? <Thumb src={src} /> : <Chip tone="parecido" />}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Tú ya tienes algo parecido
            </span>
            <span className="text-sm font-medium text-ink">{by}</span>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDecide(index, "accept")}
          className="min-h-9 flex-1 rounded-sm border border-line bg-surface text-xs font-medium text-ink transition-colors hover:border-ink"
        >
          Sí, me sirve
        </button>
        <button
          type="button"
          onClick={() => onDecide(index, "reject")}
          className="min-h-9 flex-1 rounded-sm border border-line bg-surface text-xs font-medium text-ink transition-colors hover:border-ink"
        >
          Prefiero la ideal
        </button>
      </div>
    </li>
  );
}

// Filas simples sin decisión: pendiente · te falta · ya lo tienes.
function SimpleRow({ row, images }: { row: CapsuleRow; images: Record<string, string> }) {
  const { item, base, by } = row;
  // Lo que tienes → su foto del clóset. Lo que falta → imagen curada (si la hay)
  // para visualizar la prenda; si no, cae al indicador (Chip).
  const src = (by ? images[by] : null) ?? (base === "falta" ? faltaImage(item) : null);
  const sub = base === "tienes" && by ? `tienes: ${by}` : null;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        {src ? <Thumb src={src} /> : <Chip tone={base === "parecido" ? "pendiente" : base} />}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{item.nombre}</span>
          {sub ? <span className="text-xs text-muted">{sub}</span> : null}
          <span className="mt-0.5 text-xs text-muted">{item.porque}</span>
        </div>
      </div>
    </li>
  );
}

function Thumb({ src }: { src: string }) {
  return (
    <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
      <Image src={src} alt="" fill sizes="44px" className="object-cover" />
    </span>
  );
}

// Indicador cuando no hay imagen: ✓ tienes · ○ falta · — pendiente/parecido.
function Chip({ tone }: { tone: "tienes" | "falta" | "parecido" | "pendiente" }) {
  if (tone === "tienes") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Icon name="check" size={13} />
      </span>
    );
  }
  if (tone === "falta") {
    return <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-accent" />;
  }
  return <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-line" />;
}
