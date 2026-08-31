"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { saveGender } from "./actions";

// Selección + CTA "empecemos" (rebrand v3). La server action saveGender lee el
// hidden input; el estado client solo maneja el resaltado y habilita el CTA.
type Gender = "mujer" | "hombre";
// LO QUE ELIGE ESTA PANTALLA ES EL CORTE, NO EL TIPO DE PRENDA.
//
// Los descriptores decían "vestidos, faldas, blusas y más" para mujer y
// "camisas, pantalones, sastre y más" para hombre. Val (usuaria) lo leyó como
// sexista, y tenía razón — pero el sesgo estaba SOLO aquí, en el texto: en la
// base, el segmento mujer tiene 35 pantalones (más que los 33 de hombre), 13
// sacos y dos trajes sastre completos en el subset de onboarding. O sea: la
// app se describía a sí misma peor de lo que es y la persona la juzgaba por la
// promesa. Lo único que cambia de verdad al elegir aquí es el CORTE de las
// prendas (el "Blazer marino" de mujer y el de hombre son dos prendas con dos
// siluetas y dos renders), así que eso es lo que dice el descriptor.
//
// LAS DOS LISTAS ARRANCAN IGUAL, y no es cortesía: es el catálogo real. Ambos
// segmentos tienen sastrería y pantalón, y por eso van primero — la única
// diferencia honesta es la cola (mujer tiene categoría `vestido`, hombre no).
//
// EL ÍCONO ES EL MISMO EN LAS DOS a propósito, y se decidió mirándolo en
// pantalla: los glifos de prenda que había aquí no se leen a 24px (el vestido
// parece peón de ajedrez y la camisa, un vaso), así que no comunicaban prenda
// — sólo cargaban el estereotipo. `persona` sí se lee y dice lo que de verdad
// se está eligiendo: la silueta. Que se repita no confunde: la diferencia la
// cargan la etiqueta en 20px bold y la lista.
const OPCIONES: { value: Gender; label: string; desc: string; icon: IconName }[] = [
  { value: "mujer", label: "mujer", desc: "sastre, pantalón, vestido y más", icon: "persona" },
  { value: "hombre", label: "hombre", desc: "sastre, pantalón, camisa y más", icon: "persona" },
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
