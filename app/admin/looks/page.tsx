import Image from "next/image";
import { LOOKS } from "@/lib/looks";

const SEG_LABEL: Record<string, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
  unisex: "Unisex",
};

// Cada look unisex tiene dos fotos reales en disco (<id>-hombre.png /
// <id>-mujer.png); el path base <id>.png NO existe. Aplanamos a una entrada por
// foto real para QA — así el admin muestra las 34 imágenes y ninguna sale rota.
type LookCard = {
  key: string;
  nombre: string;
  segLabel: string;
  vibe: string;
  tags: string[];
  image: string;
};

function toCards(): LookCard[] {
  const cards: LookCard[] = [];
  for (const l of LOOKS) {
    if (l.segment === "unisex") {
      cards.push({
        key: `${l.id}-hombre`,
        nombre: l.nombre,
        segLabel: "Unisex · Hombre",
        vibe: l.vibe,
        tags: l.tags,
        image: `/looks/${l.id}-hombre.png`,
      });
      cards.push({
        key: `${l.id}-mujer`,
        nombre: l.nombre,
        segLabel: "Unisex · Mujer",
        vibe: l.vibe,
        tags: l.tags,
        image: `/looks/${l.id}-mujer.png`,
      });
    } else {
      cards.push({
        key: l.id,
        nombre: l.nombre,
        segLabel: SEG_LABEL[l.segment] ?? l.segment,
        vibe: l.vibe,
        tags: l.tags,
        image: `/looks/${l.id}.png`,
      });
    }
  }
  return cards;
}

export default function AdminLooks() {
  const cards = toCards();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Looks de swipes</h1>
        <p className="text-sm text-muted">
          {LOOKS.length} looks · {cards.length} fotos. Estos no se editan desde
          aquí — viven en código (<code>lib/looks.ts</code>) y sus imágenes en{" "}
          <code>public/looks/</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
          >
            <div className="relative aspect-[3/4] w-full bg-bg">
              <Image
                src={c.image}
                alt={c.nombre}
                fill
                sizes="180px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-1 p-2">
              <span className="text-sm font-medium text-ink">{c.nombre}</span>
              <span className="text-xs text-muted">
                {c.segLabel} · {c.vibe}
              </span>
              <div className="flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-bg px-2 py-0.5 text-[10px] text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
