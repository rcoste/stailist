// Destila la receta de una familia mirando SUS fotos aprobadas.
//
// POR QUÉ POR VISIÓN Y NO ESCRITA A MANO
// Las recetas v1 se escribieron leyendo las fotos y resumiendo a ojo, y dos de
// sus reglas resultaron falsas cuando se midieron ("smart casual necesita tres
// piezas", "el negro no es de clásico elegante"): eran impresiones del que
// escribía, no patrones del material. Aquí el modelo ve las fotos y sale una
// receta que se puede confrontar contra ellas.
//
// LAS TRES DIMENSIONES ENTRAN COMO DATO, NO COMO ADIVINANZA
// Cada foto ya viene con clima, paleta y silueta etiquetados (0097/0099/0100),
// así que el conteo real se le PASA al destilador en vez de pedirle que lo
// intuya. Eso permite dos cosas que antes no se podían: que la sección de frío
// salga del material de frío, y que la receta declare silueta solo cuando la
// familia de verdad la tiene (street-urbano es holgado en 69 de 77; sastre está
// repartido 8/7/8 y ahí el fit es de la persona, no del estilo).
//
// Escribe JSON a docs_para_claude/recetas/<familia>.json; el recetario de
// TypeScript se arma después con esos JSON a la vista.
//
// Uso: node scripts/destilar-familia.mjs <familia> [n-fotos]

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { FAMILIAS } from "./familias.mjs";

const familia = process.argv[2];
const TOPE = Number(process.argv[3] ?? 40);
if (!familia || !FAMILIAS[familia]) {
  console.error(`Uso: node scripts/destilar-familia.mjs <familia> [n]\nFamilias: ${Object.keys(FAMILIAS).join(", ")}`);
  process.exit(1);
}

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

// Se reparten las fotos entre climas para que la sección de frío no salga de
// dos ejemplos sueltos. md5 del id para que la muestra sea estable entre
// corridas y dos destilaciones se puedan comparar.
const { rows } = await db.query(
  `select path, clima, paleta, silueta from (
     select path, clima, paleta, silueta,
       row_number() over (partition by clima order by md5(id::text)) as n
     from public.referencias
     where genero = 'hombre' and estilo = $1 and sirve = true
   ) t where n <= $2 order by clima, n`,
  [familia, Math.ceil(TOPE / 3)]
);
if (!rows.length) {
  console.error(`${familia} no tiene fotos aprobadas.`);
  process.exit(1);
}

// El reparto REAL de las tres dimensiones, sobre todas las aprobadas (no solo
// la muestra): es el dato que decide si la familia tiene silueta propia.
const { rows: [conteo] } = await db.query(
  `select
     count(*) as total,
     count(*) filter (where clima='calor') as calor,
     count(*) filter (where clima='templado') as templado,
     count(*) filter (where clima='frio') as frio,
     count(*) filter (where paleta='tierra') as tierra,
     count(*) filter (where paleta='neutra') as neutra,
     count(*) filter (where paleta='oscura') as oscura,
     count(*) filter (where paleta='color') as color,
     count(*) filter (where silueta='cenida') as cenida,
     count(*) filter (where silueta='recta') as recta,
     count(*) filter (where silueta='holgada') as holgada
   from public.referencias where genero='hombre' and estilo=$1 and sirve=true`,
  [familia]
);

console.log(`${familia}: ${conteo.total} aprobadas, ${rows.length} en la muestra`);
console.log(`  clima   calor ${conteo.calor} · templado ${conteo.templado} · frío ${conteo.frio}`);
console.log(`  paleta  tierra ${conteo.tierra} · neutra ${conteo.neutra} · oscura ${conteo.oscura} · color ${conteo.color}`);
console.log(`  silueta ceñida ${conteo.cenida} · recta ${conteo.recta} · holgada ${conteo.holgada}\n`);

const imagenes = [];
for (const r of rows) {
  const { data, error } = await supabase.storage.from("referencias").download(r.path);
  if (error) continue;
  imagenes.push({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: Buffer.from(await data.arrayBuffer()).toString("base64"),
    },
  });
}
console.log(`${imagenes.length} fotos cargadas. Destilando...\n`);

