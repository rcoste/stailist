// Backfill de atributos ricos (material / patrón / color secundario) para las
// prendas que existían ANTES del motor v21. Dos modos:
//
//   TEXTO (default): infiere desde el NOMBRE (+ color/categoría) con
//     claude-haiku-4-5. Barato, sin acceso a Storage. Corrió 2026-07-01
//     sobre las 415 prendas activas.
//   --vision: re-analiza la IMAGEN real de las prendas que quedaron sin
//     material tras el pase de texto. Requiere SUPABASE_SERVICE_ROLE_KEY en
//     .env.local (firma/descarga del bucket privado "prendas"); las imágenes
//     de arquetipo/prestadas se leen de public/ en disco.
//
// Uso (desde la raíz del repo):
//   node scripts/backfill-atributos-ricos.mjs                    → dry-run texto
//   node scripts/backfill-atributos-ricos.mjs --validate 12      → Haiku vs Opus (texto)
//   node scripts/backfill-atributos-ricos.mjs --apply            → escribe (texto)
//   node scripts/backfill-atributos-ricos.mjs --vision           → dry-run visión
//   node scripts/backfill-atributos-ricos.mjs --vision --validate 8
//   node scripts/backfill-atributos-ricos.mjs --vision --apply
//   (ambos modos aceptan --limit N)
//
// Seguridad:
// - material y color_secundario solo se escriben donde faltan (nunca pisan
//   datos existentes ni correcciones del usuario).
// - patron: el pase de visión puede CORREGIR un patrón puesto por el pase de
//   texto (marca 'backfill-texto-haiku' — máquina corrigiendo a máquina); un
//   patrón del análisis original o editado por el usuario no se toca.
// - Merge aditivo `attrs || jsonb` + marca `atributos_v21` con la fuente.
// - Conexión read-only salvo --apply. El modelo devuelve null ante la duda.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabase } from "@supabase/supabase-js";

// --- Config -----------------------------------------------------------------

const MODELO_BARATO = "claude-haiku-4-5"; // el caballo de carga del backfill
const MODELO_REFERENCIA = "claude-opus-4-8"; // solo para --validate
const LOTE_TEXTO = 20; // prendas por llamada (texto)
const PARALELO_VISION = 4; // llamadas de visión simultáneas

const PATRONES = ["liso", "rayas", "cuadros", "floral", "animal-print", "grafico", "estampado"];
const MAX_MATERIAL_LEN = 40;
const MAX_COLOR_LEN = 30;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- Args + env ---------------------------------------------------------------

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VISION = args.includes("--vision");
const VALIDATE = args.includes("--validate")
  ? parseInt(args[args.indexOf("--validate") + 1] ?? "10", 10)
  : 0;
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1] ?? "0", 10)
  : 0;

