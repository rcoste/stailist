// COMPARAR DOS VERSIONES CONGELADAS DEL PROMPT, par a par.
//
// Uso:  npx tsx scripts/prompt-comparar.ts <versionA> <versionB> [--modelo <id>]
//   ej: npx tsx scripts/prompt-comparar.ts v48 v49
//
// Es el cierre de lo que Roberto pidió: "como los frontier labs, ver si sale
// mejor el 48 contra el 49". Las dos versiones resuelven LOS MISMOS briefs con
// EL MISMO clóset y el MISMO barajeo (viene congelado), así que la única
// variable es el prompt.
//
// Y la comparación es PAREADA: cada brief aporta una diferencia (A − B), y la
// varianza del día —que es la que domina, 12 puntos medidos entre corridas
// idénticas— se resta y desaparece.
//
// LO QUE NO SE CONGELA, y por eso la comparación es limpia: las reglas y el
// juez son los de HOY para las dos. Lo que se mide es el prompt.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { correrCongelado, type PromptCongelado } from "../lib/engine/prompt-congelado";
import { evaluarLook, RUBRICA_VERSION, type BriefRubrica, type NotaRubrica } from "../lib/engine/rubrica";
import { registroDelPerfil, estiloDelPerfil, colorDelPerfil } from "../lib/evales/evales";
import { marcadorPareado, paresNecesarios } from "../lib/comparador/juez-pareado";
import { briefsPara, N_POOL, type BriefMotor } from "../lib/comparador/motor";
import { conCategoria, ITEM_IMAGE_SELECT, type ItemImageRow } from "../lib/item-image";
import type { EngineItem } from "../lib/engine/prompt";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const [vA, vB] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const iM = process.argv.indexOf("--modelo");
  const modeloId = iM >= 0 ? process.argv[iM + 1] : undefined;
  if (!vA || !vB) {
    console.error("Uso: npx tsx scripts/prompt-comparar.ts <versionA> <versionB>");
    process.exit(1);
  }

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: filas } = await s.from("prompts_congelados").select("*").in("version", [vA, vB]);
  const de = (v: string) => (filas ?? []).find((f) => f.version === v);
  if (!de(vA) || !de(vB)) {
    console.error(`Falta congelar: ${!de(vA) ? vA : ""} ${!de(vB) ? vB : ""}`);
    process.exit(1);
  }
  const congelado = (v: string): PromptCongelado => {
    const f = de(v)!;
    return {
      version: f.version as string,
      poolVersion: f.pool_version as string,
      modelo: f.modelo as string,
      system: f.system as string,
      briefs: f.briefs as PromptCongelado["briefs"],
    };
  };
  const A = congelado(vA);
  const B = congelado(vB);
  // Congelados de pools distintos resolvieron días distintos: no se comparan.
  if (A.poolVersion !== B.poolVersion) {
    console.error(`Pools distintos (${A.poolVersion} contra ${B.poolVersion}): no son comparables.`);
    process.exit(1);
  }

  const dueno = de(vA)!.closet_user_id as string;
  const { data: perfil } = await s.from("profiles").select("*").eq("id", dueno).single();
  const p = (perfil ?? {}) as Record<string, unknown>;
  const { data: items } = await s
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .eq("user_id", dueno)
    .is("deleted_at", null);
  const closet = conCategoria((items ?? []) as unknown as ItemImageRow[]) as unknown as EngineItem[];
  const porId = new Map(closet.map((i) => [i.id, i]));
  const vigentes = new Set(closet.map((i) => i.id));

  console.log(`${vA} contra ${vB} · pool ${A.poolVersion} · rúbrica ${RUBRICA_VERSION}`);
  console.log(`  modelo: ${modeloId ?? `${A.modelo} / ${B.modelo}`}\n`);

  const pool = briefsPara("veredicto", N_POOL);
  const juzgados: { n: number; etiqueta: string; lados: { variante: string; notas: NotaRubrica[] }[] }[] = [];
  let costo = 0;

  for (const [i, brief] of pool.entries()) {
    const lados: { variante: string; notas: NotaRubrica[] }[] = [];
    for (const [clave, cong] of [
      [vA, A],
      [vB, B],
    ] as const) {
      const r = await correrCongelado(cong, brief.etiqueta, { modeloId, idsVigentes: vigentes });
      if ("error" in r) {
        console.log(`  [${brief.etiqueta}] ${clave}: ${r.error}`);
        lados.push({ variante: clave, notas: [] });
        continue;
      }
      costo += r.recibo.costoUsd ?? 0;
      const b = brief as BriefMotor;
      const briefRubrica: BriefRubrica = {
        objective: b.objective,
        workDressCode: (p.work_dress_code as string | null) ?? null,
        veCliente: typeof b.veCliente === "boolean" ? b.veCliente : null,
        plan: b.plan ?? null,
        tipoEvento: b.tipoEvento ?? null,
        formality: b.formality ?? null,
        momento: b.momento,
        weather: b.weather,
        paraguas: b.paraguas === true,
        estilo: estiloDelPerfil(p),
        registro: registroDelPerfil(p),
        color: colorDelPerfil(p),
      };
      const notas: NotaRubrica[] = [];
      for (const look of r.outfits) {
        try {
          const n = await evaluarLook(briefRubrica, {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas: look.item_ids.map((id) => {
              const it = porId.get(id);
              return {
                nombre: it?.attrs.nombre ?? "Prenda",
                color: it?.attrs.color ?? null,
                material: (it?.attrs as { material?: string } | undefined)?.material ?? null,
              };
            }),
          });
          notas.push(n.nota);
          costo += n.recibo.costoUsd ?? 0;
        } catch {
          /* un juez caído no tira el brief: se juzga con lo que haya */
        }
      }
      lados.push({ variante: clave, notas });
    }
    juzgados.push({ n: i + 1, etiqueta: brief.etiqueta, lados });
    console.log(`  ${i + 1}/${pool.length} ${brief.etiqueta}`);
  }

  const r = marcadorPareado(juzgados, [vA, vB]);
  console.log(`\n${"=".repeat(64)}`);
  console.log(`${vA} contra ${vB} — ${r.comparables} briefs comparables\n`);
  console.log(`  ${vA} gana ${r.gana[vA]}  ·  ${vB} gana ${r.gana[vB]}  ·  empates ${r.empates}`);
  console.log(`  sign test: p = ${r.p == null ? "—" : r.p.toFixed(3)}`);
  if (r.diferencia) {
    const { media, se, t } = r.diferencia;
    console.log(`\n  diferencia media (${vA} − ${vB}): ${media >= 0 ? "+" : ""}${media.toFixed(3)}`);
    console.log(`  se ${se.toFixed(3)} · t = ${t ?? "—"}`);
    console.log(
      `  ${t != null && Math.abs(t) > 2 ? "→ SEÑAL" : `→ dentro del ruido · harían falta ~${paresNecesarios(se * Math.sqrt(r.comparables))} briefs`}`
    );
  }
  console.log(`\n  dimensión      ${vA.padEnd(8)}${vB}`);
  for (const d of ["ocasion", "clima", "armado", "estilo", "color", "wow"]) {
    const a = r.porDimension[vA][d];
    const b = r.porDimension[vB][d];
    console.log(
      `  ${d.padEnd(14)} ${a.toFixed(2)}    ${b.toFixed(2)}  ${Math.abs(a - b) < 0.05 ? "" : a > b ? "←" : "→"}`
    );
  }
  console.log(`\ncosto $${costo.toFixed(2)}`);
}

main();
