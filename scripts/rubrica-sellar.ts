// Califica TODOS los looks de una corrida con la rúbrica y SELLA las notas a
// un archivo, sin imprimirlas.
//
// Uso:  npx tsx scripts/rubrica-sellar.ts <corridaId> [archivo]
//
// POR QUÉ SE SELLA Y NO SE IMPRIME
// El número que importa no es la nota del juez: es cuánto COINCIDE con las
// marcas humanas. Y ese acuerdo solo vale si las dos opiniones son
// independientes — enseñarle a Roberto lo que opinó el juez antes de votar
// contamina justo lo que se quiere medir. Así que se guardan y no se miran
// hasta que él termine (scripts/rubrica-acuerdo-corrida.ts las lee).
//
// De paso corre el chequeo DETERMINISTA (lib/engine/reglas-ejecucion) sobre los
// looks finales: eso sí se imprime, porque es aritmética y no opinión — no hay
// nada que contaminar.
//
// CUESTA POCO (~$0.30 por corrida de 6 pares, ~$1 por un veredicto de 20).
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { revisarEjecucion } from "../lib/engine/reglas-ejecucion";
import { bandaDeClima } from "../lib/engine/recetario";
import type { EngineItem } from "../lib/engine/prompt";
import { evaluarLook, RUBRICA_VERSION, type BriefRubrica } from "../lib/engine/rubrica";
import { hayLluvia } from "@/lib/weather";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

type Look = {
  nombre: string;
  item_ids: string[];
  explicacion: string;
  tip?: string | null;
};

async function main() {
  const corridaId = process.argv[2];
  if (!corridaId) {
    console.error("Falta el id de la corrida.");
    process.exit(1);
  }
  const salida = process.argv[3] ?? `/tmp/rubrica-${corridaId.slice(0, 8)}.json`;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: corrida } = await supabase
    .from("comparador_motor_corridas")
    .select("closet_user_id, prompt_version, pool_version")
    .eq("id", corridaId)
    .single();
  if (!corrida) {
    console.error("No encontré esa corrida.");
    process.exit(1);
  }

  const [{ data: pares }, { data: lados }, { data: items }] = await Promise.all([
    supabase.from("comparador_motor_pares").select("*").eq("corrida_id", corridaId).order("n"),
    supabase.from("comparador_motor_lados").select("*").eq("corrida_id", corridaId),
    supabase
      .from("items")
      .select("id, attrs")
      .eq("user_id", corrida.closet_user_id as string)
      .is("deleted_at", null),
  ]);

  const engine = new Map<string, EngineItem>(
    (items ?? []).map((i) => [
      i.id as string,
      { id: i.id as string, attrs: (i.attrs ?? {}) as EngineItem["attrs"] },
    ])
  );
  const closet = [...engine.values()];

  // ── 1. El chequeo determinista. Aritmética, no opinión: se imprime. ──
  console.log(
    `Corrida ${corridaId.slice(0, 8)} · prompt ${corrida.prompt_version} · pool ${corrida.pool_version}\n`
  );
  console.log("── CHEQUEO DE CÓDIGO (reglas-ejecucion sobre los looks finales) ──");
  let violaciones = 0;
  for (const p of pares ?? []) {
    const brief = p.brief as BriefRubrica & { etiqueta: string };
    const lluvia = hayLluvia(brief.weather?.condition);
    for (const l of (lados ?? []).filter((x) => x.par_id === p.id)) {
      for (const [idx, look] of ((l.looks as Look[] | null) ?? []).entries()) {
        const its = look.item_ids
          .map((id) => engine.get(id))
          .filter((x): x is EngineItem => !!x);
        for (const v of revisarEjecucion(its, {
          clima: bandaDeClima(brief.weather),
          closet,
          lluvia,
          paraguas: brief.paraguas === true,
        })) {
          violaciones++;
          console.log(
            `  ✗ [${l.variante}] "${look.nombre}" (${brief.etiqueta}, look ${idx + 1}): ${v.regla}`
          );
        }
      }
    }
  }
  if (!violaciones) console.log("  ✓ cero violaciones en todos los looks finales");

  // ── 2. La rúbrica. Se sella, NO se imprime. ──
  type Par = { id: string; n: number; brief: unknown; repite_de: string | null };
  const trabajos: { p: Par; variante: string; idx: number; look: Look }[] = [];
  for (const p of (pares ?? []) as unknown as Par[]) {
    // Los espejos comparten los looks de su original: juzgarlos otra vez
    // mediría el azar del juez, no su criterio.
    if (p.repite_de) continue;
    for (const l of (lados ?? []).filter((x) => x.par_id === p.id)) {
      ((l.looks as Look[] | null) ?? []).forEach((look, idx) =>
        trabajos.push({ p, variante: l.variante as string, idx, look })
      );
    }
  }

  const notas: unknown[] = [];
  let costo = 0;
  let fallos = 0;
  const cola = [...trabajos];
  const worker = async () => {
    for (;;) {
      const t = cola.shift();
      if (!t) return;
      const brief = t.p.brief as BriefRubrica & { etiqueta: string };
      try {
        const { nota, recibo } = await evaluarLook(brief, {
          nombre: t.look.nombre,
          explicacion: t.look.explicacion,
          tip: t.look.tip ?? null,
          prendas: t.look.item_ids.map((id) => {
            const a = (engine.get(id)?.attrs ?? {}) as Record<string, unknown>;
            return {
              nombre: (a.nombre as string) ?? "Prenda",
              color: (a.color as string) ?? null,
              material: (a.material as string) ?? null,
            };
          }),
        });
        costo += recibo.costoUsd ?? 0;
        notas.push({
          par: t.p.n,
          etiqueta: brief.etiqueta,
          variante: t.variante,
          look: t.idx,
          nombre: t.look.nombre,
          nota,
        });
      } catch (e) {
        fallos++;
        console.error(`  fallo en "${t.look.nombre}": ${e instanceof Error ? e.message : e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  writeFileSync(
    salida,
    JSON.stringify({ rubrica: RUBRICA_VERSION, corrida: corridaId, notas }, null, 2)
  );
  console.log(`\n── RÚBRICA ${RUBRICA_VERSION} ──`);
  console.log(`  ${notas.length} notas SELLADAS en ${salida}`);
  if (fallos) console.log(`  ${fallos} fallos de juez`);
  console.log(`  costo $${costo.toFixed(2)}`);
  console.log(
    `  (no se imprimen a propósito: el acuerdo solo vale si las dos opiniones son independientes)`
  );
}

main();
