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

- "calor": manga corta, lino, seersucker, algodón abierto, shorts, sandalias o mocasín sin calcetín, telas ligeras y claras. TAMBIÉN cuenta un saco o traje SI la tela es de verano —lino, seersucker, algodón sin forro, hombro blando— porque eso es ropa de calor, no una capa de abrigo.
- "templado": manga larga de peso medio, una capa fina de entretiempo, lana ligera, mezclilla.
- "frio": abrigo, chamarra gruesa o de lana con forro, capas múltiples, tejido grueso, bufanda, guantes.

JUZGA POR LA TELA Y EL PESO, NO POR SI HAY UNA CAPA. Este es EL error a evitar y ya se cometió: la versión anterior decía "un saco es templado" y por eso un traje de lino crudo cruzado, en pleno sol de verano, quedó marcado como templado. Un saco de lino en Florencia en junio es calor; el mismo corte en lana con forro es frío. La prenda no dice el clima — la tela sí.

Señales de que un saco es de VERANO: lino arrugado, color crudo o claro, sin forro (se ve la caída blanda), hombro sin estructura, se lleva sobre camisa sin corbata o con la camisa abierta, calzado sin calcetín, sol duro y sombras marcadas en la foto.

Regla de desempate: manda la prenda más abrigadora visible, PESADA POR SU TELA. Un abrigo de lana sobre suéter es frío. Un saco de lino sobre camisa es calor. Si de verdad no se puede leer (foto recortada, ropa tapada), usa "templado".`;

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

// --rehacer-arregladas: vuelve a mirar las que YA tienen clima pero son de
// registro arreglado/formal.
//
// POR QUÉ HACE FALTA UNA PASADA HACIA ATRÁS
// El criterio viejo decía literalmente que un saco es "templado", así que
// degradaba a templado TODO look arreglado de verano. Se cazó con un traje de
// lino crudo cruzado, fotografiado a pleno sol en Pitti, marcado como templado.
// Con ese sesgo, la casilla "arreglado + calor" quedó en 2 fotos de 113
// arregladas (2%) y parecía que faltaba material — cuando lo que fallaba era la
// clasificación. Sin re-mirar lo ya etiquetado, el arreglo del criterio solo
// sirve para lo que se coseche de aquí en adelante.
const REHACER = process.argv.includes("--rehacer-arregladas");
const { rows } = await db.query(
  REHACER
    ? `select id, estilo, path from public.referencias
       where genero = $1 and registro in ('arreglado','formal') and (sirve is not false)
       order by estilo, path`
    : `select id, estilo, path from public.referencias
       where genero = $1 and clima is null and (sirve is not false)
       order by estilo, path`,
  [genero]
);
console.log(`${rows.length} referencias ${REHACER ? "arregladas por re-mirar" : "sin clima"}.\n`);

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
