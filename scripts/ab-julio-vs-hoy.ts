// EL A/B DE VERDAD: el motor de julio contra el de hoy.
//
// LA PREGUNTA, en una frase
// ¿Sirvió de algo la semana de destilar 616 fotos en recetas, o el motor de
// julio ya lo hacía igual de bien?
//
// POR QUÉ ESTE Y NO EL ANTERIOR
// El primer A/B comparaba el motor de hoy contra el motor de hoy SIN recetario,
// y eso no es el motor de julio: el lado "viejo" seguía llevando la escalera de
// prioridades y el piso de formalidad, que también son de esta semana. Roberto
// lo cazó — "siento que estamos usando la misma receta, que es la nueva". Aquí
// el lado viejo es el archivo de julio congelado (scripts/motor-v27.ts).
//
// LO QUE ES IGUAL EN LOS DOS LADOS, a propósito:
//   · el perfil (el rehecho con el onboarding actual: deck v4 + pares de corte)
//   · el clóset (sus 127 prendas reales) Y su orden barajado
//   · el clima, la ocasión y el momento del día
//   · el modelo (Opus 5) y el thinking apagado
//   · el arreglo de la CATEGORÍA de las prendas — es un bug que estuvo roto para
//     todos, no parte de la forma nueva de generar. Si fuera solo del lado
//     nuevo, el A/B mediría el bug arreglado y no la receta.
//
// LO ÚNICO QUE CAMBIA: recetas destiladas + marca de prendas por familia +
// escalera de prioridades + piso de formalidad.
//
// Uso: npx tsx scripts/ab-julio-vs-hoy.ts [--conc=3]
// Salida: docs_para_claude/barrido/ab-julio-vs-hoy.json

import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ENGINE_MODEL } from "../lib/models";
import { buildOutfitSchema } from "../lib/engine/schema";
import { generateOutfits } from "../lib/engine/generate";
import {
  orderClosetForEngine,
  type EngineContext,
  type EngineItem,
} from "../lib/engine/prompt";
import {
  SYSTEM_PROMPT as SYSTEM_V27,
  buildUserMessage as buildUserMessageV27,
  type EngineContext as EngineContextV27,
} from "./motor-v27";
import { EMPTY_TASTE_SIGNAL } from "../lib/engine/taste-signal";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "../lib/vetoes";
import { siluetaPromptLine, type Build, type Volume } from "../lib/silueta";
import { ageStylingLine, type AgeRange } from "../lib/edad";
import { lifestyleSummary, type LifestyleAnswers } from "../lib/capsule";
import { styleReferenceForEngine } from "../lib/estilo-referencia";
import { ITEM_IMAGE_SELECT, conCategoria, type ItemImageRow } from "../lib/item-image";
import type { Season } from "../lib/colorimetria";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const CONC = Number((process.argv.find((a) => a.startsWith("--conc=")) ?? "--conc=3").split("=")[1]);
const EMAIL = "roberto@playrobix.com";

// Ocasión × clima: lo que de verdad cambia de un día a otro para una misma
// persona. Cargados hacia el DIARIO (5 de 12) porque es la promesa del producto
// y porque el barrido anterior resultó ser 100% evento de noche por accidente.
const CASOS = [
  { ocasion: "diario", momento: "dia", temp: 22, cond: "despejado" },
  { ocasion: "diario", momento: "dia", temp: 9, cond: "nublado" },
  { ocasion: "diario", momento: "dia", temp: 30, cond: "soleado" },
  { ocasion: "diario", momento: "dia", temp: 16, cond: "lluvia ligera" },
  { ocasion: "diario", momento: "noche", temp: 18, cond: "despejado" },
  { ocasion: "oficina", momento: "dia", temp: 22, cond: "despejado" },
  { ocasion: "oficina", momento: "dia", temp: 9, cond: "nublado" },
  { ocasion: "oficina", momento: "dia", temp: 28, cond: "soleado" },
  { ocasion: "evento", momento: "noche", temp: 18, cond: "despejado" },
  { ocasion: "evento", momento: "noche", temp: 9, cond: "nublado" },
  { ocasion: "viaje", momento: "dia", temp: 20, cond: "despejado" },
  { ocasion: "refrescar", momento: "dia", temp: 24, cond: "despejado" },
] as const;

type Outfit = { nombre: string; item_ids: string[]; explicacion: string };

/**
 * El motor de julio: system prompt y user message de v27, mismo modelo y mismo
 * schema que hoy.
 *
 * Se reimplementa la llamada en vez de reusar generateOutfits porque aquella usa
 * el prompt de HOY — llamarla sería el error que invalidó el A/B anterior.
 */
