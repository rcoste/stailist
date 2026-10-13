import { requireAdmin } from "@/lib/auth";
import { diaEnZona } from "@/lib/admin/adquisicion";
import { esCampanaDePrueba } from "@/lib/embudo-marcas";
import { construirEmbudo, duracion, tiemposDe } from "@/lib/admin/embudo";
import { cargarEmbudo, desdeHace, visitasLanding } from "@/lib/admin/embudo-datos";
import { opcionesDe, pasaFiltro } from "@/lib/admin/filtro-personas";
import { gruposDeQuien } from "../_compartido/filtros-quien";
import { Chip, Cifra, Encabezado, Fila, Filtros, Lista, Panel, Quien, Renglon, Vacio } from "../_ui";

// EL EMBUDO POR PASOS (2026-10-09; capa visual con el kit desde 2026-10-13): a
// dónde llega la gente, cuánto tarda en cada paso y quién se quedó en cuál. La
// lógica y sus tres reglas (llegar es monótono, "se quedó" vs "en curso",
// volver con el criterio del plan) viven en lib/admin/embudo.ts; las
// definiciones en pantalla, en /admin/como-se-cuenta. Sin RLS: se vuelve a
// exigir admin aunque el layout ya lo haga.

export const dynamic = "force-dynamic";

const PERIODOS = [14, 30, 60] as const;

type Filtro = { dias: number; origen: string; pais: string; onboarding: string };

export default async function Embudo({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; origen?: string; pais?: string; onboarding?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const dias = PERIODOS.includes(Number(q.dias) as (typeof PERIODOS)[number]) ? Number(q.dias) : 14;
  const f: Filtro = { dias, origen: q.origen || "todas", pais: q.pais || "todos", onboarding: q.onboarding || "todas" };

  const desde = desdeHace(dias);
  const [todas, landing] = await Promise.all([cargarEmbudo(desde), visitasLanding(diaEnZona(desde))]);
  const personas = todas.filter((p) => pasaFiltro(p, f));
  const filas = construirEmbudo(personas);
  const { campanas, paises } = opcionesDe(todas);

  // La landing no sabe de países: con ese filtro no hay con qué compararla.
  const visitas =
    f.pais !== "todos"
      ? null
      : landing
          .filter((l) => !esCampanaDePrueba(l.campana))
          .filter((l) =>
            f.origen === "todas"
              ? true
              : f.origen === "anuncios"
                ? l.campana !== "—"
                : f.origen === "organico"
                  ? l.campana === "—"
                  : l.campana === f.origen
          )
          .reduce((t, l) => t + l.n, 0);

  // Lo que se lee primero: cuánto tarda el primer look contra la promesa.
  const alPrimerLook = personas
    .map((p) => tiemposDe(p))
    .filter((t) => t.inicio && t.primer_look)
    .map((t) => (Date.parse(t.primer_look!) - Date.parse(t.inicio!)) / 1000)
    .sort((a, b) => a - b);
  const medianaPrimerLook = alPrimerLook.length ? Math.round(alPrimerLook[Math.floor(alPrimerLook.length / 2)]) : null;
  const bajoDosMin = alPrimerLook.filter((s) => s <= 120).length;

  // La fuga más grande: el paso que más gente pierde contra el anterior.
  let fuga = -1;
  let peor = 0;
  filas.forEach((fila, i) => {
    if (i === 0) return;
    const perdidos = filas[i - 1].llegaron - fila.llegaron;
    if (perdidos > peor) {
      peor = perdidos;
      fuga = i;
    }
  });

  const base = filas[0].llegaron;
  const primerLook = filas.find((x) => x.id === "primer_look")?.llegaron ?? 0;
  const href = (cambio: Partial<Filtro>) => {
    const n = { ...f, ...cambio };
    return `/admin/embudo?dias=${n.dias}&origen=${encodeURIComponent(n.origen)}&pais=${n.pais}&onboarding=${n.onboarding}`;
  };

  return (
    <>
      <Encabezado titulo="Embudo" sub="Paso por paso: cuántas llegan a cada pantalla, cuánto tardan y quién se quedó en cuál." />

      <Filtros
        grupos={[
          {
            titulo: "empezó",
            opciones: PERIODOS.map((d) => ({ href: href({ dias: d }), label: `${d} días`, activo: f.dias === d })),
          },
          ...gruposDeQuien({ origen: f.origen, pais: f.pais, onboarding: f.onboarding, campanas, paises, href }),
        ]}
      />

      <Fila cols={4}>
        <Cifra label="Visitaron la landing" valor={visitas == null ? "—" : visitas} sub={visitas == null ? "la landing no sabe de países" : undefined} />
        <Cifra label="Empezaron el onboarding" valor={base} />
        <Cifra
          label="Llegaron al primer look"
          valor={primerLook}
          unidad={base ? `${Math.round((primerLook / base) * 100)}% de los que empezaron` : undefined}
        />
        <Cifra
          label="Tardan al primer look"
          valor={duracion(medianaPrimerLook)}
          unidad={medianaPrimerLook != null ? "mediana" : undefined}
          sub={alPrimerLook.length ? `promesa: 2 min · ${bajoDosMin} de ${alPrimerLook.length} la cumplen` : undefined}
        />
      </Fila>

      <Panel titulo="Paso por paso" sinPadding>
        {base === 0 ? (
          <Vacio>Nadie empezó el onboarding con estos filtros.</Vacio>
        ) : (
          <Lista>
            {filas.map((fila, i) => {
              const previo = i === 0 ? null : filas[i - 1].llegaron;
              const pctPrevio = previo ? Math.round((fila.llegaron / previo) * 100) : null;
              const ancho = Math.round((fila.llegaron / base) * 100);
              const datos = [
                i > 0 ? `tardan ${duracion(fila.medianaSeg)} desde el anterior` : null,
                fila.enCurso ? `${fila.enCurso} en esta pantalla ahora` : null,
                fila.aunPueden ? `${fila.aunPueden} todavía dentro de su semana` : null,
              ].filter((x): x is string => x != null);
              return (
                <Renglon key={fila.id} className="py-3">
                  <div className="flex w-full min-w-0 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-baseline gap-2 text-sm font-bold text-ink">
                        <span className="truncate">
                          {i + 1}. {fila.label}
                        </span>
                        {i === fuga ? <Chip tono="error">la mayor fuga</Chip> : null}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink">
                        {fila.llegaron}
                        {pctPrevio != null ? <span className="text-muted"> · {pctPrevio}% del anterior</span> : null}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-tile">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${ancho}%` }} />
                    </div>
                    {datos.length > 0 ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                        {datos.map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                    ) : null}
                    {fila.seQuedaron.length > 0 ? (
                      // La única excepción al "sin acordeones": despliega nombres, no esconde una sección.
                      <details className="text-[13px] text-muted">
                        <summary className="cursor-pointer hover:text-ink">{fila.seQuedaron.length} se quedaron aquí</summary>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {fila.seQuedaron.map((p) => (
                            <Quien key={p.id} correo={p.etiqueta} href={`/admin/usuarios/${p.id}`} />
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </Renglon>
              );
            })}
          </Lista>
        )}
      </Panel>
    </>
  );
}
