// A/B ciego del recetario: mismo clóset, mismo contexto, con y sin recetario.
//
// POR QUÉ ASÍ
// La pregunta que decide si el recetario se queda no es "¿el texto suena bien?"
// —eso no se puede fallar— sino "¿los outfits mejoran?". Se generan 3 looks con
// el motor actual y 3 con el recetario conectado, sobre el clóset REAL de una
// persona, y se juzgan mezclados y sin etiqueta.
//
// Sin etiqueta importa: quien juzga sabe que esperamos que gane el recetario, y
// con la etiqueta a la vista eso solo se confirma a sí mismo.
//
// Criterio, escrito ANTES de correrlo para no acomodarlo después:
//   4 o más de 6 elegidos son del recetario  → funciona, se escala a los 27 estilos
//   3 y 3                                     → no aportó nada, se tira
//
// Uso: node scripts/ab-recetario.mjs <email>

import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/ab-recetario.mjs <email>");
  process.exit(1);
}

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(k + "="));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");

const db = new pg.Client({
  connectionString: leer("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const { rows: perfiles } = await db.query(
  `select p.id, p.gender, p.taste_tags, p.palette_season, p.body_build
   from profiles p join auth.users u on u.id = p.id where u.email = $1`,
  [email]
);
if (!perfiles.length) {
  console.error(`No encontré a ${email}`);
  process.exit(1);
}
const perfil = perfiles[0];

const { rows: items } = await db.query(
  `select i.id, i.attrs, coalesce(a.name, i.attrs->>'nombre') nombre
   from items i left join archetypes a on a.id = i.archetype_id
   where i.user_id = $1 and i.deleted_at is null`,
  [perfil.id]
);

// SOLO LECTURA de la base: nada de esto se guarda. Un A/B que escribe outfits en
// producción le mete al historial de una persona real looks que nadie pidió.
await db.end();

const { generateOutfits } = await import("../lib/engine/generate.ts");
const { recetasParaTags, recetasParaPrompt } = await import("../lib/engine/recetario.ts");

const ctxBase = {
  gender: perfil.gender,
  objective: "trabajo",
  plan: null,
  lifestyle: null,
  tasteTags: perfil.taste_tags ?? [],
  archetype: null,
  season: perfil.palette_season ?? null,
  flow: null,
  items: items.map((i) => ({ id: i.id, attrs: i.attrs })),
  weather: { temp_c: 24, condition: "despejado" },
  recentCombos: [],
  vetoes: [],
  timeOfDay: "dia",
  silueta: null,
  tasteSignal: { worn: [], liked: [], disliked: [], skipped: [] },
};

const recetas = recetasParaTags(ctxBase.tasteTags, perfil.gender);
console.log(`Clóset: ${items.length} prendas`);
console.log(`Gustos: ${ctxBase.tasteTags.join(", ")}`);
console.log(`Recetas que aplican: ${recetas.map((r) => r.nombre).join(" + ") || "ninguna"}\n`);
if (!recetas.length) {
  console.error("Sin recetas aplicables: el A/B no mediría nada.");
  process.exit(1);
}

// El brazo SIN recetario se consigue vaciando los tags: el prompt lleva el
// bloque solo cuando hay tags que empaten. Sacrifica también la línea de "tags
// de gusto", así que NO es un A/B perfecto — es el brazo "motor sin señal de
// estilo concreta", que es justo lo que había antes.
console.log("Generando 3 SIN recetario…");
const sinReceta = await generateOutfits({ ...ctxBase, tasteTags: [] });
console.log("Generando 3 CON recetario…");
const conReceta = await generateOutfits(ctxBase);

const nombreDe = new Map(items.map((i) => [i.id, i.nombre]));
const describir = (o) => ({
  titulo: o.nombre,
  prendas: o.item_ids.map((id) => nombreDe.get(id) ?? id),
  porque: o.explicacion,
});

const mezcla = [
  ...sinReceta.slice(0, 3).map((o) => ({ brazo: "sin", ...describir(o) })),
  ...conReceta.slice(0, 3).map((o) => ({ brazo: "con", ...describir(o) })),
];
// Orden fijo pero intercalado: sin Math.random (no está disponible en scripts de
// workflow y además un orden reproducible facilita revisar el resultado después).
const orden = [0, 3, 1, 4, 2, 5];
const barajado = orden.map((i) => mezcla[i]).filter(Boolean);

console.log("\n─────────── LOS 6 LOOKS, SIN ETIQUETA ───────────\n");
barajado.forEach((o, i) => {
  console.log(`${String.fromCharCode(65 + i)}.  ${o.titulo}`);
  console.log(`    ${o.prendas.join(" · ")}`);
  console.log(`    "${o.porque}"\n`);
});

writeFileSync(
  "/tmp/ab-recetario.json",
  JSON.stringify({ email, barajado, letras: barajado.map((o, i) => ({ letra: String.fromCharCode(65 + i), brazo: o.brazo })) }, null, 2)
);
console.log("La clave de cuál es cuál quedó en /tmp/ab-recetario.json (no la abras antes de elegir).");