const SISTEMA = `Destilas una receta de estilo masculino a partir de fotos de referencia reales. La receta la va a usar un motor de IA para ARMAR outfits con la ropa que alguien ya tiene, así que todo debe ser accionable.

Reglas duras:
- Describe lo que VES REPETIRSE en las fotos, no lo que sabes del estilo por cultura general. Si una regla no está en las fotos, no va.
- Prendas concretas, nunca vibras. "polo tejido + pantalón de tela + tenis blanco", no "un look pulido y versátil".
- Las FÓRMULAS mandan sobre los detalles: si una fórmula contradice una regla que escribiste, la regla está mal. Revísalas antes de entregar.
- Un detalle no es una orden. Si escribes "la camisa abierta es frecuente", el motor la meterá en todas partes — escribe cuándo aplica.
- Los colores van PEGADOS a la prenda donde los viste. Que un color esté en la paleta de la familia no lo vuelve válido para cualquier prenda: si el crema aparece en pantalones pero nunca en sacos, un saco crema NO va en las fórmulas.
- Cada fórmula declara para qué CLIMA es. Una lista plana no sirve: el motor recibe la temperatura del día y elegiría un cuello alto para 28°C. "calor" es manga corta y tela ligera; "templado" es manga larga sin capa de abrigo; "frio" ya lleva capa exterior o tejido grueso.
- El apartado de frío describe cómo abriga ESTA familia sin dejar de serlo. Sale solo de las fotos de frío.
- La silueta: declara una regla SOLO si las fotos la sostienen. Si el reparto está equilibrado, di explícitamente que la familia admite varias y que manda la preferencia de la persona.
- Español de México, sin jerga de revista.`;

const ESQUEMA = {
  type: "object",
  properties: {
    silueta: { type: "string", description: "La regla de proporción del estilo, en 1-3 frases. Si la familia admite varias siluetas, dilo." },
    // Con clima, no una lista plana: sin esta etiqueta el motor no puede saber
    // que un cuello alto no va a 28°C, y la prueba de reconstrucción sacó justo
    // eso — un look "templado" más abrigado que el de "frío".
    formulas: {
      type: "array",
      description: "10-15 combinaciones concretas a nivel prenda, repartidas entre los climas que la familia tenga",
      items: {
        type: "object",
        properties: {
          look: { type: "string", description: "Las prendas, a nivel prenda concreta" },
          clima: { type: "string", enum: ["calor", "templado", "frio"] },
        },
        required: ["look", "clima"],
        additionalProperties: false,
      },
    },
    detalles: { type: "array", items: { type: "string" }, description: "5-9 detalles que separan bien puesto de aguado" },
    evitar: { type: "array", items: { type: "string" }, description: "4-6 cosas que matan el estilo aunque las prendas sean correctas" },
    capsula: { type: "array", items: { type: "string" }, description: "10-14 prendas que más fórmulas generan" },
    frio: { type: "array", items: { type: "string" }, description: "3-6 reglas de cómo abriga esta familia" },
    paleta: { type: "string", description: "Los colores que manda la familia, en 1-2 frases" },
  },
  required: ["silueta", "formulas", "detalles", "evitar", "capsula", "frio", "paleta"],
  additionalProperties: false,
};

const r = await cliente.messages.create({
  model: "claude-opus-5",
  max_tokens: 4000,
  system: SISTEMA,
  messages: [{
    role: "user",
    content: [
      ...imagenes,
      {
        type: "text",
        text: `Estas ${imagenes.length} fotos son la familia "${FAMILIAS[familia].nombre}": ${FAMILIAS[familia].descripcion}

Reparto medido sobre las ${conteo.total} fotos aprobadas de la familia:
- clima: calor ${conteo.calor}, templado ${conteo.templado}, frío ${conteo.frio}
- paleta: tierra ${conteo.tierra}, neutra ${conteo.neutra}, oscura ${conteo.oscura}, color ${conteo.color}
- silueta: ceñida ${conteo.cenida}, recta ${conteo.recta}, holgada ${conteo.holgada}

Destila la receta.`,
      },
    ],
  }],
  output_config: { format: { type: "json_schema", schema: ESQUEMA } },
});

const receta = JSON.parse(r.content.find((c) => c.type === "text").text);
mkdirSync("docs_para_claude/recetas", { recursive: true });
writeFileSync(
  `docs_para_claude/recetas/${familia}.json`,
  JSON.stringify({ familia, conteo, receta }, null, 2)
);

console.log("SILUETA:", receta.silueta);
console.log("\nPALETA:", receta.paleta);
console.log("\nFÓRMULAS:");
for (const c of ["calor", "templado", "frio"]) {
  const f = receta.formulas.filter((x) => x.clima === c);
  if (f.length) console.log(`  [${c}] ${f.length}`);
  f.forEach((x) => console.log("    ·", x.look));
}
console.log("\nFRÍO:");
receta.frio.forEach((f) => console.log("  ·", f));
console.log(`\n→ docs_para_claude/recetas/${familia}.json`);
await db.end();
