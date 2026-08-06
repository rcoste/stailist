// Etiqueta la SILUETA de cada referencia: qué tan pegada al cuerpo va la ropa.
//
// Tercer hermano de etiquetar-clima.mjs y etiquetar-paleta.mjs — mismo patrón,
// otra dimensión. Ver 0100 para el porqué.
//
// La escala mira la PROPORCIÓN del conjunto, no una prenda: un saco entallado
// sobre pantalón amplio no es "ceñido", es una silueta mixta que manda por la
// pieza de abajo, que es la que define la lectura del cuerpo entero.
//
// Uso: node scripts/etiquetar-silueta.mjs [genero]   (default hombre)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { llamar } from "../lib/proveedores";
import { TAG_MODEL } from "../lib/models";

// Envuelto en main(): tsx compila los .ts a CommonJS y ahí el await de
// nivel superior no existe. Los demás scripts .ts del proyecto hacen igual.
async function main() {

const genero = process.argv[2] ?? "hombre";
const CONCURRENCIA = 6;
/** Tope de referencias por corrida. 0 = todas. Sirve para probar un cambio
 *  con seis imágenes antes de soltarlo sobre cientos. */
const TOPE = Number((process.argv.find((a) => a.startsWith("--n=")) ?? "--n=0").split("=")[1]);

const env = readFileSync(".env.local", "utf8");
const leer = (k: string): string => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : "";
};
// Las dos llaves: la de Anthropic por si el modelo de etiquetado vuelve a
// serlo, y la de Google, que es la que usa hoy (ver TAG_MODEL).
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");
process.env.GOOGLE_GENERATIVE_AI_API_KEY = leer("GOOGLE_GENERATIVE_AI_API_KEY");
const supabase = createClient(leer("NEXT_PUBLIC_SUPABASE_URL"), leer("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const db = new pg.Client({
  connectionString: leer("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const SISTEMA = `Clasificas la SILUETA de un outfit masculino: qué tan pegada al cuerpo va la ropa.

- "cenida": la ropa sigue el cuerpo. Pantalón slim o skinny, prendas de arriba entalladas, se lee la forma del cuerpo debajo.
- "recta": ni pegada ni suelta. Pantalón de corte recto que cae desde la cadera, hombro en su sitio, holgura normal. Es la silueta clásica y la más común.
- "holgada": la ropa cae lejos del cuerpo. Pantalón amplio o baggy, hombros caídos, prendas oversized, mucho volumen de tela.

Reglas:
- Manda la PROPORCIÓN del conjunto, no una prenda suelta.
- Ante una silueta mixta (arriba entallado, abajo amplio) manda la pieza de ABAJO: es la que define cómo se lee el cuerpo entero.
- Un abrigo largo no es holgura por sí solo: mira cómo cae sobre el cuerpo y qué pasa con el pantalón.
- Si de verdad no se alcanza a ver el cuerpo (foto muy recortada), usa "recta".`;

const ESQUEMA = {
  type: "object",
  properties: {
    sena: { type: "string", description: "Cómo cae el pantalón y la prenda de arriba, en pocas palabras" },
    silueta: { type: "string", enum: ["cenida", "recta", "holgada"] },
  },
  required: ["sena", "silueta"],
  additionalProperties: false,
};

async function etiquetar(ref: { path: string }) {
  const { data, error } = await supabase.storage.from("referencias").download(ref.path);
  if (error) return { error: `descarga: ${error.message}` };
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  const tipo = ref.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await llamar({
        modelo: TAG_MODEL,
        maxTokens: 150,
        system: SISTEMA,
        texto: "¿Qué silueta tiene este look?",
        imagen: { mediaType: tipo, base64: b64 },
        schema: ESQUEMA,
      });
      return JSON.parse(r.texto);
    } catch (e) {
      if (intento === 3) return { error: (e as Error).message };
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
}

const { rows: todas } = await db.query(
  `select id, estilo, path from public.referencias
   where genero = $1 and silueta is null and (sirve is not false)
   order by estilo, path`,
  [genero]
);
const rows = TOPE ? todas.slice(0, TOPE) : todas;
console.log(`${rows.length} referencias sin silueta.\n`);

let errores = 0;
const porEstilo = new Map();
for (let i = 0; i < rows.length; i += CONCURRENCIA) {
  const lote = rows.slice(i, i + CONCURRENCIA);
  const vs = await Promise.all(lote.map(etiquetar));
  for (let j = 0; j < lote.length; j++) {
    const ref = lote[j];
    const v = vs[j];
    if (v.error || !v.silueta) {
      errores++;
      if (errores <= 3) console.error(`  ⚠ ${ref.path}: ${v.error ?? "sin veredicto"}`);
      continue;
    }
    await db.query(`update public.referencias set silueta = $1 where id = $2`, [v.silueta, ref.id]);
    if (!porEstilo.has(ref.estilo)) porEstilo.set(ref.estilo, { cenida: 0, recta: 0, holgada: 0 });
    porEstilo.get(ref.estilo)[v.silueta]++;
  }
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, rows.length)} de ${rows.length}`);
}

console.log("\n");
// Por familia, no en total: lo que interesa es si cada familia tiene una
// silueta propia o admite varias — eso es justo lo que la receta debe decir.
console.table([...porEstilo.entries()].map(([estilo, c]) => ({ estilo, ...c })));
if (errores) {
  console.error(`⚠ ${errores} sin etiquetar (quedan null; re-corre para reintentar).`);
  if (errores === rows.length) process.exitCode = 1;
}
await db.end();

}

main();
