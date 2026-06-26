"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { saveObjective } from "./actions";
import { OBJECTIVES, type Objective } from "./objectives";

// Grid 2×2 (las 4 ocasiones puntuales) + card ancha para "refrescar". Selección
// + CTA; saveObjective lee el hidden input. Reusa íconos del set existente.
const ICONS: Record<Objective, IconName> = {
  diario: "sol",
  oficina: "maletin",
  evento: "destello",
  viaje: "avion",
  refrescar: "repetir",
};
const GRID: Objective[] = ["diario", "oficina", "evento", "viaje"];

const ON = "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]";
const ICON_ON = "border-accent bg-accent text-on-accent";

export function ObjetivoPicker() {
  const [sel, setSel] = useState<Objective | null>(null);

  return (
    <form action={saveObjective} className="flex flex-1 flex-col">
      <div className="grid grid-cols-2 gap-2.5">
        {GRID.map((key) => {
          const on = sel === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSel(key)}
              aria-pressed={on}
              className={`flex min-h-[112px] flex-col border bg-surface p-4 text-left transition-colors ${
                on ? ON : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center border transition-colors ${
                  on ? ICON_ON : "border-line text-ink"
                }`}
              >
                <Icon name={ICONS[key]} size={18} />
              </span>
              <b className="mt-auto text-[16px] font-semibold text-ink">
                {OBJECTIVES[key].toLowerCase()}
              </b>
            </button>
          );
        })}

        {/* Card ancha: refrescar mi estilo */}
        <button
          type="button"
          onClick={() => setSel("refrescar")}
          aria-pressed={sel === "refrescar"}
          className={`col-span-2 flex items-center gap-3.5 border bg-surface p-4 text-left transition-colors ${
            sel === "refrescar" ? ON : "border-line hover:border-ink"
          }`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center border transition-colors ${
              sel === "refrescar" ? ICON_ON : "border-line text-ink"
            }`}
          >
            <Icon name={ICONS.refrescar} size={18} />
          </span>
          <b className="text-[16px] font-semibold text-ink">refrescar mi estilo</b>
        </button>
      </div>

      <input type="hidden" name="objective" value={sel ?? ""} />
      <div className="mt-auto pt-6">
        <button
          type="submit"
          disabled={!sel}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-40"
        >
          siguiente <Icon name="flecha" size={19} />
        </button>
      </div>
    </form>
  );
}
