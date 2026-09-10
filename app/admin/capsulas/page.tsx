import { createClient } from "@/lib/supabase/server";
import { revisarCapsula, type HallazgoCapsula } from "@/lib/engine/capsule-revision";
import type { CapsuleItem, CapsuleTarget } from "@/lib/capsule";

// LO QUE EL JUEZ DE LA CÁPSULA ENCONTRÓ, en una pantalla.
//
// El juez (lib/engine/capsule-revision) existe desde v0.2.319.0 y hasta ahora
// escribía sus hallazgos en `capsule_target.revision` — donde nadie los veía
// sin consultar la base a mano. Un juez sin lector es medio juez.
//
// CORRE EN VIVO, no lee la `revision` guardada, y esa es la decisión que hace
// útil la pantalla: el juez sólo se ejecuta AL GENERAR, así que las cápsulas
// que ya existen no tienen revisión ninguna. Ejecutarlo aquí sobre lo que hay
// enseña los huecos de HOY sin esperar a que nadie regenere — los dos que se
// encontraron el 2026-09-09 (Tatiana sin bottoms formales, mleomarti sin
// calzado formal) siguen ahí y sólo se ven así.
//
// Es de lectura pura: no escribe, no repara, no regenera. Llenar un hueco pide
// criterio de stylist y su paleta, y esa decisión es de Roberto, no de una
// pantalla de admin.
export const dynamic = "force-dynamic";

type Fila = {
  correo: string;
  gender: string | null;
  techo: string | null;
  piezas: number;
  hallazgos: HallazgoCapsula[];
};

export default async function AdminCapsulas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("email, gender, lifestyle, capsule_target")
    .not("capsule_target", "is", null);

  const filas: Fila[] = (data ?? [])
    .map((p) => {
      const target = p.capsule_target as CapsuleTarget | null;
      const items = (target?.items ?? []) as CapsuleItem[];
      const vida = (p.lifestyle ?? {}) as Record<string, string | undefined>;
      return {
        correo: (p.email as string) ?? "—",
        gender: (p.gender as string) ?? null,
        techo: vida.formalidad_techo ?? null,
        piezas: items.length,
        hallazgos: items.length
          ? revisarCapsula(items, {
              gender: (p.gender as "hombre" | "mujer" | null) ?? null,
              techo: vida.formalidad_techo ?? null,
              clima: vida.clima ?? null,
            })
          : [],
      };
    })
    // Las que tienen hallazgos primero: es a lo que se entra a esta pantalla.
    .sort((a, b) => b.hallazgos.length - a.hallazgos.length || a.correo.localeCompare(b.correo));

  const conHallazgos = filas.filter((f) => f.hallazgos.length > 0);
  const porRegla = new Map<string, number>();
  for (const f of conHallazgos) {
    for (const h of f.hallazgos) porRegla.set(h.regla, (porRegla.get(h.regla) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Cápsulas</h1>
        <p className="text-sm text-muted">
          <b className="tabular text-ink">{conHallazgos.length}</b> de{" "}
          <b className="tabular text-ink">{filas.length}</b> con huecos. El juez corre
          aquí en vivo, así que esto incluye las cápsulas viejas — que no tienen
          revisión guardada porque se generaron antes de que existiera.
        </p>
      </div>

      {porRegla.size > 0 ? (
        <div className="flex flex-wrap gap-2">
          {[...porRegla]
            .sort((a, b) => b[1] - a[1])
            .map(([regla, n]) => (
              <span
                key={regla}
                className="rounded-sm border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted"
              >
                {regla} <b className="tabular text-ink">{n}</b>
              </span>
            ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {filas.map((f) => (
          <div
            key={f.correo}
            className={`rounded-md border bg-surface p-4 ${
              f.hallazgos.length ? "border-ink" : "border-line"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-bold text-ink">{f.correo}</span>
              <span className="text-xs text-muted">
                {f.gender ?? "—"} · techo {f.techo ?? "—"} ·{" "}
                <span className="tabular">{f.piezas}</span> piezas
              </span>
              {f.hallazgos.length === 0 ? (
                <span className="ml-auto text-xs font-medium text-muted">sin huecos</span>
              ) : null}
            </div>
            {f.hallazgos.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {f.hallazgos.map((h, i) => (
                  <li key={i} className="flex flex-col gap-0.5 border-l-2 border-ink pl-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {h.regla}
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-ink">{h.detalle}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
