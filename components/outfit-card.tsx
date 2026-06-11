type Prenda = {
  nombre: string;
  detalle: string;
  /** color de muestra mientras no hay imagen (token o hex del attrs de la prenda) */
  swatch: string;
};

export function OutfitCard({
  prendas,
  justificacion,
}: {
  prendas: Prenda[];
  justificacion: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]">
      <div className="grid grid-cols-3 gap-3">
        {prendas.map((p) => (
          <figure key={p.nombre} className="flex flex-col gap-2">
            <div
              className="flex aspect-[3/4] items-end justify-center rounded-xl border border-line p-2"
              style={{ backgroundColor: p.swatch }}
              aria-hidden
            />
            <figcaption>
              <p className="text-xs font-medium uppercase tracking-wide text-ink">
                {p.nombre}
              </p>
              <p className="editorial text-xs text-muted">{p.detalle}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <hr className="my-4 border-line" />
      <p className="editorial text-center text-sm text-ink">{justificacion}</p>
    </article>
  );
}
