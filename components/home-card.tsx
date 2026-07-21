"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icon";
import type { HomeCard as HomeCardData } from "@/lib/home-card";

// La card contextual del home idle. NO es un tile de dashboard: es una fila
// editorial bajo una hairline, del mismo lenguaje que el resto de Hoy. Solo
// puede haber UNA en pantalla (la elige lib/home-card.ts) y el CTA "armar mi
// look de hoy" siempre manda visualmente sobre ella.
export function HomeCard({
  card,
  onEstrena,
}: {
  card: HomeCardData;
  // La card de prenda nueva no navega: ancla la prenda al look de hoy y abre
  // el wizard ahí mismo.
  onEstrena?: (itemId: string) => void;
}) {
  const eyebrow =
    card.kind === "viaje" ? "tu viaje" : card.kind === "estrena" ? "prenda nueva" : "ayer";

  const texto =
    card.kind === "viaje"
      ? card.dias === 0
        ? `estás en ${card.lugar} — tu maleta te espera`
        : card.dias === 1
          ? `${card.lugar} es mañana — checa tu maleta`
          : `${card.lugar} en ${card.dias} días — checa tu maleta`
      : card.kind === "estrena"
        ? `aún no estrenas ${card.nombre.toLowerCase()}`
        : // El título del look es un nombre propio ("Oficina sin esfuerzo"): en
          // minúsculas y sin comillas se confundía con la frase.
          card.worn
          ? `te pusiste «${card.nombre.toLowerCase()}»`
          : `armaste «${card.nombre.toLowerCase()}»`;

  const cuerpo = (
    <>
      {card.kind === "estrena" && card.imagen ? (
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-tile">
          <Image src={card.imagen} alt="" fill sizes="48px" className="object-cover" />
        </span>
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-line text-ink">
          <Icon name={card.kind === "viaje" ? "maletin" : "reloj"} size={19} />
        </span>
      )}
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">
          {eyebrow}
        </span>
        {/* Dos líneas: los nombres de prenda de la IA son largos ("abrigo largo
            de lana gris carbón") y truncar a una línea los dejaba a medias. */}
        <span className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug text-ink">
          {texto}
        </span>
      </span>
      <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
    </>
  );

  const clases =
    "flex w-full items-center gap-3 border-t border-line py-4 transition-colors duration-200 hover:border-accent";

  if (card.kind === "estrena") {
    return (
      <button type="button" onClick={() => onEstrena?.(card.itemId)} className={clases}>
        {cuerpo}
      </button>
    );
  }

  return (
    <Link href={card.href} className={clases}>
      {cuerpo}
    </Link>
  );
}
