// Etiqueta la PALETA de cada referencia viendo la ropa. Hermano del etiquetador
// de clima (etiquetar-clima.mjs) — mismo patrón, otra dimensión.
//
// POR QUÉ ES DIMENSIÓN Y NO CASILLA
// "Tonos tierra" vivió como estilo y contaminó el reparto: le ganaba fotos a
// las familias reales (52 a 1 contra sastre en la cosecha de invierno) porque
// el color es más llamativo que la construcción para un clasificador de una
// sola casilla. El color describe CUALQUIER familia, así que viaja como columna.
//
// Bonus de producto: esta dimensión conecta las referencias con la colorimetría
// de la usuaria ("eres otoño → tus referencias en paleta tierra").
//
// Uso: node scripts/etiquetar-paleta.mjs [genero]   (default hombre)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const genero = process.argv[2] ?? "hombre";
const CONCURRENCIA = 6;

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");
const cliente = new Anthropic();
const supabase = createClient(leer("NEXT_PUBLIC_SUPABASE_URL"), leer("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const db = new pg.Client({
  connectionString: leer("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const SISTEMA = `Clasificas la PALETA de color de un outfit masculino, viendo solo la ropa.

- "tierra": mandan camel, oliva, café, arena, tonos naturales cálidos.
- "neutra": mandan blanco, gris, azul marino, beige frío — sin un color saturado.
- "oscura": el negro domina el conjunto, con poco más.
- "color": al menos una pieza de color saturado (rojo, verde, azul rey, amarillo...) ordena el look.

Regla de desempate: manda lo que ocupa MÁS superficie del conjunto. Un look neutro con un accesorio rojo chico sigue siendo neutro; un suéter rojo sobre pantalón gris es color.`;

const ESQUEMA = {
  type: "object",
  properties: {
    sena: { type: "string", description: "Los colores visibles y qué domina, en pocas palabras" },
    paleta: { type: "string", enum: ["tierra", "neutra", "oscura", "color"] },
  },
  required: ["sena", "paleta"],
  additionalProperties: false,
};

async function etiquetar(ref) {
  const { data, error } = await supabase.storage.from("referencias").download(ref.path);
  if (error) return { error: `descarga: ${error.message}` };
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  const tipo = ref.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 150,
        system: SISTEMA,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: tipo, data: b64 } },
              { type: "text", text: "¿Qué paleta manda en este look?" },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      return JSON.parse(r.content.find((c) => c.type === "text")?.text ?? "{}");
    } catch (e) {
      if (intento === 3) return { error: e.message };
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
}

const { rows } = await db.query(
  `select id, estilo, path from public.referencias
   where genero = $1 and paleta is null and (sirve is not false)
   order by estilo, path`,
  [genero]
);
console.log(`${rows.length} referencias sin paleta.\n`);

let errores = 0;
const conteo = new Map();
for (let i = 0; i < rows.length; i += CONCURRENCIA) {
  const lote = rows.slice(i, i + CONCURRENCIA);
  const vs = await Promise.all(lote.map(etiquetar));
  for (let j = 0; j < lote.length; j++) {
    const v = vs[j];
    if (v.error || !v.paleta) {
      errores++;
      if (errores <= 3) console.error(`  ⚠ ${lote[j].path}: ${v.error ?? "sin veredicto"}`);
      continue;
    }
    await db.query(`update public.referencias set paleta = $1 where id = $2`, [v.paleta, lote[j].id]);
    conteo.set(v.paleta, (conteo.get(v.paleta) ?? 0) + 1);
  }
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, rows.length)} de ${rows.length}`);
}

console.log("\n");
console.table([...conteo.entries()].map(([paleta, n]) => ({ paleta, n })));
if (errores) {
  console.error(`⚠ ${errores} sin etiquetar (quedan null; re-corre para reintentar).`);
  if (errores === rows.length) process.exitCode = 1;
}
await db.end();
