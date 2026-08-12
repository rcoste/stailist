"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { HomeChecklist } from "@/lib/home-checklist";

// El checklist de activación del home ("qué sigue" — handoff
// design_handoff_inicio, decisión 7). Tres reglas:
//
// · SOLO pendientes a la vista. Un paso completado no es información — vive
//   detrás de "ver lo hecho" (plegable, cerrado por default, sin tachados).
// · SIN caja: hairline arriba y pegado al fondo de la columna. La caja con
//   borde competía con las cards reales (look, viaje) siendo la menos card de
//   todas — esto es un pie de página de tareas, no contenido.
// · COLAPSA a una línea cuando ya hay look creado (el empujón sigue ahí pero
//   ya no es el protagonista), y se autodestruye al completarse (eso lo decide
//   buildHomeChecklist devolviendo null).
//
// Los números son la posición REAL en la secuencia (un "2" sin un "1" visible
// dice "el 1 ya lo hiciste") — la comezón de completar trabaja a favor.
export function HomeChecklist({
  checklist,
  colapsado = false,
}: {
  checklist: HomeChecklist;
  /** Ya hay look creado: el checklist baja a una sola línea (el siguiente paso). */
  colapsado?: boolean;
}) {
  const { steps, doneCount, total } = checklist;
  // Arranca cerrado SIEMPRE: el estado abierto no se persiste entre visitas.
  const [abierto, setAbierto] = useState(false);

  const hechos = steps.filter((s) => s.done);
  const pendientes = steps.filter((s) => !s.done);
  const siguiente = pendientes[0];
  if (!siguiente) return null;

  const numero = (id: string) => steps.findIndex((s) => s.id === id) + 1;
  const resumen = `qué sigue · ${doneCount} de ${total} listos`;

  // ── Colapsado: una línea — el siguiente paso y ya ──────────────────────────
  if (colapsado) {
    return (
      <Link
        href={siguiente.href}
        className="group flex items-center gap-2.5 border-t border-line py-2.5"
      >
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-line text-[11px] font-bold text-muted">
          {numero(siguiente.id)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-bold text-ink">{resumen}</span>
          <span className="truncate text-[12.5px] text-muted">
            {siguiente.label} — {siguiente.hint}
          </span>
        </span>
        <Icon
          name="chevron"
          size={16}
          className="ml-auto shrink-0 text-faint transition-colors group-hover:text-ink"
        />
      </Link>
    );
  }

  // ── Completo: encabezado + todos los pendientes, numerados ────────────────
  return (
    <div className="border-t border-line pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted">
          {resumen}
        </span>
        {/* El texto ES la afordancia — un chevron solo no dice que se abre. */}
        {hechos.length > 0 ? (
          <button
            type="button"
            onClick={() => setAbierto((o) => !o)}
            aria-expanded={abierto}
            className="text-[12.5px] font-semibold text-muted underline underline-offset-[3px] transition-colors hover:text-ink"
          >
            {abierto ? "ocultar" : "ver lo hecho"}
          </button>
        ) : null}
      </div>

      {/* Lo hecho, plegado. max-height (no height:auto) para poder animarlo. */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: abierto ? 160 : 0,
          transition: "max-height .28s var(--ease-move)",
        }}
      >
        {hechos.map((s) => (
          <div key={s.id} className="flex items-center gap-[11px] py-[7px] first:pt-2.5">
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent">
              <Icon name="check" size={12} strokeWidth={2.4} />
            </span>
            <span className="text-[13.5px] text-faint">{s.label}</span>
          </div>
        ))}
      </div>

      {pendientes.map((s, i) => (
        <Link
          key={s.id}
          href={s.href}
          className={`group flex items-center gap-[11px] py-[9px] ${
            i > 0 ? "border-t border-line2" : "mt-1.5"
          }`}
        >
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-line text-[11px] font-bold text-muted">
            {numero(s.id)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[13.5px] font-bold leading-tight text-ink">
              {s.label}
            </span>
            <span className="text-xs leading-snug text-muted">{s.hint}</span>
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
