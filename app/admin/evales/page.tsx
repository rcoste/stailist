import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatoUsd } from "@/lib/proveedores/precios";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { RUBRICA_VERSION } from "@/lib/engine/rubrica";
import { RUBRICA_VISION_VERSION } from "@/lib/engine/rubrica-vision";
import { MODELO_MOTOR } from "@/lib/models";
import { POOL_VERSION } from "@/lib/comparador/motor";
import {
  marcadorEval,
  type EvalBriefFila,
  type NotaDeLook,
} from "@/lib/evales/evales";
import type { LookMotor, BriefMotor } from "@/lib/comparador/motor";
import { NuevoEval } from "./nuevo-eval";

// EL EVAL: la curva del motor contra sí mismo, versión a versión.
//
// Idea de Roberto: "como los frontier labs, que tienen sus criterios de
// evaluación y van viendo cuando sacan un modelo nuevo cómo mejora comparado
// con los pasados — así vemos cómo nuestro motor va mejorando contra el motor
// pasado, aprovechando el learning loop y las reglas".
//
// LA DIFERENCIA CON EL COMPARADOR, que es lo que justifica que sea otra
// pantalla: el comparador es la BALANZA (A contra B, ciego, voto humano,
// decide un cambio); el eval es la BANDA DE MEDIR (una sola variante, jueces
// automáticos, dice el nivel). Uno decide, el otro vigila.
export const dynamic = "force-dynamic";

