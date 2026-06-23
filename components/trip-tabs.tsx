"use client";

import { useState, type ReactNode } from "react";

// Tabs del resultado del viaje (handoff): "La maleta" / "Tus looks". El
// encabezado (título + metadatos) vive en la página servidor; aquí solo el
// estado de pestaña + los paneles (que llegan ya renderizados como props).
export function TripTabs({
  maletaCount,
  looksCount,
  maleta,
  looks,
}: {
  maletaCount: number;
  looksCount: number;
  maleta: ReactNode;
  looks: ReactNode;
}) {
  const [tab, setTab] = useState<"maleta" | "looks">("maleta");
  return (
    <div className="flex flex-col gap-4">
      <div className="-mt-1 flex gap-6 border-b border-line">
        <Tab label="La maleta" count={maletaCount} on={tab === "maleta"} onClick={() => setTab("maleta")} />
        <Tab label="Tus looks" count={looksCount} on={tab === "looks"} onClick={() => setTab("looks")} />
      </div>
      {tab === "maleta" ? maleta : looks}
    </div>
  );
}

function Tab({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
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
      {label}
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
