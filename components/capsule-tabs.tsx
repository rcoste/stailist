"use client";

import { useState, type ReactNode } from "react";
import { CapsuleTabsContext } from "@/components/capsule-tabs-context";

// Pestañas de tus esenciales (mockup de Roberto, 2026-08-13 — el gemelo del
// detalle de viaje): "el porqué" (el razonamiento del estilista) · "esenciales"
// (la lista con cobertura) · "looks" (outfits con lo que ya tienes).
//
// El CTA "revisar esenciales →" del porqué vive AQUÍ (necesita setTab), igual
// que el "revisar prendas →" del plan en TripTabs. La generación de looks vive
// dentro de <CapsuleLooks/> (server action) — aquí no hay estado de generación.
export type CapsuleTab = "porque" | "capsula" | "looks";

export function CapsuleTabs({
  esencialesCount,
  looksCount,
  looksStale = false,
  initialTab = "porque",
  porque,
  capsula,
  looks,
}: {
  esencialesCount: number;
  looksCount: number;
  looksStale?: boolean;
  initialTab?: CapsuleTab;
  porque: ReactNode;
  capsula: ReactNode;
  looks: ReactNode;
}) {
  const [tab, setTab] = useState<CapsuleTab>(initialTab);

  return (
    // gap-3 (12px) y no gap-6: con 24px quedaba un colchón muerto entre la
    // línea de las pestañas y el primer bloque, y la pestaña activa se leía
    // desconectada de lo que estaba mostrando.
    <div className="flex flex-col gap-3">
      <div className="-mt-1 flex gap-5 border-b border-line">
        <Tab label="el porqué" on={tab === "porque"} onClick={() => setTab("porque")} />
        <Tab
          label="esenciales"
          count={esencialesCount}
          on={tab === "capsula"}
          onClick={() => setTab("capsula")}
        />
        <Tab
          label="looks"
          count={looksCount}
          on={tab === "looks"}
          dot={looksStale && looksCount > 0}
          onClick={() => setTab("looks")}
        />
      </div>
      <CapsuleTabsContext.Provider value={{ onViewLooks: () => setTab("looks") }}>
        {tab === "porque" ? (
          <div className="flex flex-col gap-6 lg:max-w-[560px]">
            {porque}
            {/* Sticky sobre la tab bar, como su gemelo de viaje (trip-tabs):
                el CTA era el último elemento del scroll y se perdía en móvil. */}
            <div className="sticky bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-line bg-bg px-4 pb-2 pt-2.5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
              <button
                type="button"
                onClick={() => setTab("capsula")}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
              >
                revisar esenciales →
              </button>
            </div>
          </div>
        ) : tab === "capsula" ? (
          capsula
        ) : (
          looks
        )}
      </CapsuleTabsContext.Provider>
    </div>
  );
}

function Tab({
  label,
  count,
  on,
  dot = false,
  onClick,
}: {
  label: string;
  /** Sin `count` la pestaña va sin caja de conteo (el porqué). */
  count?: number;
  on: boolean;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-[7px] border-b-2 py-[11px] text-sm font-semibold transition-colors ${
        on ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      <span className="relative">
        {label}
        {dot ? (
          <span
            className="absolute -right-2.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-accent"
            aria-hidden
          />
        ) : null}
      </span>
      {count !== undefined ? (
        <span
          className={`tabular rounded-sm border px-1.5 py-px text-[11px] font-bold ${
            on ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-muted"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