async function generarV27(ctx: EngineContextV27): Promise<Outfit[]> {
  const client = new Anthropic();
  const itemIds = ctx.items.map((i) => i.id);
  const res = await client.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 3072,
    // Igual que hoy: en los modelos 5 el thinking viene ON y cuesta ~50% de
    // latencia. Si un lado lo tuviera y el otro no, mediríamos eso.
    thinking: { type: "disabled" },
    system: SYSTEM_V27,
    messages: [{ role: "user", content: buildUserMessageV27(ctx) }],
    output_config: { format: { type: "json_schema", schema: buildOutfitSchema(itemIds) } },
  } as never);
  const text = (res as { content: { type: string; text?: string }[] }).content.find(
    (b) => b.type === "text"
  )?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as { outfits: Outfit[] };
  const valid = new Set(itemIds);
  const outs = (parsed.outfits ?? [])
    .filter(
      (o) =>
        o.nombre &&
        o.explicacion &&
        Array.isArray(o.item_ids) &&
        o.item_ids.length >= 2 &&
        o.item_ids.every((id) => valid.has(id))
    )
    .slice(0, 3);
  if (outs.length < 2) throw new Error("TOO_FEW_OUTFITS");
  return outs;
}

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await s.from("profiles").select("*").eq("email", EMAIL).single();
  if (!profile) throw new Error(`No encontré el perfil de ${EMAIL}`);
  const { data: rows } = await s
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
  // La categoría resuelta va a LOS DOS lados (ver cabecera).
  const { items } = applyVetoes(
    conCategoria((rows ?? []) as unknown as ItemImageRow[]) as unknown as EngineItem[],
    vetoes
  );
  const conCat = items.filter((i) => i.attrs.categoria).length;
  console.log(`Clóset: ${items.length} prendas · categoría resuelta en ${conCat}`);
  console.log(`Modelo: ${ENGINE_MODEL} en los dos lados\n`);

  const base = (caso: (typeof CASOS)[number]): EngineContext => ({
    gender: profile.gender as "hombre" | "mujer" | null,
    objective: caso.ocasion,
    plan: null,
    lifestyle: lifestyleSummary(profile.lifestyle as LifestyleAnswers | null),
    tasteTags: (profile.taste_tags ?? []) as string[],
    archetype:
      (profile.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
    season: profile.palette_season as Season | null,
    flow: profile.palette_flow as Season | null,
    items: orderClosetForEngine(items),
    weather: { temp_c: caso.temp, condition: caso.cond } as EngineContext["weather"],
    recentCombos: [],
    vetoes: vetoLabels(vetoes),
    timeOfDay: caso.momento,
    silueta: siluetaPromptLine(
      profile.body_build as Build | null,
      profile.body_volume as Volume | null
    ),
    fitPref: (profile.fit_pref as EngineContext["fitPref"]) ?? null,
    ageStyling: ageStylingLine(profile.age_range as AgeRange | null),
    tasteSignal: EMPTY_TASTE_SIGNAL,
    styleReference: styleReferenceForEngine(profile.style_reference),
    styleWords: (profile.style_words as string | null) ?? null,
  });

  const nombre = new Map(items.map((i) => [i.id, i.attrs.nombre ?? i.id]));
  const resultados: unknown[] = [];
  let hechos = 0;

  // Los dos lados comparten el MISMO ctx, orden barajado del clóset incluido.
  const tanda = CASOS.flatMap((caso) => {
    const ctx = base(caso);
    return [
      { caso, ctx, hoy: true },
      { caso, ctx, hoy: false },
    ];
  });

  const correr = async (t: (typeof tanda)[number]) => {
    // "con-marca"/"sin-marca" son las etiquetas que ya entienden ab-pares y
    // barrido-comparar; aquí significan hoy / julio.
    const brazo = t.hoy ? "con-marca" : "sin-marca";
    try {
      const outs = t.hoy
        ? await generateOutfits(t.ctx)
        : await generarV27(t.ctx as unknown as EngineContextV27);
      for (const o of outs) {
        resultados.push({
          caso: t.caso,
          brazo,
          look: o.nombre,
          explicacion: o.explicacion,
          item_ids: o.item_ids,
          prendas: o.item_ids.map((id) => nombre.get(id) ?? id),
        });
      }
    } catch (e) {
      resultados.push({ caso: t.caso, brazo, error: (e as Error).message });
    }
    console.log(
      `  ${++hechos}/${tanda.length}  ${t.caso.ocasion}/${t.caso.temp}°C [${t.hoy ? "HOY" : "julio"}]`
    );
  };

  for (let i = 0; i < tanda.length; i += CONC) {
    await Promise.all(tanda.slice(i, i + CONC).map(correr));
  }

  writeFileSync(
    "docs_para_claude/barrido/ab-julio-vs-hoy.json",
    JSON.stringify(resultados, null, 2)
  );
  console.log(`\n${resultados.length} looks → docs_para_claude/barrido/ab-julio-vs-hoy.json`);
}

main();
