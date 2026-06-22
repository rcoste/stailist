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
          <span className="text-sm font-semibold text-ink">Descubre tu clóset cápsula</span>
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
          <span className="text-sm font-semibold text-ink">Tu cápsula está lista</span>
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
            Cápsula
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

  // Estado normal: progreso "Tienes N de M" + barra.
  return (
    <Link
      href="/closet/capsula"
      className="flex items-center gap-[13px] rounded-lg border border-line bg-surface px-[15px] py-[13px] transition-colors hover:border-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2.5">
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Tu cápsula
          </span>
          <span className="display whitespace-nowrap text-[15px] font-semibold text-ink">
            Tienes <b className="tabular font-semibold text-accent">{view.haveCount}</b> de{" "}
            <span className="tabular">{view.totalCount}</span>
          </span>
        </span>
        <span className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-line">
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${view.coveragePct}%` }}
          />
        </span>
        {stale ? (
          <span className="mt-1.5 text-[11px] text-muted">
            Tu clóset cambió — ábrela para recalcular.
          </span>
        ) : null}
      </span>
      <Icon name="chevron" size={16} className="shrink-0 text-muted" />
    </Link>
  );
}
