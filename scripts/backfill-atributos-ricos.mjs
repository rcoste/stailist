// Backfill de atributos ricos (material / patrón / color secundario) para las
// prendas que existían ANTES del motor v21. Infiere desde el NOMBRE de la
// prenda (+ color/categoría) con claude-haiku-4-5 — barato: ~500 prendas
// cuestan centavos. NO usa visión (no requiere acceso al Storage privado).
//
// Uso (desde la raíz del repo):
//   node scripts/backfill-atributos-ricos.mjs                → dry-run (no escribe)
//   node scripts/backfill-atributos-ricos.mjs --validate 12  → compara Haiku vs Opus en N prendas
//   node scripts/backfill-atributos-ricos.mjs --apply        → escribe en la DB
//   node scripts/backfill-atributos-ricos.mjs --apply --limit 50
//
// Seguridad:
// - Solo toca prendas SIN material Y SIN patrón (nunca pisa datos existentes,
//   incluidos los que el usuario haya corregido a mano).
// - Escribe con `attrs || jsonb` (merge aditivo) + marca `atributos_v21` con la
//   fuente de la inferencia, para poder localizar/mejorar estas filas después
//   (p. ej. un pase de visión).
// - El modelo devuelve null cuando el nombre no da señal — null NO se escribe.

import { readFileSync } from "node:fs";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

// --- Config -----------------------------------------------------------------

const MODELO_BARATO = "claude-haiku-4-5"; // el caballo de carga del backfill
const MODELO_REFERENCIA = "claude-opus-4-8"; // solo para --validate
const LOTE = 20; // prendas por llamada

const PATRONES = ["liso", "rayas", "cuadros", "floral", "animal-print", "grafico", "estampado"];
const MAX_MATERIAL_LEN = 40;
const MAX_COLOR_LEN = 30;

// --- Args + env ---------------------------------------------------------------

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VALIDATE = args.includes("--validate")
  ? parseInt(args[args.indexOf("--validate") + 1] ?? "10", 10)
  : 0;
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1] ?? "0", 10)
  : 0;

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
if (!env.DATABASE_URL || !env.ANTHROPIC_API_KEY) {
  console.error("Faltan DATABASE_URL o ANTHROPIC_API_KEY en .env.local");
  process.exit(1);
}

const db = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Solo-lectura salvo --apply: cinturón contra escrituras accidentales.
  options: APPLY ? undefined : "-c default_transaction_read_only=on",
});
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// --- Saneo (espeja lib/prenda-atributos.ts) -----------------------------------

const cleanText = (v, maxLen) => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, maxLen);
  return s || undefined;
};
const cleanPatron = (v) => (PATRONES.includes(v) ? v : undefined);

// --- Inferencia ---------------------------------------------------------------

const SYSTEM = `Eres experta en moda. Te doy una lista de prendas de un clóset digital (número, nombre, color, categoría). Por CADA prenda infiere, SOLO desde el nombre/color/categoría:
- material: la tela/material cuando el nombre lo dice ("de lana merino" → "lana"; "Jeans" → "mezclilla"; "de piel" → "piel") o cuando el tipo de prenda lo implica de forma inequívoca. Si hay duda razonable, null — NO adivines.
- patron: si el nombre menciona un estampado (rayas, cuadros, floral, animal print, gráfico, estampado), ese. Si el nombre no sugiere ningún estampado, "liso" (la gran mayoría de las prendas lo son). Valores: ${PATRONES.join(", ")}.
- color_secundario: SOLO si el nombre deja claro que es bicolor ("blusa azul con blanco"). Casi siempre null.
Responde en español de México, minúsculas, términos simples de una o dos palabras (di "piel", no "cuero").`;

const schemaLote = {
  type: "object",
  properties: {
    prendas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          material: { type: ["string", "null"] },
          patron: { type: "string", enum: PATRONES },
          color_secundario: { type: ["string", "null"] },
        },
        required: ["n", "material", "patron", "color_secundario"],
        additionalProperties: false,
      },
    },
  },
  required: ["prendas"],
  additionalProperties: false,
};

