"use client";

import { useState, type ReactNode } from "react";
import { CapsuleTabsContext } from "@/components/capsule-tabs-context";

// Pestañas de los esenciales: "tus esenciales" (el plan + cobertura) / "tus looks"
// (outfits con lo que ya tienes). Mismo lenguaje visual que el viaje
// ("la maleta" / "tus looks"). La generación de looks vive dentro de <CapsuleLooks/>
// (server action), así que aquí no hay estado de generación — solo el switch.
export function CapsuleTabs({
  capsulaCount,
  looksCount,
  looksStale = false,
  initialTab = "capsula",
  capsula,
  looks,
}: {
  capsulaCount: number;
  looksCount: number;
  looksStale?: boolean;
  initialTab?: "capsula" | "looks";
  capsula: ReactNode;
  looks: ReactNode;
}) {
  const [tab, setTab] = useState<"capsula" | "looks">(initialTab);

  return (
    <div className="flex flex-col gap-6">
      <div className="-mt-1 flex gap-6 border-b border-line">
        <Tab
          label="tus esenciales"
          count={capsulaCount}
          on={tab === "capsula"}
          onClick={() => setTab("capsula")}
        />
        <Tab
          label="tus looks"
          count={looksCount}
          on={tab === "looks"}
          dot={looksStale && looksCount > 0}
          onClick={() => setTab("looks")}
        />
      </div>
      <CapsuleTabsContext.Provider value={{ onViewLooks: () => setTab("looks") }}>
        {tab === "capsula" ? capsula : looks}
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
  count: number;
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
      <span
        className={`tabular rounded-sm border px-1.5 py-px text-[11px] font-bold ${
          on ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
