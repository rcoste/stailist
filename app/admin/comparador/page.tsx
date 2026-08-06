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
  const perfil = await requireAdmin();
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

  // La segunda mitad: corridas de MOTOR (dos variantes, voto ciego, veredicto).
  // Solo las corridas sobre TU clóset. El RLS deja a cualquier admin ver
  // todas, y eso está bien para depurar, pero en la lista de trabajo las
  // ajenas son ruido: dicen "te falta votar" de un experimento de otra
  // persona sobre prendas que no son tuyas.
  const { data: corridasMotor } = await supabase
    .from("comparador_motor_corridas")
    .select("id, creada, tamano, variantes, estado")
    .eq("closet_user_id", perfil.id)
    .order("creada", { ascending: false })
    .limit(20);
  // Acotado a las corridas listadas: un veredicto son hasta ~80 lados, y sin
  // el .in() esta query crecería sin tope con cada corrida nueva.
  const idsMotor = (corridasMotor ?? []).map((c) => c.id as string);
  const { data: costosMotor } = await supabase
    .from("comparador_motor_lados")
    .select("corrida_id, costo_usd")
    .in("corrida_id", idsMotor);

  // Qué le falta a cada corrida, para verlo SIN entrar: votos pendientes y
  // marcas por look pendientes. Una corrida cerrada puede seguir teniendo
  // trabajo útil encima (el diagnóstico se completa después del resultado).
  const { data: paresMotor } = await supabase
    .from("comparador_motor_pares")
    .select("corrida_id, voto, marcas_look")
    .in("corrida_id", idsMotor);
  const pendientesPorCorrida = new Map<string, { votos: number; marcas: number }>();
  for (const p of paresMotor ?? []) {
    const k = p.corrida_id as string;
    const acc = pendientesPorCorrida.get(k) ?? { votos: 0, marcas: 0 };
    if (p.voto == null) acc.votos++;
    else if (p.marcas_look == null) acc.marcas++;
    pendientesPorCorrida.set(k, acc);
  }
  const costoMotorPorCorrida = new Map<string, number>();
  for (const c of costosMotor ?? []) {
    if (c.costo_usd == null) continue;
    const k = c.corrida_id as string;
    costoMotorPorCorrida.set(k, (costoMotorPorCorrida.get(k) ?? 0) + Number(c.costo_usd));
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Motores</h2>
          <Link
            href="/admin/comparador/motor/nueva"
            className="text-sm font-semibold text-accent"
          >
            Nueva corrida de motor
          </Link>
        </div>
        <p className="text-xs text-muted">
          Dos variantes del motor ({"{"}modelo + prompt + reglas{"}"}) arman
          looks sobre los mismos días y tu clóset; votas a ciegas y el veredicto
          se lee contra una regla escrita antes de votar.
        </p>
        {!corridasMotor?.length ? (
          <p className="text-sm text-muted">Todavía no hay ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {corridasMotor.map((c) => {
              const variantes = c.variantes as { etiqueta: string }[];
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/comparador/motor/${c.id}`}
                    className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 active:bg-tile"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">
                        {c.tamano as string} ·{" "}
                        {variantes.map((v) => v.etiqueta).join(" vs ")} ·{" "}
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
                      gastado: {formatoUsd(costoMotorPorCorrida.get(c.id as string) ?? 0)}
                    </span>
                    {(() => {
                      const p = pendientesPorCorrida.get(c.id as string);
                      if (!p || (!p.votos && !p.marcas)) return null;
                      return (
                        <span className="text-xs font-semibold text-accent">
                          te falta:{" "}
                          {[
                            p.votos ? `votar ${p.votos}` : null,
                            p.marcas ? `marcar looks de ${p.marcas}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      );
                    })()}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">Visión (leer prendas)</h2>
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
