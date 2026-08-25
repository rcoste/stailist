import { recetasConReconstruccion } from "@/lib/recetas";

// La prueba de reconstrucción, en grande.
//
// Cada look de esta pantalla se generó usando ÚNICAMENTE el texto de la receta
// —el generador no vio ninguna foto de referencia—, así que si el look se ve
// como el estilo del que salió, la destilación capturó el estilo; y si no, está
// mal y hay que arreglarla antes de que llegue al motor.
//
// La receta va JUNTO a sus imágenes a propósito: juzgar "¿esto es sastre?" sin
// ver qué dice la receta obliga a adivinar de dónde salió el error cuando algo
// no cuadra.
export const dynamic = "force-dynamic";

const CLIMAS = ["calor / templado", "templado", "frío"];

export default async function AdminRecetas() {
  const familias = await recetasConReconstruccion();

  return (
    <div className="flex flex-col gap-10">
      <p className="text-sm text-muted">
        Cada look salió <span className="text-ink">solo del texto de la receta</span> — el
        generador no vio ninguna foto de referencia. Si se ve como el estilo, la
        destilación funcionó.
      </p>

      {familias.map((f) => {
        const porClima = (c: string) => f.receta.formulas.filter((x) => x.clima === c);
        const tieneFrio = porClima("frio").length > 0;
        return (
          <section key={f.familia} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold text-ink">{f.familia}</h2>
              <span className="text-sm text-muted">
                {f.conteo.total} fotos · calor {f.conteo.calor} · templado {f.conteo.templado} ·
                frío {f.conteo.frio}
              </span>
            </div>

            {/* Una columna por look en el celular, tres en pantalla ancha: la
                comparación entre climas es horizontal y apilarlos la rompe. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {f.reconstruccion.map((url, i) => (
                <figure key={url} className="flex flex-col gap-1">
                  {/* aspect-[3/4] reserva el hueco antes de que baje la foto:
                      sin eso, cada imagen que aterriza empuja el contenido y la
                      página salta bajo el cursor mientras se lee.
                      loading lazy porque son 30 fotos y solo se ven 3 a la vez:
                      cargarlas todas de golpe era lo que hacía la espera. */}
                  <div className="aspect-[3/4] overflow-hidden rounded-lg border border-line bg-tile">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage */}
                    <img
                      src={url}
                      alt={`${f.familia} ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="text-xs text-muted">
                    {i === 2 && !tieneFrio ? "templado" : CLIMAS[i]}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-sm">
              <p>
                <span className="font-semibold text-ink">Silueta.</span>{" "}
                <span className="text-muted">{f.receta.silueta}</span>
              </p>
              <p>
                <span className="font-semibold text-ink">Paleta.</span>{" "}
                <span className="text-muted">{f.receta.paleta}</span>
              </p>

              {(["calor", "templado", "frio"] as const).map((c) =>
                porClima(c).length ? (
                  <div key={c} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink">
                      {c} · {porClima(c).length}
                    </span>
                    <ul className="flex flex-col gap-0.5 text-muted">
                      {porClima(c).map((x) => (
                        <li key={x.look}>· {x.look}</li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}

              {f.receta.frio.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink">
                    cómo abriga
                  </span>
                  <ul className="flex flex-col gap-0.5 text-muted">
                    {f.receta.frio.map((x) => (
                      <li key={x}>· {x}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink">
                  evitar
                </span>
                <ul className="flex flex-col gap-0.5 text-muted">
                  {f.receta.evitar.map((x) => (
                    <li key={x}>· {x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
