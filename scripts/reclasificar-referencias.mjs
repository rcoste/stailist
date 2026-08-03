// Re-clasifica filas de la BASE a las familias v2, viendo cada foto.
//
// PARA QUÉ EXISTE
// La taxonomía v2 disolvió las casillas que no eran familias (tonos-tierra,
// color-protagonista) y abrió 5 familias que antes no existían (street-urbano,
// deportivo, utilitario, thrift-vintage, resort-boho). Dos consecuencias sobre
// filas ya existentes:
//
// 1. Las fotos de las casillas disueltas necesitan casa nueva.
// 2. Las que en su momento se marcaron "sin-estilo" merecen segunda oportunidad:
//    muchas eran street/técnico/utility y no cabían en las 9 casillas de
//    entonces — el clasificador dijo "ninguno" y tenía razón... contra un
//    catálogo incompleto.
//
// Reglas de escritura:
// - Clasificada con confianza → estilo nuevo. Si venía juzgada de una casilla
//   disuelta, su juicio se borra (sirve = null): fue un juicio sobre OTRA
//   pregunta ("¿buen ejemplo de tonos tierra?"), no sobre la familia nueva.
// - "ninguno" o confianza baja → sirve = false, motivo 'sin-estilo'.
//
// Uso: node scripts/reclasificar-referencias.mjs [genero]

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { FAMILIAS } from "./familias.mjs";

const genero = process.argv[2] ?? "hombre";
const CONCURRENCIA = 6;
const MIN_CONFIANZA = 4;

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
const db = new pg.Client({ connectionString: leer("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await db.connect();

const SISTEMA = `Clasificas fotos de outfits masculinos según a qué familia de estilo pertenecen.

Familias posibles:
${Object.entries(FAMILIAS).map(([id, f]) => `- ${id}: ${f.descripcion}`).join("\n")}

Reglas:
- Contesta la familia que MEJOR describe el look, no la que se le parezca de lejos.
- Si el look no es claramente de ninguna, contesta "ninguno". Es una respuesta correcta.
- Un look puede rozar dos familias; elige la dominante y baja la confianza.
- No juzgues si te gusta ni si está bien puesto. Solo a qué familia pertenece.

Confianza 1-5: 5 = ejemplo de libro; 3 = encaja con dudas; 1 = casi adivinando.`;

const ESQUEMA = {
  type: "object",
  properties: {
    observado: { type: "string", description: "Qué lleva puesto, en pocas palabras" },
    familia: { type: "string", enum: [...Object.keys(FAMILIAS), "ninguno"] },
    confianza: { type: "integer", description: "1 a 5" },
  },
  required: ["observado", "familia", "confianza"],
  additionalProperties: false,
};

async function clasificar(ref) {
  const { data, error } = await supabase.storage.from("referencias").download(ref.path);
  if (error) return { error: error.message };
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  const tipo = ref.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: SISTEMA,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: tipo, data: b64 } },
            { type: "text", text: "¿De qué familia es este look?" },
          ],
        }],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      return JSON.parse(r.content.find((c) => c.type === "text")?.text ?? "{}");
    } catch (e) {
      if (i === 3) return { error: e.message };
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

// Dos poblaciones: casillas disueltas (con o sin juicio) y los sin-estilo de
// cuando el catálogo no tenía familias street/técnicas.
const { rows } = await db.query(
  `select id, estilo, path, sirve from public.referencias
   where genero = $1 and (
     estilo in ('tonos-tierra', 'color-protagonista')
     or (sirve = false and motivo = 'sin-estilo')
   ) order by estilo, path`,
  [genero]
);
console.log(`${rows.length} filas por re-clasificar.\n`);

const conteo = new Map();
let sinCasa = 0;
let errores = 0;
for (let i = 0; i < rows.length; i += CONCURRENCIA) {
  const lote = rows.slice(i, i + CONCURRENCIA);
  const vs = await Promise.all(lote.map(clasificar));
  for (let j = 0; j < lote.length; j++) {
    const ref = lote[j];
    const v = vs[j];
    if (v.error) {
      errores++;
      if (errores <= 3) console.error(`  ⚠ ${ref.path}: ${v.error}`);
      continue;
    }
    if (v.familia === "ninguno" || v.confianza < MIN_CONFIANZA) {
      // Se mueven a la carpeta de tránsito, no se dejan con el nombre viejo:
      // una casilla disuelta que conserva filas rechazadas sigue apareciendo en
      // el panel del destilador como si fuera una familia, y quien cura no
      // tiene forma de saber que ya no existe. Pasó con tonos-tierra y
      // color-protagonista: 25 filas rechazadas mantenían vivas dos familias
      // que la taxonomía v2 había eliminado.
      await db.query(
        `update public.referencias
         set estilo = '_sin-familia', sirve = false, motivo = 'sin-estilo'
         where id = $1`,
        [ref.id]
      );
      sinCasa++;
      continue;
    }
    // El juicio previo era sobre otra casilla: se re-pregunta en la nueva.
    await db.query(
      `update public.referencias set estilo = $1, sirve = null, motivo = null, revision = null
       where id = $2`,
      [v.familia, ref.id]
    );
    conteo.set(v.familia, (conteo.get(v.familia) ?? 0) + 1);
  }
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, rows.length)} de ${rows.length}`);
}

console.log("\n");
console.table([...conteo.entries()].map(([familia, n]) => ({ familia, "re-ubicadas": n })));
console.log(`${sinCasa} sin casa (siguen sin-estilo), ${errores} errores.`);
await db.end();
