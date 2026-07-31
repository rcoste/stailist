import Link from "next/link";
import { Icon } from "@/components/icon";
import type { CapsuleView } from "@/lib/capsule";

// Franja-resumen de la cápsula en el clóset (handoff: capstrip). Resume el
// progreso en una sola fila y lleva a la pantalla completa (/closet/capsula).
// Al llegar a 17/17 se vuelve verde y deja de exigir (estado de mantenimiento).
export function CapsuleCard({
  hasTarget,
  view,
  stale,
}: {
  hasTarget: boolean;
  view: CapsuleView | null;
  stale: boolean;
}) {
  // Sin cápsula todavía → al cuestionario.
  if (!hasTarget) {
    return (
      <Link
        href="/closet/capsula/editar"
        className="flex items-center gap-3 rounded-lg border border-line bg-accent-soft px-[15px] py-[13px] transition-colors duration-200 hover:border-accent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent">
          <Icon name="destello" size={16} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink">Descubre tus esenciales</span>
          <span className="text-xs text-muted">
            Cuéntame de tu vida y te armo el clóset ideal.
          </span>
        </span>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </Link>
    );
  }

  // Hay cápsula pero falta calcular el match → a la vista (ahí está "calcular").
  if (!view) {
    return (
      <Link
        href="/closet/capsula"
        className="flex items-center gap-3 rounded-lg border border-line bg-surface px-[15px] py-[13px] transition-colors hover:border-accent"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink">Tus esenciales están listos</span>
          <span className="text-xs text-muted">Ve qué prendas ya tienes y cuáles te faltan.</span>
        </span>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </Link>
    );
  }

  // Estado completo (17/17): franja verde, sin barra, sello ✓ — celebra y mantiene.
  if (view.coveragePct >= 100) {
    return (
      <Link
        href="/closet/capsula"
        className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/[0.07] px-3.5 py-[11px] transition-colors hover:border-success"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-on-accent">
          <Icon name="check" size={14} strokeWidth={2.4} />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-[7px]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-success">
            Esenciales
          </span>
          <span className="text-[13.5px] font-semibold text-ink">Completa</span>
          <span className="tabular text-xs text-muted">
            · {view.haveCount}/{view.totalCount}
          </span>
        </span>
        <Icon name="chevron" size={16} className="shrink-0 text-muted" />
      </Link>
    );
  }

  // Estado normal (v3 "capbig"): bloque con borde negro, "tu cápsula N/M" grande,
  // barra de progreso, y los esenciales que faltan como huecos punteados (que
  // llevan a la pantalla de la cápsula).
  const faltan = view.faltan.slice(0, 3);
  const nFaltan = view.faltan.length;
  return (
    <Link
      href="/closet/capsula"
      className="flex flex-col border border-accent px-[15px] py-[15px] transition-colors hover:border-accent-deep"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          tus esenciales
        </span>
        <span className="text-[26px] font-bold leading-none tracking-[-0.02em] text-ink">
          <span className="tabular">{view.haveCount}</span>
          <b className="tabular font-normal text-muted"> / {view.totalCount}</b>
        </span>
      </div>
      <span className="mt-[11px] h-1.5 w-full overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${view.coveragePct}%` }}
        />
      </span>
      {stale ? (
        <span className="mt-2.5 text-[11px] text-muted">
          tu clóset cambió — ábrela para recalcular.
        </span>
      ) : faltan.length > 0 ? (
        <>
          <p className="display mt-3 text-sm text-muted">
            te {nFaltan === 1 ? "falta" : "faltan"} {nFaltan}{" "}
            {nFaltan === 1 ? "pieza" : "piezas"}:
          </p>
          <div className="mt-[11px] flex gap-2">
            {faltan.map((it, i) => (
              <span
                key={i}
                className="flex aspect-[3/4] flex-1 flex-col items-center justify-center gap-[7px] border border-dashed border-line px-1 text-muted"
              >
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line">
                  <Icon name="mas" size={14} />
                </span>
                <span className="text-center text-[9px] font-bold uppercase leading-[1.2] tracking-[0.04em]">
                  {it.nombre}
                </span>
              </span>
            ))}
          </div>
        </>
      ) : null}
    </Link>
  );
}
