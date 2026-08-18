import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { cargarCorridaMotor } from "@/lib/comparador/motor-servidor";
import { resumirPorVariante } from "@/lib/engine/resumen-ronda";
import type { CriticaStylist } from "@/lib/engine/juez-stylist";
import type { NotaRubrica } from "@/lib/engine/rubrica";

export const dynamic = "force-dynamic";

// AUDITAR LO QUE VIERON E HICIERON LOS JUECES.
//
// Roberto: "me gustaría una pantalla ya que es un proceso clave y que después
// me gustaría poder auditar lo que vieron e hicieron los jueces, y lo que salió
// en la rúbrica".
//
// LO QUE ESTA PANTALLA ES: el resultado de la ronda ANTES de que él vote. Los
// tres jueces —el que lee, el que mira y el stylist— pasaron por los mismos
// looks; aquí se ve qué encontró cada uno y, sobre todo, qué se repite.
//
// EL ORDEN DE LA PÁGINA ES LA TESIS: primero los TEMAS (lo que se repite, que
// es lo que se convierte en el siguiente ajuste del motor), después el detalle
// look por look (la auditoría). Al revés obligaría a leer 240 notas para
// descubrir lo que el conteo dice de una.
//
// POR QUÉ LAS NOTAS DE LAS DOS RÚBRICAS SE ENSEÑAN JUNTAS Y SIN PROMEDIAR: si
// la que lee aprueba y la que mira reprueba, esa discrepancia es el dato — casi
// siempre significa que el fallo está en la imagen y no en el nombre, que es
// justo lo que un promedio escondería.

