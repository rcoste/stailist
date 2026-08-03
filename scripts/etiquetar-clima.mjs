// Etiqueta el CLIMA de cada referencia viendo la ropa, no el query de búsqueda.
//
// POR QUÉ EXISTE (ver también 0097)
// Cosechar "invierno" con la palabra winter en Pinterest falló medible: de 22
// fotos "winter", solo 7 eran de frío. La etiqueta de la búsqueda miente; la
// ropa visible no — manga corta y lino es calor, abrigo de lana es frío. Así
// que el clima se deduce por visión, foto por foto.
//
// Corre sobre la BASE, no sobre el disco: baja cada foto del bucket con la
// service key. Así funciona igual para el retro-etiquetado de lo ya curado que
// para cosechas futuras (correrlo después de subir-referencias.mjs), y no
// depende de que los archivos locales sigan existiendo.
//
// Solo toca filas con clima null y que no estén rechazadas: lo descartado no
// destila, gastarle visión sería tirar dinero.
//
// Uso: node scripts/etiquetar-clima.mjs [genero]   (default hombre)

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

// La seña va ANTES del veredicto a propósito: obliga a nombrar las prendas
// que se ven antes de decidir, en vez de contestar "templado" por defecto.
const SISTEMA = `Clasificas para qué CLIMA está vestida la persona de la foto, viendo solo la ropa.

- "calor": manga corta, lino, shorts, sandalias, telas abiertas o muy ligeras, sin capas.
- "templado": manga larga ligera, una sola capa fina (sobrecamisa, saco sin nada grueso abajo), entretiempo.
- "frio": abrigo, chamarra gruesa o de lana, capas múltiples, tejido grueso, bufanda, guantes.

Regla de desempate: manda la prenda MÁS abrigadora visible. Un saco sobre camiseta es templado; un abrigo sobre suéter es frío. Si de verdad no se puede leer (foto recortada, ropa tapada), usa "templado".`;

const ESQUEMA = {
  type: "object",
  properties: {
    sena: { type: "string", description: "Las prendas visibles que señalan el clima, en pocas palabras" },
    clima: { type: "string", enum: ["calor", "templado", "frio"] },
  },
  required: ["sena", "clima"],
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
              { type: "text", text: "¿Para qué clima está vestido?" },
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
   where genero = $1 and clima is null and (sirve is not false)
   order by estilo, path`,
  [genero]
);
console.log(`${rows.length} referencias sin clima.\n`);

let errores = 0;
const conteo = new Map(); // estilo → { calor, templado, frio }
for (let i = 0; i < rows.length; i += CONCURRENCIA) {
  const lote = rows.slice(i, i + CONCURRENCIA);
  const veredictos = await Promise.all(lote.map(etiquetar));
  for (let j = 0; j < lote.length; j++) {
    const ref = lote[j];
    const v = veredictos[j];
    if (v.error || !v.clima) {
      errores++;
      if (errores <= 3) console.error(`  ⚠ ${ref.path}: ${v.error ?? "sin veredicto"}`);
      continue;
    }
    await db.query(`update public.referencias set clima = $1 where id = $2`, [v.clima, ref.id]);
    if (!conteo.has(ref.estilo)) conteo.set(ref.estilo, { calor: 0, templado: 0, frio: 0 });
    conteo.get(ref.estilo)[v.clima]++;
  }
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, rows.length)} de ${rows.length}`);
}

console.log("\n");
console.table(
  [...conteo.entries()].map(([estilo, c]) => ({ estilo, ...c }))
);
if (errores) {
  console.error(`⚠ ${errores} sin etiquetar (quedan con clima null; re-corre para reintentarlas).`);
  if (errores === rows.length) process.exitCode = 1;
}
await db.end();
