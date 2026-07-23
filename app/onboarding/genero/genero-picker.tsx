"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { saveGender } from "./actions";

// Selección + CTA "empecemos" (rebrand v3). La server action saveGender lee el
// hidden input; el estado client solo maneja el resaltado y habilita el CTA.
type Gender = "mujer" | "hombre";
const OPCIONES: { value: Gender; label: string; desc: string; icon: IconName }[] = [
  { value: "mujer", label: "mujer", desc: "vestidos, faldas, blusas y más", icon: "vestido" },
  { value: "hombre", label: "hombre", desc: "camisas, pantalones, sastre y más", icon: "camisa" },
];

export function GeneroPicker() {
  const [sel, setSel] = useState<Gender | null>(null);

  return (
    <form action={saveGender} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {OPCIONES.map((o) => {
          const on = sel === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setSel(o.value)}
              aria-pressed={on}
              className={`flex items-center gap-4 border bg-surface px-[18px] py-[18px] text-left transition-colors ${
                on
                  ? "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]"
                  : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center border transition-colors ${
                  on ? "border-accent bg-accent text-on-accent" : "border-line text-ink"
                }`}
              >
                <Icon name={o.icon} size={24} />
              </span>
              <span className="flex flex-col">
                <b className="text-[20px] font-semibold text-ink">{o.label}</b>
                <span className="text-[15px] text-muted">{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <input type="hidden" name="gender" value={sel ?? ""} />
      <button
        type="submit"
        disabled={!sel}
        className="mt-3 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-40"
      >
        empecemos <Icon name="flecha" size={19} />
      </button>
    </form>
  );
}
