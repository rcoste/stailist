import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATALOGO, proveedoresListos } from "@/lib/proveedores/catalogo";
import { formatoUsd } from "@/lib/proveedores/precios";
import { NuevaCorrida } from "./nueva-corrida";

// El comparador: poner modelos a competir y decidir con evidencia cuál usar.
//
// Nace de dos cosas del 5 de agosto. Una, la factura: la app costaba $17-19 al
// mes y un día de laboratorio mío costó $55, sin que nadie pudiera ver de dónde
// salía cada peso. Dos, tres bugs de arnés seguidos, todos de la misma familia:
// scripts que IMITABAN al motor en vez de llamarlo. Roberto: "eso es muy gris;
// que veamos quién lo hace bien y así decidimos qué usar".
export const dynamic = "force-dynamic";

export default async function AdminComparador() {
  await requireAdmin();
  const supabase = await createClient();
  const listos = proveedoresListos();

  const { data: corridas } = await supabase
    .from("comparador_corridas")
    .select("id, creada, modo, modelos, estado")
    .order("creada", { ascending: false })
    .limit(20);

  const { data: costos } = await supabase
    .from("comparador_lecturas")
    .select("corrida_id, costo_usd");
  const costoPorCorrida = new Map<string, number>();
  for (const c of costos ?? []) {
    if (c.costo_usd == null) continue;
    const k = c.corrida_id as string;
    costoPorCorrida.set(k, (costoPorCorrida.get(k) ?? 0) + Number(c.costo_usd));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-ink">Comparador</h1>
        <p className="text-sm leading-relaxed text-muted">
          Subes fotos, varios modelos las leen, tú marcas lo que sobra, lo que
          falta y lo que leyeron mal. Al final se ve quién acertó más y cuánto
          costó cada uno. Las columnas van sin nombre hasta que termines.
        </p>
      </header>

      <NuevaCorrida
        modelos={CATALOGO.map((m) => ({
          id: m.id,
          etiqueta: m.etiqueta,
          proveedor: m.proveedor,
          listo: listos[m.proveedor] ?? false,
        }))}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">Corridas</h2>
        {!corridas?.length ? (
          <p className="text-sm text-muted">Todavía no hay ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {corridas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/comparador/${c.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 active:bg-tile"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {c.modo === "varias" ? "varias prendas" : "una prenda"} ·{" "}
                      {(c.modelos as string[]).length} modelos ·{" "}
                      {new Date(c.creada as string).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                      {c.estado as string}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    gastado: {formatoUsd(costoPorCorrida.get(c.id as string) ?? 0)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
