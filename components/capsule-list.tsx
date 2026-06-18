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

// Pantalla completa de la cápsula. Agrupa por estado EFECTIVO (tu decisión
// incluida): los "Sí, me funciona" pasan a "Ya lo tienes"; los "No, quiero la
// ideal" pasan a "Te falta"; los sin decidir se quedan en "Tienes algo que
// funciona" esperando tu Sí/No. El conteo solo cuenta lo confirmado.
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

  const pendiente = rows.filter((r) => r.effective === "pendiente");
  const falta = rows.filter((r) => r.effective === "falta");
  const parecido = rows.filter((r) => r.effective === "parecido");
  const tienes = rows.filter((r) => r.effective === "tienes");

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
        <Section title={`Te falta (${falta.length})`} rows={falta} images={images} />
      ) : null}

      {parecido.length > 0 ? (
        <Section
          title={`Tienes algo que funciona (${parecido.length})`}
          explanation="Prendas que ya tienes y que pueden sustituir a la ideal, aunque no al 100%. Dime cuáles te sirven: las que digas que sí se dan por cumplidas; las que no, se cuentan como que te faltan."
          rows={parecido}
          images={images}
        />
      ) : null}

      {tienes.length > 0 ? (
        <Section title={`Ya lo tienes (${tienes.length})`} rows={tienes} images={images} />
      ) : null}
    </div>
  );
}

function Section({
  title,
  explanation,
  rows,
  images,
}: {
  title: string;
  explanation?: string;
  rows: CapsuleRow[];
  images: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{title}</span>
        {explanation ? <span className="text-xs text-muted">{explanation}</span> : null}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <Row key={`${r.item.tipo}-${r.item.nombre}`} row={r} images={images} />
        ))}
      </ul>
    </div>
  );
}

function Row({ row, images }: { row: CapsuleRow; images: Record<string, string> }) {
  const { item, base, effective, by } = row;
  const src = by ? images[by] : null;
  const hasToggle = base === "parecido"; // solo las "parecido" se deciden

  let sub: string | null = null;
  if (effective === "tienes" && by) sub = `tienes: ${by}`;
  else if (effective === "falta" && hasToggle) sub = "preferiste la ideal — te falta";
  else if (effective === "parecido" && by) sub = `tienes algo parecido: ${by}`;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        {src ? <Thumb src={src} /> : <Chip tone={effective} />}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{item.nombre}</span>
          {sub ? <span className="text-xs text-muted">{sub}</span> : null}
          <span className="mt-0.5 text-xs text-muted">{item.porque}</span>
        </div>
      </div>
      {hasToggle ? <Toggle index={row.index} decision={row.decision} /> : null}
    </li>
  );
}

function Toggle({ index, decision }: { index: number; decision: "accept" | "reject" | null }) {
  return (
    <form action={setCapsuleOverride} className="flex gap-2">
      <input type="hidden" name="index" value={index} />
      <button
        type="submit"
        name="decision"
        value="accept"
        className={`min-h-9 flex-1 rounded-sm border text-xs font-medium transition-colors ${
          decision === "accept"
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
          decision === "reject"
            ? "border-accent bg-accent-soft text-accent"
            : "border-line bg-surface text-ink hover:border-ink"
        }`}
      >
        No, quiero la ideal
      </button>
    </form>
  );
}

function Thumb({ src }: { src: string }) {
  return (
    <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
      <Image src={src} alt="" fill sizes="44px" className="object-cover" />
    </span>
  );
}

// Indicador cuando no hay imagen: ✓ tienes · ○ falta · — pendiente/parecido.
function Chip({ tone }: { tone: "tienes" | "falta" | "parecido" | "pendiente" }) {
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
