import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { diaEnZona } from "@/lib/admin/adquisicion";
import { esCampanaDePrueba } from "@/lib/embudo-marcas";
import { banderaDe, paisEnPalabras } from "@/lib/lugar";
import { PASOS, construirEmbudo, duracion, tiemposDe } from "@/lib/admin/embudo";
import { cargarEmbudo, desdeHace, visitasLanding, type PersonaConOrigen } from "@/lib/admin/embudo-datos";

// EL EMBUDO POR PASOS (2026-10-09): a dónde llega la gente, cuánto tarda en
// cada paso y quién se quedó en cuál. La lógica y sus tres reglas (llegar es
// monótono, "se quedó" vs "en curso", volver con el criterio del plan) viven en
// lib/admin/embudo.ts. Sin RLS: se vuelve a exigir admin aunque el layout ya lo
// haga, como en adquisición.

export const dynamic = "force-dynamic";

const PERIODOS = [7, 14, 30] as const;

type Filtros = { dias: number; origen: string; pais: string };

function filtrar(personas: PersonaConOrigen[], f: Filtros): PersonaConOrigen[] {
  return personas.filter((p) => {
    if (esCampanaDePrueba(p.campana)) return false;
    if (f.origen === "anuncios" && p.campana === "—") return false;
    if (f.origen === "organico" && p.campana !== "—") return false;
    if (f.origen !== "todas" && f.origen !== "anuncios" && f.origen !== "organico" && p.campana !== f.origen)
      return false;
    if (f.pais === "sin" && p.pais) return false;
    if (f.pais !== "todos" && f.pais !== "sin" && p.pais !== f.pais) return false;
    return true;
  });
}

export default async function Embudo({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; origen?: string; pais?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const dias = PERIODOS.includes(Number(q.dias) as (typeof PERIODOS)[number]) ? Number(q.dias) : 14;
  const f: Filtros = { dias, origen: q.origen || "todas", pais: q.pais || "todos" };

  const desde = desdeHace(dias);
  const [todas, landing] = await Promise.all([cargarEmbudo(desde), visitasLanding(diaEnZona(desde))]);
  const personas = filtrar(todas, f);
  const filas = construirEmbudo(personas);

  const campanas = [...new Set(todas.map((p) => p.campana))]
    .filter((c) => c !== "—" && !esCampanaDePrueba(c))
    .sort();
  const paises = [...new Set(todas.map((p) => p.pais).filter((p): p is string => !!p))].sort();

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
  const href = (cambio: Partial<Filtros>) => {
    const n = { ...f, ...cambio };
    return `/admin/embudo?dias=${n.dias}&origen=${encodeURIComponent(n.origen)}&pais=${n.pais}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Embudo</h1>
        <p className="text-sm text-muted">
          Paso por paso, de quienes empezaron el onboarding en el periodo: cuántas llegan a cada
          pantalla, cuánto tardan desde la anterior y quién se quedó en cuál. Cada paso cuenta a quien
          lo terminó; “se quedaron en esta pantalla” son quienes terminaron el anterior y no éste, y
          llevan más de media hora sin moverse.
        </p>
      </header>

      <div className="flex flex-col gap-2 text-sm">
        <Chips
          titulo="periodo"
          opciones={PERIODOS.map((d) => ({ href: href({ dias: d }), label: `${d} días`, activo: f.dias === d }))}
        />
        <Chips
          titulo="origen"
          opciones={[
            { valor: "todas", label: "todas" },
            { valor: "anuncios", label: "anuncios" },
            { valor: "organico", label: "sin anuncio" },
            ...campanas.map((c) => ({ valor: c, label: c })),
          ].map((o) => ({ href: href({ origen: o.valor }), label: o.label, activo: f.origen === o.valor }))}
        />
        <Chips
          titulo="país"
          opciones={[
            { valor: "todos", label: "todos" },
            ...paises.map((p) => ({ valor: p, label: `${banderaDe(p) ?? ""} ${paisEnPalabras(p)}`.trim() })),
            { valor: "sin", label: "sin dato" },
          ].map((o) => ({ href: href({ pais: o.valor }), label: o.label, activo: f.pais === o.valor }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="visitaron la landing" valor={visitas == null ? "—" : String(visitas)} />
        <Dato titulo="empezaron el onboarding" valor={String(base)} />
        <Dato
          titulo="llegaron al primer look"
          valor={`${filas.find((x) => x.id === "primer_look")?.llegaron ?? 0}`}
        />
        <Dato
          titulo="tardan al primer look (mediana)"
          valor={duracion(medianaPrimerLook)}
          nota={alPrimerLook.length ? `promesa: 2 min · ${bajoDosMin} de ${alPrimerLook.length} la cumplen` : undefined}
        />
      </div>

      {base === 0 ? (
        <p className="text-sm text-muted">Nadie empezó el onboarding con estos filtros.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {filas.map((fila, i) => {
            const previo = i === 0 ? null : filas[i - 1].llegaron;
            const pctPrevio = previo ? Math.round((fila.llegaron / previo) * 100) : null;
            const ancho = base ? Math.round((fila.llegaron / base) * 100) : 0;
            return (
              <li key={fila.id} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {i + 1}. {fila.label}
                    {i === fuga ? (
                      <span className="ml-2 rounded-full border border-error px-1.5 text-[11px] font-semibold text-error">
                        la mayor fuga
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-sm text-ink">
                    {fila.llegaron}
                    {pctPrevio != null ? <span className="text-muted"> · {pctPrevio}% del anterior</span> : null}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-tile">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${ancho}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {i > 0 ? <span>tardan {duracion(fila.medianaSeg)} desde el anterior</span> : null}
                  {fila.enCurso ? <span>{fila.enCurso} en esta pantalla ahora</span> : null}
                  {fila.aunPueden ? <span>{fila.aunPueden} todavía dentro de su semana</span> : null}
                </div>
                {fila.seQuedaron.length ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-ink">
                      {fila.seQuedaron.length} se quedaron en esta pantalla
                    </summary>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {fila.seQuedaron.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/admin/usuarios/${p.id}`}
                            className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                          >
                            {p.etiqueta}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-muted">
        Los pasos son {PASOS.length}. Quien llegó a uno cuenta como que pasó por los anteriores aunque
        falte su registro (el onboarding cambió con el tiempo). “Volvió” es el criterio del plan: otro
        día, 4 horas después de empezar y dentro de 7 días. No cuentan las cuentas de admin ni las de
        prueba.
      </p>
    </div>
  );
}

function Chips({
  titulo,
  opciones,
}: {
  titulo: string;
  opciones: { href: string; label: string; activo: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-xs text-muted">{titulo}</span>
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            o.activo ? "border-ink bg-ink text-on-accent" : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5">
      <span className="text-xs text-muted">{titulo}</span>
      <span className="text-xl font-bold tabular-nums text-ink">{valor}</span>
      {nota ? <span className="text-[11px] text-muted">{nota}</span> : null}
    </div>
  );
}
