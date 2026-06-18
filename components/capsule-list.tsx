import Image from "next/image";
import { Icon } from "@/components/icon";
import { setCapsuleOverride } from "@/app/closet/capsula/actions";
import {
  capsuleRows,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleRow,
  type CapsuleTarget,
} from "@/lib/capsule";

// Pantalla completa de la cápsula: TODAS las prendas ideales agrupadas por estado
// (te falta / algo parecido / ya lo tienes), con resumen, imágenes de lo que ya
// tienes, y un Sí/No en las "parecido" para que el usuario decida si cuentan.
export function CapsuleList({
  target,
  match,
  overrides,
  images,
}: {
  target: CapsuleTarget;
  match: CapsuleMatch | null;
  overrides: CapsuleOverrides | null;
  images: Record<string, string>;
}) {
  const rows = capsuleRows(target, match, overrides);
  const total = rows.length;
  const have = rows.filter((r) => r.covered).length;
  const pct = total ? Math.round((100 * have) / total) : 0;

  const falta = rows.filter((r) => r.base === "falta");
  const parecido = rows.filter((r) => r.base === "parecido");
  const tienes = rows.filter((r) => r.base === "tienes");
  const pendiente = rows.filter((r) => r.base === "pendiente");

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
        <Section title={`Tu cápsula (${pendiente.length})`} rows={pendiente} images={images} />
      ) : null}

      {falta.length > 0 ? (
        <Section title={`Te falta (${falta.length})`} rows={falta} images={images} tone="falta" />
      ) : null}

      {parecido.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Tienes algo que funciona ({parecido.length})
            </span>
            <span className="text-xs text-muted">
              Prendas que ya tienes y que pueden sustituir a la ideal, aunque no al 100%. Dime
              cuáles te sirven: las que digas que no, se cuentan como que te faltan.
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {parecido.map((r) => (
              <ParecidoRow key={`${r.item.tipo}-${r.item.nombre}`} row={r} images={images} />
            ))}
          </ul>
        </div>
      ) : null}

      {tienes.length > 0 ? (
        <Section title={`Ya lo tienes (${tienes.length})`} rows={tienes} images={images} tone="tienes" />
      ) : null}
    </div>
  );
}

function Thumb({ src }: { src: string | null | undefined }) {
  if (!src) return null;
  return (
    <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
      <Image src={src} alt="" fill sizes="44px" className="object-cover" />
    </span>
  );
}

function Section({
  title,
  rows,
  images,
  tone,
}: {
  title: string;
  rows: CapsuleRow[];
  images: Record<string, string>;
  tone?: "falta" | "tienes";
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{title}</span>
      <ul className="flex flex-col gap-3">
        {rows.map(({ item, by }) => {
          const src = by ? images[by] : null;
          return (
            <li
              key={`${item.tipo}-${item.nombre}`}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3"
            >
              {src ? <Thumb src={src} /> : <Chip tone={tone} />}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink">{item.nombre}</span>
                <span className="text-xs text-muted">{item.porque}</span>
                {by ? <span className="mt-0.5 text-xs text-muted">tienes: {by}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ParecidoRow({ row, images }: { row: CapsuleRow; images: Record<string, string> }) {
  const src = row.by ? images[row.by] : null;
  const rejected = row.decision === "reject";
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        <Thumb src={src} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{row.item.nombre}</span>
          {row.by ? (
            <span className="text-xs text-muted">
              {rejected ? "te falta — preferiste la ideal" : `tienes: ${row.by}`}
            </span>
          ) : null}
          <span className="mt-0.5 text-xs text-muted">{row.item.porque}</span>
        </div>
      </div>
      <form action={setCapsuleOverride} className="flex gap-2">
        <input type="hidden" name="index" value={row.index} />
        <button
          type="submit"
          name="decision"
          value="accept"
          className={`min-h-9 flex-1 rounded-sm border text-xs font-medium transition-colors ${
            row.decision === "accept"
              ? "border-accent bg-accent text-on-accent"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          Sí, me funciona
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          className={`min-h-9 flex-1 rounded-sm border text-xs font-medium transition-colors ${
            rejected
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          No, quiero la ideal
        </button>
      </form>
    </li>
  );
}

// Indicador de estado cuando no hay imagen: ✓ tienes · ○ falta · — pendiente.
function Chip({ tone }: { tone?: "falta" | "tienes" }) {
  if (tone === "tienes") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Icon name="check" size={13} />
      </span>
    );
  }
  if (tone === "falta") {
    return <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-accent" />;
  }
  return <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-line" />;
}
