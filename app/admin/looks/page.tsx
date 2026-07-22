import Image from "next/image";
import { LOOKS, looksForGender } from "@/lib/looks";

// QA de los decks del swipe, SEPARADOS por género: cada sección muestra
// exactamente las cartas (y las imágenes) que ese género ve en el flujo real
// (looksForGender — la misma función del swipe), para revisar carta por carta
// si algún look hay que rehacerlo o cambiarlo. No se edita desde aquí: los
// estilos viven en código (lib/looks.ts) y sus imágenes en public/looks/.
export default function AdminLooks() {
  const decks = [
    { id: "mujer", titulo: "Deck mujer", looks: looksForGender("mujer") },
    { id: "hombre", titulo: "Deck hombre", looks: looksForGender("hombre") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Looks de swipes</h1>
        <p className="text-sm text-muted">
          {LOOKS.length} estilos · deck mujer {decks[0].looks.length} cartas ·
          deck hombre {decks[1].looks.length} cartas. Cada sección es lo que ese
          género ve en el swipe, con su imagen real. Se editan en código (
          <code>lib/looks.ts</code>) e imágenes en <code>public/looks/</code>.
        </p>
        <div className="mt-1 flex gap-2">
          {decks.map((d) => (
            <a
              key={d.id}
              href={`#deck-${d.id}`}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:border-ink"
            >
              {d.titulo} ↓
            </a>
          ))}
        </div>
      </div>

      {decks.map((d) => (
        <section key={d.id} id={`deck-${d.id}`} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">
            {d.titulo}{" "}
            <span className="text-sm font-normal text-muted">
              · {d.looks.length} cartas, en el orden del swipe
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {d.looks.map((l) => (
              <div
                key={l.id}
                className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
              >
                <div className="relative aspect-[3/4] w-full bg-bg">
                  <Image
                    src={l.image ?? ""}
                    alt={l.nombre}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col gap-1 p-2">
                  <span className="text-sm font-medium text-ink">{l.nombre}</span>
                  <span className="text-xs text-muted">
                    {l.segment === "unisex" ? "unisex" : `solo ${l.segment}`} ·{" "}
                    {l.vibe}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {l.tags.map((t) => (
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
        </section>
      ))}
    </div>
  );
}
