import Link from "next/link";
import type { Modo, ResultadoModelo } from "@/lib/comparador/tipos";
import { formatoUsd } from "@/lib/proveedores/precios";

// El resultado, ya con nombres. Aquí se levanta el ciego.
//
// EL ORDEN NO ES POR ACIERTOS, es por prendas inventadas primero. Inventar
// manda sobre todo lo demás porque es el único error que la persona no puede
// detectar: leer mal un material se corrige en un tap cuando lo ve; una prenda
// que no existe se queda en el clóset con su render limpio, se ve igual de real
// que las demás, y sólo aparece semanas después dentro de un outfit.
//
// Por eso un modelo barato que inventa NO es barato: cuesta lo que cuesta que
// alguien revise su clóset entero a mano, que es lo que Roberto acabó haciendo.

export function Marcador({
  corridaId,
  modo,
  resultados,
}: {
  corridaId: string;
  modo: Modo;
  resultados: ResultadoModelo[];
}) {
  const fotos = resultados[0]?.fotosJuzgadas ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-ink">Resultados</h1>
        <p className="text-sm leading-relaxed text-muted">
          {fotos} {fotos === 1 ? "foto calificada" : "fotos calificadas"} por modelo.
          {modo === "varias"
            ? " Ordenados por prendas inventadas: ése es el error que no se detecta desde la app."
            : " Ordenados por aciertos."}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {resultados.map((r, n) => {
          const pct = r.fotosJuzgadas ? Math.round((r.impecables / r.fotosJuzgadas) * 100) : 0;
          const fallos = Object.entries(r.fallosPorCampo).sort((a, b) => b[1] - a[1]);
          return (
            <div
              key={r.modeloId}
              className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${
                n === 0 ? "border-accent" : "border-line"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-base font-semibold text-ink">{r.etiqueta}</p>
                <p className="text-2xl font-semibold text-ink tabular-nums">{pct}%</p>
              </div>

              {modo === "varias" ? (
                <div
                  className={`flex items-center justify-between gap-3 rounded-lg p-2 ${
                    r.inventadas > 0 ? "bg-error/10" : "bg-bg"
                  }`}
                >
                  <span className="text-xs text-muted">Prendas que inventó</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      r.inventadas > 0 ? "text-error" : "text-success"
                    }`}
                  >
                    {r.inventadas}
                  </span>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2 text-center">
                <Dato titulo="fotos impecables" valor={`${r.impecables}/${r.fotosJuzgadas}`} />
                <Dato titulo="30 fotos" valor={formatoUsd(r.costoPor30)} />
                <Dato
                  titulo="por foto"
                  valor={r.msPromedio ? `${(r.msPromedio / 1000).toFixed(1)}s` : "—"}
                />
              </div>

              {modo === "varias" && r.omitidas > 0 ? (
                <p className="text-xs text-muted">
                  Se le fueron <span className="font-medium text-ink">{r.omitidas}</span> prendas
                  que sí estaban.
                </p>
              ) : null}

              {r.errores > 0 ? (
                <p className="text-xs text-error">
                  {r.errores} {r.errores === 1 ? "lectura falló" : "lecturas fallaron"}
                </p>
              ) : null}

              {fallos.length ? (
                <p className="text-xs leading-relaxed text-muted">
                  Lee mal:{" "}
                  {fallos.map(([campo, n2], k) => (
                    <span key={campo}>
                      {k > 0 ? " · " : ""}
                      <span className="font-medium text-ink">{campo}</span> {n2}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-xs text-success">No falló ni un campo.</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="rounded-xl border border-line bg-bg p-4 text-xs leading-relaxed text-muted">
        Esto compara modelos con el mismo prompt y el mismo schema que corre en
        producción — no una copia. Lo que ganó aquí, gana allá. Cambiar de modelo
        es una línea en <span className="font-mono text-ink">lib/models.ts</span>.
        Las fotos quedan guardadas: cuando salga un modelo nuevo se le puede
        pasar el mismo examen sin volver a fotografiar nada.
      </p>

      <Link
        href="/admin/comparador"
        className="rounded-xl border border-line py-3 text-center text-sm font-semibold text-ink"
      >
        Volver · corrida {corridaId.slice(0, 8)}
      </Link>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-bg p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{titulo}</p>
      <p className="text-sm font-semibold text-ink tabular-nums">{valor}</p>
    </div>
  );
}
