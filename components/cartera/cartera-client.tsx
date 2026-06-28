"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  FAMILY_ORDER,
  FAMILY_LABEL,
  type SwatchFamily,
  type Swatch,
} from "@/lib/palette-data";

// Parte "Otoño oscuro" → head "Otoño" (sans) + tail "oscuro" (serif itálica),
// mismo patrón del rebrand v3.
function splitLabel(s: string) {
  const words = s.trim().split(" ");
  const tail = words.length > 1 ? words.pop()! : null;
  return { head: words.join(" "), tail };
}

export function CarteraClient({
  subLabel,
  reveal,
  metal,
  metalHex,
  familias,
}: {
  subLabel: string;
  reveal: string;
  metal: "oro" | "plata";
  metalHex: string;
  familias: Record<SwatchFamily, Swatch[]>;
}) {
  const [store, setStore] = useState(false);
  const { head, tail } = splitLabel(subLabel);

  // Modo tienda: solo los colores que SÍ van (sin "evita"), en grande.
  const goColors = FAMILY_ORDER.filter((f) => f !== "evita").flatMap((f) => familias[f]);

  return (
    <section className="flex flex-col gap-6 pt-4">
      {/* Hero */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          tu cartera de colores
        </p>
        <h1 className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
            {head}
          </span>
          {tail ? (
            <span className="font-display text-[27px] italic leading-none text-muted">
              {tail}
            </span>
          ) : null}
        </h1>
        <p className="editorial text-[15px] leading-relaxed text-muted">{reveal}</p>
        <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: metalHex }}
            aria-hidden
          />
          tu metal: {metal}
        </span>
      </div>

      {/* CTAs: modo tienda + chequear un color */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setStore(true)}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          <Icon name="destello" size={18} /> modo tienda
        </button>
        <Link
          href="/cartera/chequear"
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
        >
          <Icon name="destello" size={16} /> chequea un color (compras online)
        </Link>
      </div>

      {/* Familias */}
      <div className="flex flex-col gap-7">
        {FAMILY_ORDER.map((fam) => {
          const items = familias[fam];
          if (!items || items.length === 0) return null;
          const evita = fam === "evita";
          return (
            <div key={fam} className="flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                {FAMILY_LABEL[fam]}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {items.map((s, i) => (
                  <SwatchTile key={`${fam}-${i}`} swatch={s} evita={evita} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota honesta sobre exactitud de color en pantalla */}
      <p className="rounded-md border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
        ojo: la pantalla y la luz de la tienda cambian los colores. úsala como guía,
        no como veredicto exacto.
      </p>

      {store ? <StoreMode swatches={goColors} onClose={() => setStore(false)} /> : null}
    </section>
  );
}

function SwatchTile({ swatch, evita }: { swatch: Swatch; evita: boolean }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-md border border-line"
        style={{ backgroundColor: swatch.hex }}
      >
        {evita ? (
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgb(255 255 255/.55) 0 2px, transparent 2px 9px)",
            }}
            aria-hidden
          />
        ) : null}
      </div>
      <figcaption className="text-[10.5px] font-medium leading-tight text-ink">
        {swatch.nombre}
      </figcaption>
    </figure>
  );
}

// Modo tienda: overlay a sangre, tiles grandes, fondo claro a tope para sacar el
// teléfono junto a la ropa. Scroll vertical, sin distracciones.
function StoreMode({ swatches, onClose }: { swatches: Swatch[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex flex-none items-center justify-between px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-1 py-1 text-[15px] font-semibold text-ink"
        >
          <Icon name="chevron" size={19} rotate={180} /> cerrar
        </button>
        <span className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          modo tienda
        </span>
      </div>
      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {swatches.map((s, i) => (
          <div key={i} className="flex flex-col">
            <div
              className="aspect-[4/3] w-full rounded-md"
              style={{ backgroundColor: s.hex }}
            />
            <span className="px-1 py-1 text-[11px] font-medium text-ink">{s.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
