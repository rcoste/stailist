import Link from "next/link";
import { Icon } from "@/components/icon";
import type { HomeChecklist } from "@/lib/home-checklist";

// El checklist de activación del home idle. Una card sobria (misma familia visual
// que HomeCard / la card de permiso de Perfil): hairlines, tokens del DS, cero
// hex hardcodeado. Los pasos hechos quedan palomeados y apagados; los pendientes
// son filas tappables. Cuando los tres se completan, lib/home-checklist devuelve
// null y esta card simplemente deja de renderizarse.
export function HomeChecklist({ checklist }: { checklist: HomeChecklist }) {
  const { steps, doneCount, total } = checklist;

  return (
    <div className="rounded-sm border border-line bg-surface px-4 pb-1 pt-3.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">
          qué sigue
        </p>
        <span className="text-[11px] font-semibold tabular-nums text-muted">
          {doneCount}/{total}
        </span>
      </div>

      <div className="mt-1.5 flex flex-col">
        {steps.map((step) => {
          const marca = (
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                step.done ? "border-ink bg-ink text-on-accent" : "border-line text-muted"
              }`}
            >
              {step.done ? <Icon name="check" size={13} strokeWidth={3} /> : null}
            </span>
          );

          const cuerpo = (
            <span className="flex min-w-0 flex-col text-left">
              <span
                className={`text-[15px] font-semibold leading-tight ${
                  step.done ? "text-muted line-through" : "text-ink"
                }`}
              >
                {step.label}
              </span>
              {!step.done ? (
                <span className="mt-0.5 text-[12.5px] leading-snug text-muted">
                  {step.hint}
                </span>
              ) : null}
            </span>
          );

          // Paso hecho: fila estática (no navega). Pendiente: link tappable.
          if (step.done) {
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 border-t border-line py-3 first:border-t-0"
              >
                {marca}
                {cuerpo}
              </div>
            );
          }
          return (
            <Link
              key={step.id}
              href={step.href}
              className="group flex items-center gap-3 border-t border-line py-3 transition-colors first:border-t-0 hover:border-accent"
            >
              {marca}
              {cuerpo}
              <Icon
                name="chevron"
                size={16}
                className="ml-auto shrink-0 text-muted transition-colors group-hover:text-ink"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
