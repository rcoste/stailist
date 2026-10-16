import { requireAdmin } from "@/lib/auth";
import { DIAS_TABLA, curva, diasEntre, fila, volvieronEnSuSemana, type Celda } from "@/lib/admin/retencion";
import { cargarRetencion, periodo } from "@/lib/admin/retencion-datos";
import { opcionesDe, pasaFiltro } from "@/lib/admin/filtro-personas";
import { gruposDeQuien } from "../_compartido/filtros-quien";
import { Cifra, Encabezado, Fila, Filtros, Panel, Quien, Tabla, Td, Th, Vacio } from "../_ui";
import { TablaMaduracion } from "./maduracion";

// LA TABLA DE RETENCIÓN (2026-10-09; capa visual con el kit desde 2026-10-13):
// una fila por persona, una columna por día desde que empezó, relleno si ese
// día entró. Las reglas (qué es "entrar" y por qué el denominador es quien ya
// vivió ese día) viven en lib/admin/retencion.ts; las definiciones en
// pantalla, en /admin/como-se-cuenta. Sin RLS: se vuelve a exigir admin aunque
// el layout ya lo haga.

export const dynamic = "force-dynamic";

const PERIODOS = [14, 30, 60] as const;

/** Los días que van como cifra grande; el resto de la curva va en una línea apagada. */
const DIAS_GRANDES = [1, 3, 7];

const CELDA: Record<Celda, string> = {
  entro: "bg-ink",
  no: "bg-tile",
  futuro: "border border-line",
};

export default async function Retencion({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; origen?: string; pais?: string; ver?: string; quienes?: string; onboarding?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const dias = PERIODOS.includes(Number(q.dias) as (typeof PERIODOS)[number]) ? Number(q.dias) : 30;
  const f = {
    dias,
    origen: q.origen || "todas",
    pais: q.pais || "todos",
    ver: q.ver === "volvieron" ? "volvieron" : "todas",
    // Por defecto, quien llegó a su primer look: es el universo del criterio
    // de paro, y sin esto la tabla abría con decenas de borradores que nunca
    // llegaron a nada (2026-10-11, visto en pantalla).
    quienes: q.quienes === "todas" ? "todas" : "primer-look",
    onboarding: q.onboarding || "todas",
  };

  const { hoy, desde } = periodo(dias);
  const todas = await cargarRetencion(desde);
  const personas = todas.filter((p) => pasaFiltro(p, f) && (f.quienes === "todas" || p.primerLook));
  const { campanas, paises } = opcionesDe(todas);
  const puntos = curva(personas, hoy);
  const semana = volvieronEnSuSemana(personas, hoy);
  const volvieron = personas.filter((p) => p.dias.length > 0).length;
  const visibles = f.ver === "volvieron" ? personas.filter((p) => p.dias.length > 0) : personas;

  const href = (cambio: Partial<typeof f>) => {
    const n = { ...f, ...cambio };
    return `/admin/retencion?dias=${n.dias}&origen=${encodeURIComponent(n.origen)}&pais=${n.pais}&ver=${n.ver}&quienes=${n.quienes}&onboarding=${n.onboarding}`;
  };
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  const grandes = puntos.filter((p) => DIAS_GRANDES.includes(p.dia));
  const chicos = puntos.filter((p) => !DIAS_GRANDES.includes(p.dia));

  return (
    <>
      <Encabezado titulo="Retención" sub="Una fila por persona, un cuadro por día desde que empezó: negro si entró, gris si no." />

      <Filtros
        grupos={[
          {
            titulo: "empezó",
            opciones: PERIODOS.map((d) => ({ href: href({ dias: d }), label: `${d} días`, activo: f.dias === d })),
          },
          ...gruposDeQuien({ origen: f.origen, pais: f.pais, onboarding: f.onboarding, campanas, paises, href }),
          {
            titulo: "quiénes",
            opciones: [
              { href: href({ quienes: "primer-look" }), label: "llegaron a su primer look", activo: f.quienes === "primer-look" },
              { href: href({ quienes: "todas" }), label: "todas", activo: f.quienes === "todas" },
            ],
          },
          {
            titulo: "ver",
            opciones: [
              { href: href({ ver: "todas" }), label: `todas (${personas.length})`, activo: f.ver === "todas" },
              { href: href({ ver: "volvieron" }), label: `sólo las que volvieron (${volvieron})`, activo: f.ver === "volvieron" },
            ],
          },
        ]}
      />

      {/* El número grande es "cuántas de cuántas": con muestras de 6 o de 2, un
          "0%" o un "17%" en grande engaña más de lo que informa. */}
      <Fila cols={4} className="mb-2">
        {grandes.map((p) => (
          <Cifra
            key={p.dia}
            label={p.dia === 1 ? "Volvieron al día siguiente" : `Volvieron el día ${p.dia}`}
            valor={p.volvieron}
            unidad={`de ${p.de}`}
            sub={p.de ? pct(p.volvieron, p.de) : "nadie ha llegado a ese día"}
          />
        ))}
        <Cifra
          label="Volvieron en su primera semana"
          valor={semana.volvieron}
          unidad={`de ${semana.de}`}
          tono={semana.volvieron > 0 ? "success" : "ink"}
          barra={{ n: semana.volvieron, de: semana.de }}
          sub={semana.de ? `${pct(semana.volvieron, semana.de)} · con la semana cerrada` : "nadie ha cerrado su semana"}
        />
      </Fila>
      <p className="mb-4 text-[13px] text-muted">
        {chicos.map((p) => `día ${p.dia}: ${p.volvieron} de ${p.de}`).join(" · ")}
      </p>

      <TablaMaduracion personas={personas} hoy={hoy} />

      <Panel titulo="Por persona" sinPadding>
        {visibles.length === 0 ? (
          <Vacio>Nadie con estos filtros.</Vacio>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th izq>persona</Th>
                <Th izq>empezó</Th>
                {Array.from({ length: DIAS_TABLA + 1 }, (_, d) => (
                  <Th key={d} className="pl-1 pr-1 text-center tabular-nums">
                    {d}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <Td izq className="max-w-56">
                    <Quien correo={p.etiqueta} pais={p.pais} href={`/admin/usuarios/${p.id}`} />
                  </Td>
                  <Td izq className="whitespace-nowrap text-muted">
                    {p.diaInicio.slice(5).split("-").reverse().join("/")}
                    {diasEntre(p.diaInicio, hoy) === 0 ? " · hoy" : ""}
                  </Td>
                  {fila(p, hoy).map((c, d) => (
                    <Td key={d} className="pl-1 pr-1">
                      <span
                        className={`mx-auto block h-4 w-4 rounded-sm ${CELDA[c]}`}
                        title={c === "entro" ? `día ${d}: entró` : c === "no" ? `día ${d}: no entró` : `día ${d}: todavía no llega`}
                      />
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </>
  );
}
