import Link from "next/link";
import { Icon } from "@/components/icon";
import { recalcularMatch } from "@/app/closet/capsula/actions";
import type { CapsuleView } from "@/lib/capsule";

const MAX_FALTAN = 6;
const MAX_PARECIDOS = 4;

// Tarjeta de cápsula en el clóset. Sin assessment → CTA. Con cápsula → cuántas
// prendas tienes de tu ideal y cuáles te faltan (concretas, por prioridad).
export function CapsuleCard({
  hasTarget,
  view,
  stale,
}: {
  hasTarget: boolean;
  view: CapsuleView | null;
  stale: boolean;
}) {
  if (!hasTarget) {
    return (
      <Link
        href="/closet/capsula"
        className="flex items-center gap-3 rounded-lg border border-line bg-accent-soft p-4 transition-colors duration-200 hover:border-accent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="destello" size={16} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">
            Descubre tu clóset cápsula
          </span>
          <span className="text-xs text-muted">
            Cuéntame de tu vida y te armo el clóset ideal para ti.
          </span>
        </span>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </Link>
    );
  }

  // Hay cápsula pero el match no se pudo calcular todavía → invita a recalcular.
  if (!view) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]">
        <p className="text-sm font-medium text-ink">Tu cápsula está lista.</p>
        <form action={recalcularMatch}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <Icon name="repetir" size={15} /> Calcular qué tienes y qué te falta
          </button>
        </form>
      </div>
    );
  }

  const faltan = view.faltan.slice(0, MAX_FALTAN);
  const restantes = view.faltan.length - faltan.length;
  const parecidos = view.parecidos.slice(0, MAX_PARECIDOS);

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
          href="/closet/capsula"
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
        <form action={recalcularMatch}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
          >
            <Icon name="repetir" size={14} /> Tu clóset cambió — recalcular
          </button>
        </form>
      ) : null}

      {faltan.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Te falta, por prioridad
          </span>
          <ul className="flex flex-col gap-2.5">
            {faltan.map((it) => (
              <li key={`${it.tipo}-${it.nombre}`} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-ink">{it.nombre}</span>
                  <span className="text-xs text-muted">{it.porque}</span>
                </span>
              </li>
            ))}
          </ul>
          {restantes > 0 ? (
            <span className="text-xs text-muted">
              +{restantes} {restantes === 1 ? "prenda más" : "prendas más"} en tu lista.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-success">
          No te falta nada esencial. Bien ahí.
        </p>
      )}

      {parecidos.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Ya tienes algo que funciona
          </span>
          <ul className="flex flex-col gap-1.5">
            {parecidos.map(({ item, by }) => (
              <li
                key={`${item.tipo}-${item.nombre}`}
                className="flex flex-col text-sm"
              >
                <span className="text-ink">{item.nombre}</span>
                {by ? (
                  <span className="text-xs text-muted">tienes: {by} — podrías refinar</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
