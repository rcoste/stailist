import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { faltaImage } from "@/lib/capsule-images";
import type { CapsuleView } from "@/lib/capsule";

const MAX_FALTAN = 4;

// Teaser de la cápsula en el clóset. Resume (Tienes N de M + qué te falta) y
// lleva a la pantalla completa (/closet/capsula). El cuestionario vive en /editar.
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
        className="flex items-center gap-3 rounded-lg border border-line bg-accent-soft p-4 transition-colors duration-200 hover:border-accent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="destello" size={16} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">Descubre tu clóset cápsula</span>
          <span className="text-xs text-muted">
            Cuéntame de tu vida y te armo el clóset ideal para ti.
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
        className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-hairline)] transition-colors hover:border-accent"
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">Tu cápsula está lista</span>
          <span className="text-xs text-muted">Ve qué prendas ya tienes y cuáles te faltan.</span>
        </span>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </Link>
    );
  }

  const faltan = view.faltan.slice(0, MAX_FALTAN);
  const restantes = view.faltan.length - faltan.length;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tu cápsula ideal
          </span>
          <span className="editorial text-2xl text-ink">
            Tienes {view.haveCount} de {view.totalCount}
          </span>
        </div>
        <Link
          href="/closet/capsula/editar"
          className="text-sm font-medium text-accent hover:underline"
        >
          Editar
        </Link>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${view.coveragePct}%` }}
        />
      </div>

      {stale ? (
        <p className="text-xs text-muted">
          Tu clóset cambió — abre tu cápsula para recalcular.
        </p>
      ) : null}

      {faltan.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Te falta, por prioridad
          </span>
          <ul className="flex flex-col gap-2.5">
            {faltan.map((it) => {
              const img = faltaImage(it);
              return (
                <li key={`${it.tipo}-${it.nombre}`} className="flex items-center gap-2.5">
                  {img ? (
                    <span className="relative h-11 w-9 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
                      <Image src={img} alt="" fill sizes="36px" className="object-cover" />
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">{it.nombre}</span>
                    <span className="truncate text-xs text-muted">{it.porque}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-success">No te falta nada esencial. Bien ahí.</p>
      )}

      <Link
        href="/closet/capsula"
        className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        Ver mi cápsula completa
        {restantes > 0 ? (
          <span className="text-muted">({restantes} más + lo que ya tienes)</span>
        ) : null}
        <Icon name="chevron" size={15} />
      </Link>
    </div>
  );
}
