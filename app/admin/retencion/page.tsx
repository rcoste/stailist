import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { banderaDe, paisEnPalabras } from "@/lib/lugar";
import { DIAS_TABLA, curva, diasEntre, fila, volvieronEnSuSemana, type Celda } from "@/lib/admin/retencion";
import { cargarRetencion, periodo } from "@/lib/admin/retencion-datos";
import { opcionesDe, pasaFiltro } from "@/lib/admin/filtro-personas";
import { Chips, ChipsQuien } from "../_compartido/chips";

// LA TABLA DE RETENCIÓN (2026-10-09): una fila por persona, una columna por día
// desde que empezó, relleno si ese día entró. Las reglas (qué es "entrar" y por
// qué el denominador es quien ya vivió ese día) viven en lib/admin/retencion.ts.
// Sin RLS: se vuelve a exigir admin aunque el layout ya lo haga.

export const dynamic = "force-dynamic";

const PERIODOS = [14, 30, 60] as const;

const CELDA: Record<Celda, string> = {
  entro: "bg-ink",
  no: "bg-tile",
  futuro: "border border-line",
};

export default async function Retencion({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; origen?: string; pais?: string; ver?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const dias = PERIODOS.includes(Number(q.dias) as (typeof PERIODOS)[number]) ? Number(q.dias) : 30;
  const f = { dias, origen: q.origen || "todas", pais: q.pais || "todos", ver: q.ver === "volvieron" ? "volvieron" : "todas" };

  const { hoy, desde } = periodo(dias);
  const todas = await cargarRetencion(desde);
  const personas = todas.filter((p) => pasaFiltro(p, f));
  const { campanas, paises } = opcionesDe(todas);
  const puntos = curva(personas, hoy);
  const semana = volvieronEnSuSemana(personas, hoy);
  const volvieron = personas.filter((p) => p.dias.length > 0).length;
  const visibles = f.ver === "volvieron" ? personas.filter((p) => p.dias.length > 0) : personas;

  const href = (cambio: Partial<typeof f>) => {
    const n = { ...f, ...cambio };
    return `/admin/retencion?dias=${n.dias}&origen=${encodeURIComponent(n.origen)}&pais=${n.pais}&ver=${n.ver}`;
  };
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Retención</h1>
        <p className="text-sm text-muted">
          Una fila por persona y una columna por día desde que empezó el onboarding (día 0). El
          cuadro negro es que ese día entró a la app; el gris, que no; el vacío, que ese día todavía no
          llega. Volver es el criterio del plan: otro día y al menos 4 horas después de empezar.
        </p>
      </header>

      <div className="flex flex-col gap-2 text-sm">
        <Chips
          titulo="empezó"
          opciones={PERIODOS.map((d) => ({ href: href({ dias: d }), label: `últimos ${d} días`, activo: f.dias === d }))}
        />
        <ChipsQuien origen={f.origen} pais={f.pais} campanas={campanas} paises={paises} href={href} />
        <Chips
          titulo="ver"
          opciones={[
            { href: href({ ver: "todas" }), label: `todas (${personas.length})`, activo: f.ver === "todas" },
            { href: href({ ver: "volvieron" }), label: `sólo las que volvieron (${volvieron})`, activo: f.ver === "volvieron" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {puntos.map((p) => (
          <div key={p.dia} className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5">
            <span className="text-xs text-muted">{p.dia === 1 ? "volvieron al día siguiente" : `volvieron el día ${p.dia}`}</span>
            <span className="text-xl font-bold tabular-nums text-ink">{pct(p.volvieron, p.de)}</span>
            <span className="text-[11px] text-muted">
              {p.volvieron} de {p.de}
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 rounded-lg border border-ink bg-surface px-3 py-2.5">
          <span className="text-xs text-muted">volvieron en su primera semana</span>
          <span className="text-xl font-bold tabular-nums text-ink">{pct(semana.volvieron, semana.de)}</span>
          <span className="text-[11px] text-muted">
            {semana.volvieron} de {semana.de} con la semana cerrada
          </span>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted">Nadie con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 text-left font-medium">persona</th>
                <th className="px-2 py-2 text-left font-medium">empezó</th>
                {Array.from({ length: DIAS_TABLA + 1 }, (_, d) => (
                  <th key={d} className="px-0.5 py-2 text-center font-medium tabular-nums">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="max-w-56 truncate px-3 py-1.5">
                    <span className="mr-1.5" title={p.pais ? paisEnPalabras(p.pais) : "sin país"}>
                      {banderaDe(p.pais) ?? ""}
                    </span>
                    <Link
                      href={`/admin/usuarios/${p.id}`}
                      className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                    >
                      {p.etiqueta}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-muted">
                    {p.diaInicio.slice(5).split("-").reverse().join("/")}
                    {diasEntre(p.diaInicio, hoy) === 0 ? " · hoy" : ""}
                  </td>
                  {fila(p, hoy).map((c, d) => (
                    <td key={d} className="px-0.5 py-1.5">
                      <span
                        className={`mx-auto block h-4 w-4 rounded-sm ${CELDA[c]}`}
                        title={c === "entro" ? `día ${d}: entró` : c === "no" ? `día ${d}: no entró` : `día ${d}: todavía no llega`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Los porcentajes de arriba sólo cuentan a quien ya vivió ese día completo: quien empezó ayer
        no puede haber vuelto el día 7. Entrar es cualquier acción en la app (abrirla, subir una
        prenda, generar un look), en días de la Ciudad de México. No cuentan las cuentas de admin ni
        las de prueba.
      </p>
    </div>
  );
}
