// Corre el barrido: genera N looks reales y mide en qué falla el motor.
//
// Ver scripts/barrido-motor.mjs para el plan de muestreo y el porqué de cada
// dimensión. Este archivo es la parte que llama al motor de verdad.
//
// Usa el generador REAL (generateOutfits) con el prompt REAL, no una copia: si
// el barrido corriera contra una versión paralela del prompt mediría otra cosa
// que la que ve la gente, que es el error clásico de este tipo de arnés.
//
// Uso:  npx tsx scripts/barrido-correr.ts [--n=50] [--concurrencia=4]
// Salida: docs_para_claude/barrido/ultimo.json + resumen por frecuencia

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { generateOutfits, type GeneratedOutfit } from "../lib/engine/generate";
import { revisarEjecucion } from "../lib/engine/reglas-ejecucion";
import { recetasParaTags } from "../lib/engine/recetario";
import { computeTasteTags, LOOKS } from "../lib/looks";
import { EMPTY_TASTE_SIGNAL } from "../lib/engine/taste-signal";
import type { EngineContext, EngineItem } from "../lib/engine/prompt";
import { PERFILES, CLIMAS, OCASIONES, PALETAS, muestra } from "./barrido-motor.mjs";
import { cargarCatalogo, sortearCloset, closetHostil } from "./barrido-closets";
import { seasonPalette, type Season } from "../lib/colorimetria";

// La API key se lee del .env.local igual que el resto de los scripts.
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const arg = (k: string, d: number) =>
  Number((process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1]);
const N = arg("n", 50);
const CONC = arg("concurrencia", 4);

// ── Clósets: sorteados del catálogo REAL (ver barrido-closets.ts) ───────────
// La primera versión los escribió a mano y, sin querer, no incluyó ni un top
// cálido: el barrido "midió" que el motor rompía la paleta tierra el 30% de las
// veces cuando era imposible cumplirla con lo que se le dio. Una fixture
// inventada mide la fixture, no el motor.
let catalogo: Awaited<ReturnType<typeof cargarCatalogo>> = [];
// Semilla por caso: cada uno recibe un sorteo distinto (muchas combinaciones,
// no una foto) pero la corrida entera es reproducible.
function closetDe(tipo: string, semilla: number): EngineItem[] {
  if (tipo === "hostil") return closetHostil(catalogo, semilla);
  return sortearCloset(catalogo, tipo === "basicos" ? 18 : 45, semilla, tipo === "basicos");
}

// ── Gustos: swipes simulados por la tubería real ─────────────────────────────
// Los ❤️ pasan por computeTasteTags, no se escriben tags a mano: así el barrido
// prueba el puente deck → tags → familia, que es donde puede romperse en
// silencio.
function tagsDe(perfilId: string): string[] {
  const p = PERFILES.find((x) => x.id === perfilId)!;
  return computeTasteTags(
    LOOKS.map((l) => ({ id: l.id, liked: p.likes.includes(l.id) }))
  );
}

// ── El juez del barrido ──────────────────────────────────────────────────────
// NO es el juez de producción (ese repara). Éste solo mide: compara el look
// contra la receta de su propia familia y contra el contexto del caso.
const client = new Anthropic();

// Los colores de verdad de esa colorimetría. Antes al juez solo se le pasaba el
// NOMBRE de la estación ("otoño") y deducía desde ahí — marcaba el azul marino
// como error cerca de la cara cuando en realidad es un prestado que ni suma ni
// resta. El dato existía en el código; no llegaba.
const paleta = (c: Caso) => {
  const p = seasonPalette(c.paleta as Season, null);
  const n = (xs: { nombre: string }[]) => xs.map((x) => x.nombre).join(", ") || "—";
  return { mejores: n(p.mejores), prestados: n(p.prestados), evita: n(p.evita) };
};
const ESQUEMA = {
  type: "object",
  properties: {
    cumple_silueta: { type: "boolean" },
    cumple_paleta: { type: "boolean", description: "El look usa la paleta DEL ESTILO (la de la receta). Es la señal más débil: si choca con su colorimetría, la colorimetría manda y esto NO cuenta como fallo." },
    respeta_clima: { type: "boolean" },
    respeta_ocasion: { type: "boolean" },
    color_near_face_ok: { type: "boolean", description: "El color del top/abrigo está en sus MEJORES o en sus PRESTADOS. Solo es false si está en los que le RESTAN." },
    vetos_de_receta_rotos: {
      type: "array",
      description: "Copia TEXTUAL de cada línea de 'lo que arruina el estilo' que este look rompe. Vacío si ninguna.",
      items: { type: "string" },
    },
    fallo_principal: {
      type: "string",
      description: "El defecto más grave en 6 palabras o menos, en minúsculas y reutilizable como etiqueta (ej. 'tenis de vestir con jogger'). Vacío si el look está bien.",
    },
  },
  required: ["cumple_silueta", "cumple_paleta", "respeta_clima", "respeta_ocasion", "color_near_face_ok", "vetos_de_receta_rotos", "fallo_principal"],
  additionalProperties: false,
};