async function inferirLote(prendas, modelo) {
  const lista = prendas
    .map((p, i) => `${i}. ${p.nombre} (color: ${p.color ?? "?"}, categoría: ${p.categoria ?? "?"})`)
    .join("\n");
  const res = await anthropic.messages.create({
    model: modelo,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: `PRENDAS:\n${lista}\n\nInfiere los atributos de cada una.` }],
    output_config: { format: { type: "json_schema", schema: schemaLote } },
  });
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text || res.stop_reason === "max_tokens") throw new Error("respuesta truncada/vacía");
  const parsed = JSON.parse(text);
  const porN = new Map((parsed.prendas ?? []).map((p) => [p.n, p]));
  return prendas.map((p, i) => {
    const r = porN.get(i) ?? {};
    return {
      material: cleanText(r.material, MAX_MATERIAL_LEN) ?? null,
      patron: cleanPatron(r.patron) ?? null,
      color_secundario: cleanText(r.color_secundario, MAX_COLOR_LEN) ?? null,
    };
  });
}

// --- Main ---------------------------------------------------------------------

await db.connect();

// Candidatas: activas, sin material NI patrón (no pisar nada existente).
const { rows } = await db.query(`
  select id, source, attrs->>'nombre' nombre, attrs->>'color' color,
         coalesce(attrs->>'categoria', attrs->>'tipo') categoria
  from items
  where deleted_at is null
    and attrs->>'nombre' is not null
    and attrs->>'material' is null
    and attrs->>'patron' is null
  order by source, created_at
  ${LIMIT ? `limit ${LIMIT}` : ""}`);
console.log(`Candidatas al backfill: ${rows.length} prendas`);

// --- Modo validación: Haiku vs Opus lado a lado --------------------------------
if (VALIDATE) {
  // Muestra dispersa (cada k-ésima) para variar tipos de prenda.
  const paso = Math.max(1, Math.floor(rows.length / VALIDATE));
  const muestra = rows.filter((_, i) => i % paso === 0).slice(0, VALIDATE);
  console.log(`\nValidando ${muestra.length} prendas: ${MODELO_BARATO} vs ${MODELO_REFERENCIA}\n`);
  const [barato, referencia] = await Promise.all([
    inferirLote(muestra, MODELO_BARATO),
    inferirLote(muestra, MODELO_REFERENCIA),
  ]);
  let acuerdoPatron = 0;
  let acuerdoMaterial = 0;
  muestra.forEach((p, i) => {
    const b = barato[i];
    const r = referencia[i];
    const okP = b.patron === r.patron;
    const okM = b.material === r.material;
    if (okP) acuerdoPatron++;
    if (okM) acuerdoMaterial++;
    console.log(
      `${okP && okM ? "✓" : "✗"} ${p.nombre}\n` +
        `    haiku: ${b.material ?? "—"} · ${b.patron ?? "—"} · ${b.color_secundario ?? "—"}\n` +
        `    opus:  ${r.material ?? "—"} · ${r.patron ?? "—"} · ${r.color_secundario ?? "—"}`
    );
  });
  console.log(
    `\nAcuerdo patrón: ${acuerdoPatron}/${muestra.length} · material: ${acuerdoMaterial}/${muestra.length}`
  );
  await db.end();
  process.exit(0);
}

// --- Backfill (dry-run u --apply) ----------------------------------------------
let escritas = 0;
let sinDatos = 0;
for (let i = 0; i < rows.length; i += LOTE) {
  const lote = rows.slice(i, i + LOTE);
  let inferidos;
  try {
    inferidos = await inferirLote(lote, MODELO_BARATO);
  } catch (e) {
    console.error(`Lote ${i / LOTE + 1} falló (${e.message}) — se salta, re-correr después.`);
    continue;
  }
  for (let j = 0; j < lote.length; j++) {
    const inf = inferidos[j];
    // Solo llaves con valor; null no se escribe (queda para un pase mejor).
    const patch = {};
    if (inf.material) patch.material = inf.material;
    if (inf.patron) patch.patron = inf.patron;
    if (inf.color_secundario) patch.color_secundario = inf.color_secundario;
    if (Object.keys(patch).length === 0) {
      sinDatos++;
      continue;
    }
    patch.atributos_v21 = "backfill-texto-haiku"; // rastreable/mejorable después
    if (APPLY) {
      await db.query(
        `update items set attrs = attrs || $1::jsonb
         where id = $2 and attrs->>'material' is null and attrs->>'patron' is null`,
        [JSON.stringify(patch), lote[j].id]
      );
    } else {
      console.log(`[dry-run] ${lote[j].nombre} → ${JSON.stringify(patch)}`);
    }
    escritas++;
  }
  console.log(`Lote ${Math.floor(i / LOTE) + 1}/${Math.ceil(rows.length / LOTE)} listo`);
}
console.log(
  `\n${APPLY ? "Escritas" : "[dry-run] Se escribirían"}: ${escritas} prendas · sin señal suficiente: ${sinDatos}`
);
await db.end();
