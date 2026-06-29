"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  FAMILY_ORDER,
  FAMILY_LABEL,
  type Swatch,
  type SubPalette,
} from "@/lib/palette-data";

// Parte "Otoño oscuro" → head "Otoño" (sans) + tail "oscuro" (serif itálica).
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
  guinos,
  guinoLabel,
  evita,
}: {
  subLabel: string;
  reveal: string;
  metal: "oro" | "plata";
  metalHex: string;
  familias: SubPalette["familias"];
  guinos: Swatch[];
  guinoLabel: string;
  evita: Swatch[];
}) {
  // Color abierto en fullscreen (índice dentro de la lista plana `go`), o null.
  const [fsIndex, setFsIndex] = useState<number | null>(null);
  const { head, tail } = splitLabel(subLabel);

  // Lista plana de "colores que van" en orden de familia → tonos de la misma
  // familia quedan contiguos para el swipe. Cada familia sabe su offset global.
  const groups: { fam: (typeof FAMILY_ORDER)[number]; items: Swatch[]; base: number }[] = [];
  let offset = 0;
  for (const fam of FAMILY_ORDER) {
    const items = familias[fam];
    if (items && items.length) {
      groups.push({ fam, items, base: offset });
      offset += items.length;
    }
  }
  // Los guiños también "van" → entran a la lista plana (modo tienda) después de
  // las familias, con su propio offset para abrir en fullscreen.
  const guinoBase = offset;
  const go: Swatch[] = [...groups.flatMap((g) => g.items), ...guinos];

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
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: metalHex }} aria-hidden />
          tu metal: {metal}
        </span>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setFsIndex(0)}
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

      <p className="text-[12px] leading-relaxed text-muted">
        toca cualquier color para verlo en grande y compararlo con tu ropa.
      </p>

      {/* Familias por tono */}
      <div className="flex flex-col gap-7">
        {groups.map((g) => (
          <div key={g.fam} className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              {FAMILY_LABEL[g.fam]}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {g.items.map((s, i) => (
                <button
                  key={`${g.fam}-${i}`}
                  type="button"
                  onClick={() => setFsIndex(g.base + i)}
                  className="flex flex-col gap-1.5 text-left"
                >
                  <span
                    className="aspect-square w-full rounded-md border border-line"
                    style={{ backgroundColor: s.hex }}
                  />
                  <span className="text-[10.5px] font-medium leading-tight text-ink">
                    {s.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Tus guiños: los prestados de tu estación vecina. Van como acento —
            por eso ya no aparecen en "evita". Abren fullscreen como los demás. */}
        {guinos.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                Tus guiños de {guinoLabel}
              </p>
              <p className="text-[12px] leading-relaxed text-muted">
                cálidos prestados de tu vecino — úsalos como acento, te van.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {guinos.map((s, i) => (
                <button
                  key={`guino-${i}`}
                  type="button"
                  onClick={() => setFsIndex(guinoBase + i)}
                  className="flex flex-col gap-1.5 text-left"
                >
                  <span
                    className="aspect-square w-full rounded-md border border-line"
                    style={{ backgroundColor: s.hex }}
                  />
                  <span className="text-[10.5px] font-medium leading-tight text-ink">
                    {s.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Evita (informativo, no abre fullscreen) */}
        {evita.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Mejor evítalos
            </p>
            <div className="grid grid-cols-3 gap-3">
              {evita.map((s, i) => (
                <figure key={i} className="flex flex-col gap-1.5">
                  <div
                    className="relative aspect-square w-full overflow-hidden rounded-md border border-line"
                    style={{ backgroundColor: s.hex }}
                  >
                    <span
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, rgb(255 255 255/.55) 0 2px, transparent 2px 9px)",
                      }}
                      aria-hidden
                    />
                  </div>
                  <figcaption className="text-[10.5px] font-medium leading-tight text-muted">
                    {s.nombre}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <p className="rounded-md border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
        ojo: la pantalla y la luz de la tienda cambian los colores. úsala como guía,
        no como veredicto exacto.
      </p>

      {fsIndex !== null ? (
        <ColorFullscreen colors={go} start={fsIndex} onClose={() => setFsIndex(null)} />
      ) : null}
    </section>
  );
}

// Vista fullscreen: el color llena la pantalla para comparar contra una prenda.
// Swipe horizontal entre tonos (scroll-snap nativo, fluido). Nombre + HEX en
// chico, botón de cerrar discreto. Tonos de la misma familia quedan contiguos.
function ColorFullscreen({
  colors,
  start,
  onClose,
}: {
  colors: Swatch[];
  start: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(start);

  // Posiciona el carrusel en el color tocado + bloquea scroll de fondo + Escape.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [start, onClose]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== cur && i >= 0 && i < colors.length) setCur(i);
  }

  const c = colors[cur];

  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {colors.map((s, i) => (
          <div
            key={i}
            className="h-full w-full flex-none snap-center"
            style={{ backgroundColor: s.hex }}
          />
        ))}
      </div>

      {/* Cerrar (discreto) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="cerrar"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-[18px] font-semibold text-white backdrop-blur-sm"
      >
        ✕
      </button>

      {/* Nombre + HEX (chico, sin robarle protagonismo al color) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-1">
        <span className="rounded-full bg-black/30 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur-sm">
          {c.nombre}
        </span>
        <span className="tabular text-[11px] text-white/70">
          {c.hex} · {cur + 1}/{colors.length}
        </span>
      </div>
    </div>
  );
}
