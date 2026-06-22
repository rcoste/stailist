// Backfill de atributos de styling (largo/corte/manga) en los arquetipos del
// catálogo, leyéndolos por VISIÓN de su flat-lay limpio. Lectura mecánica de
// alto volumen → Haiku (barato/rápido, preciso de sobra aquí).
//   node scripts/backfill-archetype-styling.mjs test   → 4 ejemplos, imprime
//   node scripts/backfill-archetype-styling.mjs         → todos, escribe el .sql
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const TEST = process.argv[2] === "test";
const CONCURRENCY = 8;

const env = readFileSync(".env.local", "utf8").split("\n");
const get = (k) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim().replace(/^"|"$/g, "");
const url = get("DATABASE_URL");
const apiKey = get("ANTHROPIC_API_KEY");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(
  "select id, name, category, image_path from archetypes order by id" + (TEST ? " limit 4" : "")
);
await client.end();

const anthropic = new Anthropic({ apiKey });

async function read(arch) {
  const file = "public" + arch.image_path; // /archetypes/x.png → public/archetypes/x.png
  if (!existsSync(file)) return { ...arch, skip: "sin imagen" };
  const b64 = readFileSync(file).toString("base64");
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system:
        "Miras el flat-lay de UNA prenda y devuelves solo sus atributos de styling, para sugerir cómo llevarla. Usa 'na' cuando el atributo no aplique a esa prenda (ej. manga en un pantalón o zapato).",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        { type: "text", text: `Prenda: ${arch.name} (${arch.category}). Da largo/corte/manga.` },
      ] }],
      output_config: { format: { type: "json_schema", schema: {
        type: "object",
        properties: {
          largo: { type: "string", enum: ["crop", "regular", "largo", "na"] },
          corte: { type: "string", enum: ["entallado", "recto", "holgado", "na"] },
          manga: { type: "string", enum: ["sin", "corta", "larga", "na"] },
        },
        required: ["largo", "corte", "manga"],
        additionalProperties: false,
      } } },
    });
    const txt = res.content.find((b) => b.type === "text")?.text;
    const a = JSON.parse(txt);
    // Quita los "na": solo guardamos lo que aplica.
    const out = {};
    for (const k of ["largo", "corte", "manga"]) if (a[k] && a[k] !== "na") out[k] = a[k];
    return { ...arch, attrs: out };
  } catch (e) {
    return { ...arch, skip: String(e).slice(0, 60) };
  }
}

// Procesa en lotes con tope de concurrencia.
const results = [];
for (let i = 0; i < rows.length; i += CONCURRENCY) {
  const batch = rows.slice(i, i + CONCURRENCY);
  results.push(...(await Promise.all(batch.map(read))));
  process.stdout.write(`\r${results.length}/${rows.length}`);
}
console.log("");

if (TEST) {
  for (const r of results) console.log(`${r.name} (${r.category}) → ${JSON.stringify(r.attrs ?? r.skip)}`);
  process.exit(0);
}

// Migración: merge aditivo en attrs (no pisa nada existente).
const esc = (s) => s.replace(/'/g, "''");
const lines = ["-- Backfill: atributos de styling (largo/corte/manga) en arquetipos,", "-- leídos por visión de cada flat-lay. Merge aditivo (attrs || ...)."];
let n = 0;
for (const r of results) {
  if (!r.attrs || Object.keys(r.attrs).length === 0) continue;
  lines.push(`update public.archetypes set attrs = attrs || '${esc(JSON.stringify(r.attrs))}'::jsonb where id = ${r.id};`);
  n++;
}
writeFileSync("supabase/migrations/0049_archetype_styling.sql", lines.join("\n") + "\n");
console.log(`Escrito 0049_archetype_styling.sql con ${n} updates (de ${rows.length}).`);
