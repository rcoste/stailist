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

// En el ONBOARDING solo "día a día" está activo: el primer look se arma para
// arrancar, y las demás ocasiones (oficina, evento, viaje, refrescar) se piden
// después desde Hoy. Se muestran deshabilitadas —no ocultas— para que la
// persona sepa que existen, sin cargarla de decisiones en el primer minuto.
const DEFAULT: Objective = "diario";
const locked = (key: Objective) => key !== DEFAULT;

const ON = "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]";
const ICON_ON = "border-accent bg-accent text-on-accent";
const LOCKED = "border-line opacity-55 cursor-default";

// Chip "· después" para las ocasiones que se piden desde Hoy más adelante.
function Luego() {
  return (
    <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
      · después
    </span>
  );
}

export function ObjetivoPicker() {
  // Arranca en "día a día": tap-through de cero decisión, pero se puede enviar.
  const [sel] = useState<Objective>(DEFAULT);

  return (
    <form action={saveObjective} className="flex flex-1 flex-col">
      <p className="mb-4 text-[13px] leading-snug text-muted">
        Para tu primer look te armo un <b className="text-ink">día a día</b>. Oficina,
        evento y más los pides desde Hoy, cuando los necesites.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {GRID.map((key) => {
          const on = sel === key;
          const isLocked = locked(key);
          return (
            <div
              key={key}
              aria-disabled={isLocked}
              className={`flex min-h-[112px] flex-col border bg-surface p-4 text-left ${
                on ? ON : isLocked ? LOCKED : "border-line"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center border ${
                  on ? ICON_ON : "border-line text-ink"
                }`}
              >
                <Icon name={ICONS[key]} size={18} />
              </span>
              <div className="mt-auto">
                <b className="block text-[16px] font-semibold leading-tight text-ink">
                  {OBJECTIVES[key].toLowerCase()}
                </b>
                {isLocked ? (
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                    después
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Card ancha: refrescar mi estilo — también diferida a Hoy */}
        <div
          aria-disabled
          className={`col-span-2 flex items-center gap-3.5 border bg-surface p-4 text-left ${LOCKED}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-line text-ink">
            <Icon name={ICONS.refrescar} size={18} />
          </span>
          <b className="flex items-center text-[16px] font-semibold text-ink">
            refrescar mi estilo
            <Luego />
          </b>
        </div>
      </div>

      <input type="hidden" name="objective" value={sel} />
      <div className="mt-auto pt-6">
        <button
          type="submit"
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          siguiente <Icon name="flecha" size={19} />
        </button>
      </div>
    </form>
  );
}