async function juzgar(caso: Caso, outfit: GeneratedOutfit, items: EngineItem[]) {
  const receta = recetasParaTags(tagsDe(caso.perfil), "hombre")[0];
  if (!receta) return null;
  const prendas = outfit.item_ids
    .map((id) => items.find((i: EngineItem) => i.id === id))
    .filter(Boolean)
    .map((i) => `${i!.attrs.nombre} (${i!.attrs.color_hex}${i!.attrs.material ? ", " + i!.attrs.material : ""})`);

  const res = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 3000,
    system:
      "Mides looks contra criterios dados. No opinas de gusto: contestas si CUMPLEN. Ante la duda, cumple.\n" +
      "OJO — son DOS paletas distintas y no se mezclan: la COLORIMETRÍA es de la persona (qué color le favorece cerca de la cara) " +
      "y la PALETA DEL ESTILO es de la familia (qué colores usa ese estilo). Cuando se contradicen, la colorimetría le gana: " +
      "si un color está en sus mejores o prestados, cerca de la cara está BIEN aunque se salga de la paleta del estilo.",
    messages: [
      {
        role: "user",
        content:
          `RECETA — ${receta.nombre}\nSilueta: ${receta.silueta}\nPaleta: ${receta.paleta}\n` +
          `Lo que la arruina:\n${receta.evitar.map((e) => "- " + e).join("\n")}\n\n` +
          `SU COLORIMETRÍA (${caso.paleta}) — los colores REALES, no deduzcas del nombre de la estación:\n` +
          `  le SUMAN: ${paleta(caso).mejores}\n  PRESTADOS (ni suman ni restan): ${paleta(caso).prestados}\n  le RESTAN cerca de la cara: ${paleta(caso).evita}\n\n` +
          `CONTEXTO: ${caso.clima.weather.temp_c}°C · ocasión "${caso.ocasion}"\n\n` +
          `LOOK: ${prendas.join(" + ")}\n\n` +
          `Evalúalo.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: ESQUEMA } },
  } as never);
  const txt = (res as { content: { type: string; text?: string }[] }).content.find((c) => c.type === "text")?.text;
  return txt ? JSON.parse(txt) : null;
}

type Caso = {
  perfil: string;
  closet: string;
  clima: (typeof CLIMAS)[number];
  ocasion: string;
  paleta: string;
};

// ── Corrida ──────────────────────────────────────────────────────────────────
const casos: Caso[] = muestra(N, [
  PERFILES.map((p) => p.id),
  ["basicos", "completo", "hostil"],
  CLIMAS,
  OCASIONES,
  PALETAS,
]) as Caso[];

const resultados: unknown[] = [];
let hechos = 0;

async function correr(caso: Caso) {
  // La semilla sale del caso: mismo caso → mismo clóset, siempre.
  const items = closetDe(caso.closet, casos.indexOf(caso) * 7919 + 13);
  const tags = tagsDe(caso.perfil);
  const ctx: EngineContext = {
    gender: "hombre",
    // "evento de noche" es la etiqueta del barrido; el motor espera la clave
    // de OBJECTIVES. Sin este mapeo el objective caía a "Día a día" y el piso
    // de formalidad nunca se activaba — el barrido habría medido otra cosa.
    objective: caso.ocasion === "evento de noche" ? "evento" : caso.ocasion,
    plan: null,
    lifestyle: null,
    tasteTags: tags,
    archetype: null,
    season: caso.paleta as EngineContext["season"],
    flow: null,
    items,
    weather: caso.clima.weather,
    recentCombos: [],
    vetoes: [],
    timeOfDay: caso.ocasion === "evento de noche" ? "noche" : "dia",
    silueta: null,
    fitPref: "recta",
    tasteSignal: EMPTY_TASTE_SIGNAL,
  };

  try {
    const outfits = await generateOutfits(ctx);
    for (const o of outfits) {
      const prendas = o.item_ids.map((id) => items.find((i: EngineItem) => i.id === id)).filter(Boolean) as EngineItem[];
      const ejecucion = revisarEjecucion(prendas);
      const veredicto = await juzgar(caso, o, items);
      resultados.push({ caso, look: o.nombre, prendas: prendas.map((p) => p.attrs.nombre), ejecucion, veredicto });
    }
  } catch (e) {
    resultados.push({ caso, error: (e as Error).message });
  }
  console.log(`  ${++hechos}/${casos.length}  ${caso.perfil}/${caso.closet}/${caso.clima.id}`);
}

// Envuelto en main(): el archivo se compila a CommonJS y ahí el await de nivel
// superior no existe.
async function main() {
catalogo = await cargarCatalogo("hombre");
console.log(`Barrido: ${casos.length} casos, concurrencia ${CONC}\n`);
for (let i = 0; i < casos.length; i += CONC) {
  await Promise.all(casos.slice(i, i + CONC).map(correr));
}

mkdirSync("docs_para_claude/barrido", { recursive: true });
writeFileSync("docs_para_claude/barrido/ultimo.json", JSON.stringify(resultados, null, 2));

// ── Resumen por FRECUENCIA ───────────────────────────────────────────────────
// El punto entero del barrido: "esto pasa 8 de 50 veces" en vez de "vi uno feo".
const cuenta = new Map<string, number>();
const suma = (k: string) => cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
let looks = 0;
for (const r of resultados as { ejecucion?: { regla: string }[]; veredicto?: Record<string, unknown> }[]) {
  if (!r.ejecucion) continue;
  looks++;
  r.ejecucion.forEach((v) => suma(`ejecución: ${v.regla}`));
  const v = r.veredicto;
  if (!v) continue;
  for (const k of ["cumple_silueta", "cumple_paleta", "respeta_clima", "respeta_ocasion", "color_near_face_ok"]) {
    if (v[k] === false) suma(`receta: ${k}`);
  }
  (v.vetos_de_receta_rotos as string[])?.forEach(() => suma("receta: veto de la receta roto"));
  if (v.fallo_principal) suma(`fallo: ${v.fallo_principal}`);
}

console.log(`\n${looks} looks evaluados\n`);
console.log("FALLOS POR FRECUENCIA");
[...cuenta.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) =>
    console.log(`  ${String(n).padStart(3)}  (${Math.round((n / looks) * 100)}%)  ${k}`)
  );
console.log("\n→ docs_para_claude/barrido/ultimo.json");
}

main();
