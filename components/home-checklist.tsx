"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { HomeChecklist } from "@/lib/home-checklist";

// El checklist de activación del home idle (handoff design_handoff_checklist).
//
// Antes listaba los CINCO pasos con los hechos tachados: ~450px para contar algo
// que la persona ya sabe, empujando el CTA bajo el pliegue (donde el botón
// central de la tab bar lo tapaba a media palabra) y leyéndose como trámite.
// La premisa del rediseño: un paso completado NO es información — solo el
// pendiente lo es. Por eso los hechos viven en un plegable, cerrado por default.
//
// Lo que SÍ es información son TODOS los pendientes, y la primera versión de
// esto los recortaba a uno solo mientras el encabezado anunciaba "2 pendientes":
// prometía un dato y lo escondía (Roberto, 2026-07-28). Ahora se listan todos,
// pero con jerarquía en vez de cinco filas iguales: el siguiente en grande y con
// su gancho, los demás en renglones compactos. Se ve qué falta sin que el bloque
// se coma la pantalla (peor caso, 5 pendientes: ~230px contra los ~450 de antes).
export function HomeChecklist({ checklist }: { checklist: HomeChecklist }) {
  const { steps, doneCount, total } = checklist;
  // Arranca cerrado SIEMPRE (el handoff lo pide explícito): el estado abierto no
  // se persiste entre visitas.
  const [abierto, setAbierto] = useState(false);

  const hechos = steps.filter((s) => s.done);
  const [siguiente, ...resto] = steps.filter((s) => !s.done);
  if (!siguiente) return null;

  // El resumen del avance. Solo es botón cuando hay algo que desplegar; sin
  // hechos sigue estando, porque el "0 de 5" es el que le da encuadre a la lista.
  const resumen = (
    <span className="text-[13px] font-bold text-ink">
      {doneCount} de {total} listos
    </span>
  );

  return (
    <div className="border border-line bg-surface">
      {/* Encabezado: el resumen ES la afordancia. El "· ver lo hecho" no se
          puede quitar dejando solo el chevron — nadie sabría que se abre. */}
      {hechos.length > 0 ? (
        <button
          type="button"
          onClick={() => setAbierto((o) => !o)}
          aria-expanded={abierto}
          className="flex min-h-11 w-full items-center gap-2 px-[15px] py-[13px] text-left transition-colors hover:bg-bg"
        >
          {resumen}
          <span className="text-[12.5px] text-muted">
            {abierto ? "· ocultar" : "· ver lo hecho"}
          </span>
          {/* La rotación va en un span y no en el prop `rotate` del Icon: ese
              escribe un transform inline sin transición y el giro sería seco. */}
          <span
            aria-hidden
            className="ml-auto flex shrink-0 text-faint"
            style={{
              transform: abierto ? "rotate(90deg)" : "none",
              transition: "transform .22s var(--ease-move)",
            }}
          >
            <Icon name="chevron" size={18} />
          </span>
        </button>
      ) : (
        <div className="flex min-h-11 items-center px-[15px] py-[13px]">{resumen}</div>
      )}

      {/* Los completados. max-height (no height:auto) para poder animarlo. */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: abierto ? 190 : 0,
          transition: "max-height .28s var(--ease-move)",
        }}
      >
        {hechos.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2.5 border-t border-line2 px-[15px] py-[9px]"
          >
            {/* Sin tachado: el check ya dice que está hecho, y el strikethrough
                sobre gris lo vuelve ilegible — era lo que ensuciaba la pantalla. */}
            <Icon name="check" size={14} className="shrink-0 text-ink" />
            <span className="text-[13.5px] text-faint">{s.label}</span>
          </div>
        ))}
      </div>

      {/* El siguiente paso: en grande y con su gancho. Toda la fila es táctil. */}
      <Link
        href={siguiente.href}
        className="group flex min-h-[54px] items-center gap-3 border-t border-line px-[15px] py-2.5 transition-colors hover:bg-bg"
      >
        <span
          aria-hidden
          className="h-[26px] w-[26px] shrink-0 rounded-full border-[1.5px] border-line"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-[16.5px] font-bold leading-tight tracking-[-0.01em] text-ink">
            {siguiente.label}
          </span>
          <span className="mt-0.5 text-[13px] leading-snug text-muted">
            {siguiente.hint}
          </span>
        </span>
        <Icon
          name="chevron"
          size={18}
          className="ml-auto shrink-0 text-faint transition-colors group-hover:text-ink"
        />
      </Link>

      {/* Los demás pendientes. Compactos y sin gancho —lo que aportan es saber
          QUÉ falta, no venderlo—, pero cada uno se puede tocar: si te late más
          el tercero que el primero, entras directo. */}
      {resto.map((s) => (
        <Link
          key={s.id}
          href={s.href}
          className="group flex min-h-11 items-center gap-3 border-t border-line2 px-[15px] py-2 transition-colors hover:bg-bg"
        >
          <span
            aria-hidden
            className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-line"
          />
          <span className="min-w-0 text-[14px] font-medium leading-tight text-ink">
            {s.label}
          </span>
          <Icon
            name="chevron"
            size={16}
            className="ml-auto shrink-0 text-faint transition-colors group-hover:text-ink"
          />
        </Link>
      ))}
    </div>
  );
}