export default async function AdminEvales() {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  const { data: corridas } = await supabase
    .from("eval_corridas")
    .select("*")
    .eq("closet_user_id", perfil.id)
    .order("creada", { ascending: false })
    .limit(20);

  const ids = (corridas ?? []).map((c) => c.id as string);
  const { data: briefs } = ids.length
    ? await supabase.from("eval_briefs").select("*").in("corrida_id", ids)
    : { data: [] };

  const porCorrida = new Map<string, EvalBriefFila[]>();
  for (const b of briefs ?? []) {
    const k = b.corrida_id as string;
    if (!porCorrida.has(k)) porCorrida.set(k, []);
    porCorrida.get(k)!.push({
      id: b.id as string,
      n: b.n as number,
      brief: b.brief as BriefMotor,
      looks: (b.looks as LookMotor[] | null) ?? null,
      reviews: (b.reviews as EvalBriefFila["reviews"]) ?? null,
      error: (b.error as string | null) ?? null,
      costoGenUsd: b.costo_gen_usd != null ? Number(b.costo_gen_usd) : null,
      msGen: (b.ms_gen as number | null) ?? null,
      notas: (b.notas as NotaDeLook[] | null) ?? null,
      costoNotasUsd: b.costo_notas_usd != null ? Number(b.costo_notas_usd) : null,
      marcas: (b.marcas as Record<string, string> | null) ?? null,
      comentarios: (b.comentarios as Record<string, string> | null) ?? null,
    });
  }

  const filas = (corridas ?? []).map((c) => {
    const fs = porCorrida.get(c.id as string) ?? [];
    return {
      id: c.id as string,
      creada: c.creada as string,
      promptVersion: c.prompt_version as string,
      poolVersion: c.pool_version as string,
      modelo: c.modelo_generador as string,
      rubrica: `${c.rubrica_version}/${c.rubrica_vision_version}`,
      estado: c.estado as string,
      conEstilo: c.con_estilo === true,
      m: marcadorEval(fs, c.con_estilo === true),
      pendientes: fs.length,
    };
  });

  // La CURVA: solo corridas comparables entre sí (mismo pool). Mezclar pools
  // aquí sería la misma trampa que en el comparador — números que se ven en la
  // misma columna sin haber resuelto los mismos días.
  const listas = filas.filter((f) => f.estado !== "corriendo" && f.m.looksCalificados > 0);
  const poolsEnCurva = new Set(listas.map((f) => f.poolVersion));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">Evales del motor</h1>
        <p className="text-sm text-muted">
          El mismo pool de días, resuelto por el motor vigente y calificado por
          los tres jueces automáticos. Sin votar: esto mide el nivel, no decide
          un cambio — para eso está el{" "}
          <Link href="/admin/comparador" className="font-semibold text-accent">
            comparador
          </Link>
          .
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">El motor de hoy</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {[
            ["prompt", PROMPT_VERSION],
            ["modelo", MODELO_MOTOR.etiqueta ?? MODELO_MOTOR.id],
            ["pool de días", POOL_VERSION],
            ["rúbricas", `${RUBRICA_VERSION} · ${RUBRICA_VISION_VERSION}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <NuevoEval />
      </div>

      {listas.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">La curva</h2>
          <p className="text-xs text-muted">
            Cada corrida contra las anteriores. Lo que tiene que subir con cada
            versión: el promedio de las rúbricas y el % aprobado; lo que tiene
            que bajar: las violaciones de reglas y las reparaciones del juez.
          </p>
          {poolsEnCurva.size > 1 ? (
            <p className="text-xs text-warning">
              OJO: hay {poolsEnCurva.size} versiones del pool en esta tabla
              ({[...poolsEnCurva].join(", ")}). Solo se comparan de verdad las
              corridas del mismo pool — resolvieron los mismos días.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="p-2 font-medium">corrida</th>
                  <th className="p-2 font-medium">motor</th>
                  <th className="p-2 font-medium">texto</th>
                  <th className="p-2 font-medium">visión</th>
                  <th className="p-2 font-medium">aprobado</th>
                  <th className="p-2 font-medium">reglas</th>
                  <th className="p-2 font-medium">reparó</th>
                  <th className="p-2 font-medium">costo</th>
                </tr>
              </thead>
              <tbody>
                {listas.map((f) => {
                  const prom = (d: typeof f.m.texto) => {
                    const xs = [d.ocasion, d.clima, d.armado, d.estilo, d.wow].filter(
                      (x): x is number => x != null
                    );
                    return xs.length
                      ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)
                      : "—";
                  };
                  const pct = (a: number, b: number) =>
                    b ? `${Math.round((a / b) * 100)}%` : "—";
                  return (
                    <tr key={f.id} className="border-b border-line last:border-0">
                      <td className="p-2">
                        <Link href={`/admin/evales/${f.id}`} className="font-semibold text-accent">
                          {f.promptVersion}
                        </Link>
                        <span className="ml-1 text-muted">
                          {new Date(f.creada).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </td>
                      <td className="p-2 text-muted">{f.modelo}</td>
                      <td className="p-2 font-semibold text-ink">{prom(f.m.texto)}</td>
                      <td className="p-2 font-semibold text-ink">{prom(f.m.vision)}</td>
                      <td className="p-2">
                        {pct(f.m.aprobadoTexto.si, f.m.aprobadoTexto.de)}
                        <span className="text-muted">
                          {" "}
                          / {pct(f.m.aprobadoVision.si, f.m.aprobadoVision.de)}
                        </span>
                      </td>
                      <td className="p-2">
                        {f.m.looks
                          ? `${Math.round((f.m.violaciones.looksConViolacion / f.m.looks) * 100)}%`
                          : "—"}
                      </td>
                      <td className="p-2">
                        {f.m.reparacion.candidatos
                          ? `${Math.round((f.m.reparacion.reparados / f.m.reparacion.candidatos) * 100)}%`
                          : "—"}
                      </td>
                      <td className="p-2 text-muted">{formatoUsd(f.m.costoTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Corridas</h2>
        {filas.length === 0 ? (
          <p className="text-sm text-muted">
            Todavía no corres ninguna. La primera es la línea base: contra ella
            se leen todas las demás.
          </p>
        ) : (
          filas.map((f) => (
            <Link
              key={f.id}
              href={`/admin/evales/${f.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 active:bg-tile"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">
                  {f.promptVersion} · {f.modelo}
                </span>
                <span className="text-xs text-muted">
                  {new Date(f.creada).toLocaleString("es-MX", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {f.m.looksCalificados}/{f.m.looks} looks calificados · pool{" "}
                  {f.poolVersion} · {f.rubrica}
                  {f.conEstilo ? "" : " · sin estilo declarado"}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  f.estado === "corriendo"
                    ? "bg-accent text-on-accent"
                    : "bg-tile text-muted"
                }`}
              >
                {f.estado}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
