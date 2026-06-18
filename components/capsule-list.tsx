import { Icon } from "@/components/icon";
import {
  capsuleRows,
  type CapsuleMatch,
  type CapsuleRow,
  type CapsuleTarget,
} from "@/lib/capsule";

// Pantalla completa de la cápsula: TODAS las prendas ideales agrupadas por estado
// (te falta / algo parecido / ya lo tienes), con resumen y barra de progreso.
export function CapsuleList({
  target,
  match,
}: {
  target: CapsuleTarget;
  match: CapsuleMatch | null;
}) {
  const rows = capsuleRows(target, match);
  const total = rows.length;
  const have = rows.filter((r) => r.status === "tienes" || r.status === "parecido").length;
  const pct = total ? Math.round((100 * have) / total) : 0;

  const falta = rows.filter((r) => r.status === "falta");
  const parecido = rows.filter((r) => r.status === "parecido");
  const tienes = rows.filter((r) => r.status === "tienes");
  const pendiente = rows.filter((r) => r.status === "pendiente");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tu cápsula ideal
          </span>
          <span className="editorial text-2xl text-ink">
            {match ? `Tienes ${have} de ${total}` : `${total} prendas`}
          </span>
        </div>
        {match ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>

      {pendiente.length > 0 ? (
        <Section title={`Tu cápsula (${pendiente.length})`} rows={pendiente} />
      ) : null}
      {falta.length > 0 ? (
        <Section title={`Te falta (${falta.length})`} rows={falta} tone="falta" />
      ) : null}
      {parecido.length > 0 ? (
        <Section
          title={`Tienes algo que funciona (${parecido.length})`}
          rows={parecido}
          tone="parecido"
        />
      ) : null}
      {tienes.length > 0 ? (
        <Section title={`Ya lo tienes (${tienes.length})`} rows={tienes} tone="tienes" />
      ) : null}
    </div>
  );
}

function Section({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CapsuleRow[];
  tone?: "falta" | "parecido" | "tienes";
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{title}</span>
      <ul className="flex flex-col gap-3">
        {rows.map(({ item, by }) => (
          <li
            key={`${item.tipo}-${item.nombre}`}
            className="flex gap-3 rounded-lg border border-line bg-surface p-3"
          >
            <Chip tone={tone} />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-ink">{item.nombre}</span>
              <span className="text-xs text-muted">{item.porque}</span>
              {by ? <span className="mt-0.5 text-xs text-muted">tienes: {by}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Indicador de estado: ✓ tienes · ≈ parecido · ○ falta · — pendiente.
function Chip({ tone }: { tone?: "falta" | "parecido" | "tienes" }) {
  if (tone === "tienes") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Icon name="check" size={13} />
      </span>
    );
  }
  if (tone === "parecido") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-[13px] font-semibold">
        ≈
      </span>
    );
  }
  if (tone === "falta") {
    return (
      <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-accent" />
    );
  }
  return <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-line" />;
}
