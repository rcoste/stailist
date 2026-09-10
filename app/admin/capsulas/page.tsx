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
//
// DESDE v0.2.323.0 también enseña LA TRAZA: el prompt exacto que se le mandó al
// modelo y el razonamiento con el que contestó (`ai_trazas`). El juez dice QUÉ
// falta; la traza dice POR QUÉ. Las dos preguntas se hacen juntas —"le faltó un
// traje" sólo se contesta viendo si el prompt se lo pidió y qué se contestó él
// mismo antes de listar— así que viven en la misma pantalla, plegadas.
//
// Las cápsulas generadas ANTES de esto no tienen traza: el `plan` se producía y
// se tiraba. Se llenan solas al regenerar.
export const dynamic = "force-dynamic";

type Traza = {
  modelo: string | null;
  version: string | null;
  prompt_system: string | null;
  prompt_usuario: string | null;
  razonamiento: string | null;
  created_at: string;
};

type Fila = {
  id: string;
  correo: string;
  gender: string | null;
  techo: string | null;
  piezas: number;
  hallazgos: HallazgoCapsula[];
  traza: Traza | null;
};

export default async function AdminCapsulas() {
  const supabase = await createClient();
  const [{ data }, { data: trazasRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, gender, lifestyle, capsule_target")
      .not("capsule_target", "is", null),
    // Una fila por persona (unique user_id+tarea), así que no hay que ordenar
    // ni deduplicar: la traza que existe es la de la cápsula que está viva.
    supabase
      .from("ai_trazas")
      .select("user_id, modelo, version, prompt_system, prompt_usuario, razonamiento, created_at")
      .eq("tarea", "capsula-ideal"),
  ]);

  const porUsuario = new Map<string, Traza>();
  for (const t of trazasRaw ?? []) porUsuario.set(t.user_id as string, t as unknown as Traza);

  const filas: Fila[] = (data ?? [])
    .map((p) => {
      const target = p.capsule_target as CapsuleTarget | null;
      const items = (target?.items ?? []) as CapsuleItem[];
      const vida = (p.lifestyle ?? {}) as Record<string, string | undefined>;
      return {
        id: p.id as string,
        traza: porUsuario.get(p.id as string) ?? null,
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
        <p className="text-sm text-muted">
          <b className="tabular text-ink">{filas.filter((f) => f.traza).length}</b> con
          traza: el prompt que se le mandó al modelo y el razonamiento con el que
          contestó, dentro de cada tarjeta.
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
            key={f.id}
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

            {f.traza ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                {/* El razonamiento primero y el prompt después, en ese orden a
                    propósito: al abrir una cápsula rara la pregunta es "¿qué
                    estaba pensando?", y sólo si eso no explica nada se baja a
                    revisar qué se le pidió. */}
                <Plegado
                  titulo="Razonamiento"
                  pista={
                    f.traza.razonamiento
                      ? `${f.traza.razonamiento.length} caracteres`
                      : "no lo devolvió"
                  }
                  texto={f.traza.razonamiento}
                />
                <Plegado
                  titulo="Prompt de sistema"
                  pista={f.traza.modelo ?? "—"}
                  texto={f.traza.prompt_system}
                />
                <Plegado
                  titulo="Lo que se le mandó de ella"
                  pista={new Date(f.traza.created_at).toLocaleString("es-MX")}
                  texto={f.traza.prompt_usuario}
                />
              </div>
            ) : (
              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                Sin traza — se generó antes de que se guardara el prompt. Se llena
                sola cuando regenere sus esenciales.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// Un bloque plegado de texto largo. `pre` con `whitespace-pre-wrap` porque el
// prompt tiene saltos y sangrías que SON el contenido: aplanarlos lo vuelve
// ilegible justo cuando se está buscando qué línea falló. `overflow-x-auto`
// para que una línea larga no empuje la página entera.
function Plegado({
  titulo,
  pista,
  texto,
}: {
  titulo: string;
  pista: string;
  texto: string | null;
}) {
  return (
    <details className="rounded-sm border border-line bg-bg">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-ink">
        {titulo}{" "}
        <span className="font-medium normal-case tracking-normal opacity-70">· {pista}</span>
      </summary>
      {texto ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap px-3 pb-3 text-[12px] leading-relaxed text-ink">
          {texto}
        </pre>
      ) : (
        <p className="px-3 pb-3 text-xs text-muted">Vacío.</p>
      )}
    </details>
  );
}