function Chip({ children, tono }: { children: React.ReactNode; tono: "rojo" | "naranja" | "gris" }) {
  const clases =
    tono === "rojo"
      ? "border-error text-error"
      : tono === "naranja"
        ? "border-warning text-warning"
        : "border-line text-muted";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${clases}`}>
      {children}
    </span>
  );
}

function NotaBreve({ etiqueta, nota }: { etiqueta: string; nota: NotaRubrica | null }) {
  if (!nota) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {etiqueta} {nota.aprobado ? "👍" : "👎"}
      </span>
      <span className="text-sm text-ink">{nota.porQue}</span>
      <span className="text-xs text-muted">
        ocasión {nota.ocasion} · clima {nota.clima} · armado {nota.armado} · estilo{" "}
        {nota.estilo} · color {nota.color} · wow {nota.wow}
      </span>
    </div>
  );
}

export default async function JuecesDeCorrida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const corrida = await cargarCorridaMotor(id);

  if (!corrida) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">No encontré esa corrida.</p>
        <Link href="/admin/comparador" className="text-sm font-semibold text-accent">
          Volver
        </Link>
      </div>
    );
  }

  const claves = corrida.variantes.map((v) => v.clave);
  const etiqueta = (c: string) =>
    corrida.variantes.find((v) => v.clave === c)?.etiqueta ?? c;
  const reales = corrida.pares.filter((p) => !p.repiteDe);

  // Los hallazgos del stylist, agrupados por variante.
  const criticasPorVariante: Record<string, CriticaStylist[]> = {};
  for (const par of reales) {
    for (const lado of par.lados) {
      const cs = lado.criticas ?? [];
      if (!cs.length) continue;
      (criticasPorVariante[lado.variante] ??= []).push(...cs);
    }
  }
  const hayStylist = Object.keys(criticasPorVariante).length > 0;
  const porVariante = hayStylist ? resumirPorVariante(criticasPorVariante) : {};

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/comparador/motor/${id}`} className="text-xs text-muted">
          ← volver a la corrida
        </Link>
        <h1 className="text-h2 font-semibold text-ink">Lo que vieron los jueces</h1>
        <p className="text-sm text-muted">
          {etiqueta(claves[0])} contra {etiqueta(claves[1])} · prompt{" "}
          {corrida.promptVersion} · {reales.length} pares
        </p>
      </div>

      {!hayStylist ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-ink">Esta corrida todavía no pasó por los jueces.</p>
          <p className="mt-1 text-xs text-muted">
            Córrelos con{" "}
            <code className="rounded bg-bg px-1">
              npx tsx scripts/comparador-juzgar.ts {id}
            </code>
          </p>
        </div>
      ) : null}

      {/* ── LOS TEMAS: lo que se repite ─────────────────────────────────── */}
      {hayStylist
        ? claves.map((clave) => {
            const r = porVariante[clave];
            if (!r) return null;
            return (
              <section key={clave} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    {etiqueta(clave)}
                  </h2>
                  <span className="text-xs text-muted">
                    {r.conHallazgos} de {r.looks} looks con algo que decir ·{" "}
                    {r.conRotos} con un fallo que rompe
                  </span>
                </div>
                {r.temas.length === 0 ? (
                  <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
                    El stylist no marcó nada en este lado.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {r.temas.map((t) => (
                      <div key={t.defecto} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Chip
                            tono={
                              t.peor === "rompe"
                                ? "rojo"
                                : t.peor === "resta"
                                  ? "naranja"
                                  : "gris"
                            }
                          >
                            {t.peor}
                          </Chip>
                          <span className="text-sm font-semibold text-ink">{t.label}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted">
                            {t.looks} looks · {t.hallazgos} hallazgos
                          </span>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {t.ejemplos.map((e, i) => (
                            <li key={i} className="flex flex-col">
                              <span className="text-sm text-ink">
                                <span className="font-medium">{e.pieza}:</span> {e.problema}
                              </span>
                              <span className="text-sm text-muted">→ {e.arreglo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        : null}

      {hayStylist ? (
        <p className="text-xs text-muted">
          Los temas de arriba son la lista de qué ajustar en el motor. Cada uno que
          se repita es candidato a regla comprobable en código.
        </p>
      ) : null}

      {/* ── LA AUDITORÍA: look por look ─────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Look por look
          </h2>
          <span className="text-xs text-muted">
            lo que dijo cada juez, sin promediar — si la que lee y la que mira
            discrepan, eso es el dato
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {reales.map((par) => (
            <div key={par.id} className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                #{par.n} · {par.brief.etiqueta}
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {claves.map((clave) => {
                  const lado = par.lados.find((l) => l.variante === clave);
                  const looks = lado?.looks ?? [];
                  return (
                    <div
                      key={clave}
                      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3"
                    >
                      <span className="text-xs font-semibold text-ink">
                        {etiqueta(clave)}
                      </span>
                      {looks.length === 0 ? (
                        <span className="text-xs text-muted">sin looks</span>
                      ) : (
                        looks.map((look, i) => {
                          const critica = lado?.criticas?.[i] ?? null;
                          return (
                            <div key={i} className="flex flex-col gap-1.5 border-t border-line pt-2 first:border-0 first:pt-0">
                              <span className="text-sm font-medium text-ink">
                                {look.nombre}
                              </span>
                              <NotaBreve etiqueta="lee" nota={lado?.notas?.[i] ?? null} />
                              <NotaBreve
                                etiqueta="mira"
                                nota={lado?.notasVision?.[i] ?? null}
                              />
                              {critica ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                                    stylist
                                  </span>
                                  {critica.hallazgos.length === 0 ? (
                                    <span className="text-sm text-muted">
                                      sin hallazgos
                                    </span>
                                  ) : (
                                    <ul className="flex flex-col gap-1">
                                      {critica.hallazgos.map((h, j) => (
                                        <li key={j} className="flex flex-col">
                                          <span className="text-sm text-ink">
                                            <span className="font-medium">{h.pieza}:</span>{" "}
                                            {h.problema}
                                          </span>
                                          <span className="text-sm text-muted">
                                            → {h.arreglo}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {critica.loQueFunciona ? (
                                    <span className="text-xs text-muted">
                                      sí funciona: {critica.loQueFunciona}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