const env = Object.fromEntries(
  readFileSync(path.join(REPO_ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
if (!env.DATABASE_URL || !env.ANTHROPIC_API_KEY) {
  console.error("Faltan DATABASE_URL o ANTHROPIC_API_KEY en .env.local");
  process.exit(1);
}
if (VISION && (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error("--vision requiere SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL en .env.local");
  process.exit(1);
}

const db = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Solo-lectura salvo --apply: cinturón contra escrituras accidentales.
  options: APPLY ? undefined : "-c default_transaction_read_only=on",
});
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const supabase = VISION
  ? createSupabase(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

// --- Saneo (espeja lib/prenda-atributos.ts) -----------------------------------

const cleanText = (v, maxLen) => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, maxLen);
  return s || undefined;
};
const cleanPatron = (v) => (PATRONES.includes(v) ? v : undefined);

// --- Inferencia por TEXTO -------------------------------------------------------

const SYSTEM_TEXTO = `Eres experta en moda. Te doy una lista de prendas de un clóset digital (número, nombre, color, categoría). Por CADA prenda infiere, SOLO desde el nombre/color/categoría:
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

async function inferirLoteTexto(prendas, modelo) {
  const lista = prendas
    .map((p, i) => `${i}. ${p.nombre} (color: ${p.color ?? "?"}, categoría: ${p.categoria ?? "?"})`)
    .join("\n");
  const res = await anthropic.messages.create({
    model: modelo,
    max_tokens: 2048,
    system: SYSTEM_TEXTO,
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

// --- Inferencia por VISIÓN ------------------------------------------------------

const SYSTEM_VISION = `Eres experta en moda. Miras la foto de UNA prenda y determinas SOLO estos atributos:
- material: la tela/material aparente ("algodón", "lana", "mezclilla", "lino", "piel", "ante", "punto", "sintético", "seda"…). Si la foto no permite distinguirlo con confianza razonable, null — NO adivines.
- patron: "liso" si no tiene estampado, o el que tenga. Valores: ${PATRONES.join(", ")}.
- color_secundario: el segundo color protagonista SOLO si la prenda es claramente bicolor o estampada con dos colores; si no, null.
Responde en español de México, minúsculas, términos simples (di "piel", no "cuero").`;

const schemaVision = {
  type: "object",
  properties: {
    material: { type: ["string", "null"] },
    patron: { type: "string", enum: PATRONES },
    color_secundario: { type: ["string", "null"] },
  },
  required: ["material", "patron", "color_secundario"],
  additionalProperties: false,
};

const MEDIA = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// Resuelve los bytes de la imagen de una prenda siguiendo el orden canónico de
// lib/item-image.ts: arquetipo (public/ en disco) → render limpio (bucket
// privado) → foto cruda (bucket privado) → prestada (public/ en disco).
async function imagenDePrenda(row) {
  const local = (p) => {
    const abs = path.join(REPO_ROOT, "public", p.replace(/^\//, ""));
    if (!existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    if (!MEDIA[ext]) return null;
    return { data: readFileSync(abs).toString("base64"), mediaType: MEDIA[ext] };
  };
  const privada = async (p) => {
    const { data, error } = await supabase.storage.from("prendas").download(p);
    if (error || !data) return null;
    const ext = path.extname(p).toLowerCase();
    const buf = Buffer.from(await data.arrayBuffer());
    return { data: buf.toString("base64"), mediaType: MEDIA[ext] ?? "image/jpeg" };
  };
  if (row.arch_image) return local(row.arch_image);
  if (row.render_status === "done" && row.render_path) return privada(row.render_path);
  if (row.photo_path) return privada(row.photo_path);
  if (row.image_path_prestada) return local(row.image_path_prestada);
  return null;
}

async function inferirVision(row, imagen, modelo) {
  const res = await anthropic.messages.create({
    model: modelo,
    max_tokens: 300,
    system: SYSTEM_VISION,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.mediaType, data: imagen.data } },
          {
            type: "text",
            text: `La prenda es: "${row.nombre}" (color: ${row.color ?? "?"}). Determina material, patrón y color secundario desde la FOTO.`,
          },
        ],
      },
    ],
    output_config: { format: { type: "json_schema", schema: schemaVision } },
  });
  const text = res.content.find((b) => b.type === "text")?.text;
  if (!text || res.stop_reason === "max_tokens") throw new Error("respuesta truncada/vacía");
  const r = JSON.parse(text);
  return {
    material: cleanText(r.material, MAX_MATERIAL_LEN) ?? null,
    patron: cleanPatron(r.patron) ?? null,
    color_secundario: cleanText(r.color_secundario, MAX_COLOR_LEN) ?? null,
  };
}

// --- Main ---------------------------------------------------------------------

await db.connect();

if (VISION) {
  // Candidatas de visión: activas SIN material (el pase de texto ya llenó lo que
  // el nombre daba). Trae la ruta de imagen por las 4 fuentes posibles.
  const { rows } = await db.query(`
    select i.id, i.attrs->>'nombre' nombre, i.attrs->>'color' color,
           i.attrs->>'patron' patron_actual,
           i.attrs->>'color_secundario' color_sec_actual,
           i.attrs->>'atributos_v21' marca,
           i.render_status, i.render_path, i.photo_path,
           i.attrs->>'image_path' image_path_prestada,
           a.image_path arch_image
    from items i left join archetypes a on a.id = i.archetype_id
    where i.deleted_at is null
      and i.attrs->>'nombre' is not null
      and i.attrs->>'material' is null
    order by i.created_at
    ${LIMIT ? `limit ${LIMIT}` : ""}`);
  console.log(`Candidatas al pase de VISIÓN (sin material): ${rows.length} prendas`);

  // --- Validación visión: Haiku vs Opus sobre la MISMA imagen ---
  if (VALIDATE) {
    const paso = Math.max(1, Math.floor(rows.length / VALIDATE));
    const muestra = rows.filter((_, i) => i % paso === 0).slice(0, VALIDATE);
    console.log(`\nValidando ${muestra.length} prendas (visión): ${MODELO_BARATO} vs ${MODELO_REFERENCIA}\n`);
    let okP = 0;
    let okM = 0;
    let n = 0;
    for (const row of muestra) {
      const img = await imagenDePrenda(row);
      if (!img) {
        console.log(`(sin imagen) ${row.nombre} — se salta`);
        continue;
      }
      const [b, r] = await Promise.all([
        inferirVision(row, img, MODELO_BARATO),
        inferirVision(row, img, MODELO_REFERENCIA),
      ]);
      n++;
      if (b.patron === r.patron) okP++;
      if (b.material === r.material) okM++;
      console.log(
        `${b.patron === r.patron && b.material === r.material ? "✓" : "✗"} ${row.nombre}\n` +
          `    haiku: ${b.material ?? "—"} · ${b.patron ?? "—"} · ${b.color_secundario ?? "—"}\n` +
          `    opus:  ${r.material ?? "—"} · ${r.patron ?? "—"} · ${r.color_secundario ?? "—"}`
      );
    }
    console.log(`\nAcuerdo patrón: ${okP}/${n} · material: ${okM}/${n}`);
    await db.end();
    process.exit(0);
  }

  // --- Backfill visión (dry-run u --apply) ---
  let escritas = 0;
  let sinImagen = 0;
  let sinDatos = 0;
  let patronCorregido = 0;
  for (let i = 0; i < rows.length; i += PARALELO_VISION) {
    const grupo = rows.slice(i, i + PARALELO_VISION);
    // Inferencia en paralelo; las ESCRITURAS después y en serie (pg.Client no
    // soporta queries simultáneas en una conexión).
    const resultados = await Promise.all(
      grupo.map(async (row) => {
        const img = await imagenDePrenda(row);
        if (!img) {
          sinImagen++;
          return null;
        }
        try {
          return { row, inf: await inferirVision(row, img, MODELO_BARATO) };
        } catch (e) {
          console.error(`falló ${row.nombre}: ${e.message} — se salta, re-correr después`);
          return null;
        }
      })
    );
    for (const r of resultados) {
      if (!r) continue;
      const { row, inf } = r;
      const patch = {};
      if (inf.material) patch.material = inf.material; // solo falta (query lo garantiza)
      if (inf.color_secundario && !row.color_sec_actual) patch.color_secundario = inf.color_secundario;
      // patron: la visión puede corregir el del pase de texto (máquina↔máquina);
      // uno del análisis original o del usuario no se toca.
      if (inf.patron && row.marca === "backfill-texto-haiku" && inf.patron !== row.patron_actual) {
        patch.patron = inf.patron;
        patronCorregido++;
      }
      if (Object.keys(patch).length === 0) {
        sinDatos++;
        continue;
      }
      patch.atributos_v21 = "backfill-vision-haiku";
      if (APPLY) {
        await db.query(
          `update items set attrs = attrs || $1::jsonb
           where id = $2 and attrs->>'material' is null`,
          [JSON.stringify(patch), row.id]
        );
      } else {
        console.log(`[dry-run] ${row.nombre} → ${JSON.stringify(patch)}`);
      }
      escritas++;
    }
    if ((i / PARALELO_VISION) % 10 === 9) console.log(`… ${Math.min(i + PARALELO_VISION, rows.length)}/${rows.length}`);
  }
  console.log(
    `\n${APPLY ? "Escritas" : "[dry-run] Se escribirían"}: ${escritas} · patrón corregido: ${patronCorregido} · sin imagen: ${sinImagen} · sin señal: ${sinDatos}`
  );
  await db.end();
  process.exit(0);
}

// ============================== MODO TEXTO ======================================

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
  const paso = Math.max(1, Math.floor(rows.length / VALIDATE));
  const muestra = rows.filter((_, i) => i % paso === 0).slice(0, VALIDATE);
  console.log(`\nValidando ${muestra.length} prendas: ${MODELO_BARATO} vs ${MODELO_REFERENCIA}\n`);
  const [barato, referencia] = await Promise.all([
    inferirLoteTexto(muestra, MODELO_BARATO),
    inferirLoteTexto(muestra, MODELO_REFERENCIA),
  ]);
  let acuerdoPatron = 0;
  let acuerdoMaterial = 0;
  muestra.forEach((p, i) => {
    const b = barato[i];
    const r = referencia[i];
    if (b.patron === r.patron) acuerdoPatron++;
    if (b.material === r.material) acuerdoMaterial++;
    console.log(
      `${b.patron === r.patron && b.material === r.material ? "✓" : "✗"} ${p.nombre}\n` +
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

// --- Backfill texto (dry-run u --apply) ----------------------------------------
let escritas = 0;
let sinDatos = 0;
for (let i = 0; i < rows.length; i += LOTE_TEXTO) {
  const lote = rows.slice(i, i + LOTE_TEXTO);
  let inferidos;
  try {
    inferidos = await inferirLoteTexto(lote, MODELO_BARATO);
  } catch (e) {
    console.error(`Lote ${i / LOTE_TEXTO + 1} falló (${e.message}) — se salta, re-correr después.`);
    continue;
  }
  for (let j = 0; j < lote.length; j++) {
    const inf = inferidos[j];
    const patch = {};
    if (inf.material) patch.material = inf.material;
    if (inf.patron) patch.patron = inf.patron;
    if (inf.color_secundario) patch.color_secundario = inf.color_secundario;
    if (Object.keys(patch).length === 0) {
      sinDatos++;
      continue;
    }
    patch.atributos_v21 = "backfill-texto-haiku";
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
  console.log(`Lote ${Math.floor(i / LOTE_TEXTO) + 1}/${Math.ceil(rows.length / LOTE_TEXTO)} listo`);
}
console.log(
  `\n${APPLY ? "Escritas" : "[dry-run] Se escribirían"}: ${escritas} prendas · sin señal suficiente: ${sinDatos}`
);
await db.end();
