// LA PRUEBA CHICA: ¿ayuda enseñarle al motor 3 fotos de looks que funcionan?
//
// LA PREGUNTA
// El recetario comprimió 616 fotos a texto (silueta, paleta, fórmulas) y el A/B
// ciego dijo que ese texto no mejora nada: 5 a 4 contra el motor de julio,
// indistinguible del azar. La hipótesis de Roberto: la foto no se comprime — el
// modelo ve la proporción, cómo cae la tela, cuántos colores conviven. Todo lo
// que las palabras tiran.
//
// POR QUÉ ESTA PRUEBA Y NO EL CATÁLOGO ENTERO
// La idea grande es etiquetar las 616 fotos pieza por pieza y armar con
// heurísticas. Eso son horas de visión más revisión a mano. Antes de gastar eso,
// la versión barata: pasarle las fotos TAL CUAL, sin desglosar nada. Si ni así
// mejora, estructurarlas no lo va a salvar. Si mejora, ya sabemos por qué vale
// la pena el talache.
//
// LOS DOS LADOS
//   A: el motor de julio (scripts/motor-v27.ts), que es la base ganadora
//   B: el mismo motor de julio + 3 fotos de su estilo y su clima
// Todo lo demás idéntico: perfil, clóset y su orden, clima, ocasión, Opus 5.
// El recetario NO entra en ninguno de los dos: ya se midió y no aportó.
//
// Uso: npx tsx scripts/ab-inspiracion.ts [--conc=3]
// Salida: docs_para_claude/barrido/ab-inspiracion.json

import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ENGINE_MODEL } from "../lib/models";
import { buildOutfitSchema } from "../lib/engine/schema";
import { orderClosetForEngine, type EngineItem } from "../lib/engine/prompt";
import {
  SYSTEM_PROMPT as SYSTEM_V27,
  buildUserMessage as buildUserMessageV27,
  type EngineContext as EngineContextV27,
} from "./motor-v27";
import { elegirInspiracion, INSTRUCCION_INSPIRACION } from "../lib/engine/inspiracion";
import { recetasParaTags, bandaDeClima } from "../lib/engine/recetario";
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
 * El motor de julio, con o sin las fotos de inspiración.
 *
 * Las fotos van como bloques de imagen ANTES del texto: el modelo las mira y
 * después lee el clóset, que es el orden en que las usaría una persona.
 */
async function generar(
  ctx: EngineContextV27,
  fotos: { b64: string; mime: string }[]
): Promise<Outfit[]> {
  const client = new Anthropic();
  const itemIds = ctx.items.map((i) => i.id);
  const contenido: unknown[] = [];
  if (fotos.length) {
    contenido.push({ type: "text", text: INSTRUCCION_INSPIRACION });
    for (const f of fotos) {
      contenido.push({
        type: "image",
        source: { type: "base64", media_type: f.mime, data: f.b64 },
      });
    }
  }
  contenido.push({ type: "text", text: buildUserMessageV27(ctx) });

  const res = await client.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 3072,
    thinking: { type: "disabled" },
    system: SYSTEM_V27,
    messages: [{ role: "user", content: contenido }],
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

// mulberry32: la elección de fotos es al azar pero REPRODUCIBLE — sin semilla,
// re-correr el A/B daría otras fotos y no sabríamos si cambió el resultado o la
// muestra.
function rng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  const { items } = applyVetoes(
    conCategoria((rows ?? []) as unknown as ItemImageRow[]) as unknown as EngineItem[],
    vetoes
  );

  const tags = (profile.taste_tags ?? []) as string[];
  const genero = profile.gender as "hombre" | "mujer" | null;
  // Las MISMAS familias que usaría el recetario: el puente deck → tags → familia
  // ya existe y está probado; aquí solo se reusa para filtrar fotos.
  const familias = recetasParaTags(tags, genero ?? "hombre").map((r) => r.familia);
  console.log(`Clóset: ${items.length} prendas · familias: ${familias.join(", ") || "—"}`);
  console.log(`Modelo: ${ENGINE_MODEL} en los dos lados\n`);

  const nombre = new Map(items.map((i) => [i.id, i.attrs.nombre ?? i.id]));
  const resultados: unknown[] = [];
  let hechos = 0;

  const ctxDe = (caso: (typeof CASOS)[number]) =>
    ({
      gender: genero,
      objective: caso.ocasion,
      plan: null,
      lifestyle: lifestyleSummary(profile.lifestyle as LifestyleAnswers | null),
      tasteTags: tags,
      archetype: profile.style_archetype,
      season: profile.palette_season as Season | null,
      flow: profile.palette_flow as Season | null,
      items: orderClosetForEngine(items),
      weather: { temp_c: caso.temp, condition: caso.cond },
      recentCombos: [],
      vetoes: vetoLabels(vetoes),
      timeOfDay: caso.momento,
      silueta: siluetaPromptLine(
        profile.body_build as Build | null,
        profile.body_volume as Volume | null
      ),
      ageStyling: ageStylingLine(profile.age_range as AgeRange | null),
      tasteSignal: EMPTY_TASTE_SIGNAL,
      styleReference: styleReferenceForEngine(profile.style_reference),
      styleWords: (profile.style_words as string | null) ?? null,
    }) as unknown as EngineContextV27;

  // Las fotos se eligen UNA vez por caso y se guardan: el lado con inspiración
  // las usa, y quedan registradas para poder mirar después qué se le enseñó.
  const tanda: {
    caso: (typeof CASOS)[number];
    ctx: EngineContextV27;
    fotos: { b64: string; mime: string }[];
    paths: string[];
    conInspo: boolean;
  }[] = [];

  // Las fotas ya usadas, para no repetir referencia entre casos: en la primera
  // corrida salieron 20 fotos distintas para 36 espacios (una 4 veces).
  const usadas = new Set<string>();
  for (let i = 0; i < CASOS.length; i++) {
    const caso = CASOS[i];
    const ctx = ctxDe(caso);
    const refs = await elegirInspiracion(s, {
      familias,
      genero,
      clima: bandaDeClima({ temp_c: caso.temp, condition: caso.cond } as never),
      season: (profile.palette_season as string | null) ?? null,
      fitPref: (profile.fit_pref as "recta" | "holgada" | "mixta" | null) ?? null,
      ocasion: caso.ocasion,
      evitar: usadas,
      rand: rng(20260804 + i * 31),
    });
    refs.forEach((r) => usadas.add(r.path));
    const fotos: { b64: string; mime: string }[] = [];
    for (const r of refs) {
      const { data } = await s.storage.from("referencias").download(r.path);
      if (!data) continue;
      fotos.push({
        b64: Buffer.from(await data.arrayBuffer()).toString("base64"),
        mime: r.path.endsWith(".png") ? "image/png" : "image/jpeg",
      });
    }
    const paths = refs.map((r) => r.path);
    tanda.push({ caso, ctx, fotos, paths, conInspo: true });
    tanda.push({ caso, ctx, fotos: [], paths: [], conInspo: false });
  }

  const conFotos = tanda.filter((t) => t.conInspo && t.fotos.length).length;
  console.log(`${conFotos}/${CASOS.length} casos con fotos de inspiración\n`);

  const correr = async (t: (typeof tanda)[number]) => {
    const brazo = t.conInspo ? "con-marca" : "sin-marca"; // etiquetas que ya entiende ab-pares
    try {
      const outs = await generar(t.ctx, t.fotos);
      for (const o of outs) {
        resultados.push({
          caso: t.caso,
          brazo,
          inspiracion: t.paths,
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
      `  ${++hechos}/${tanda.length}  ${t.caso.ocasion}/${t.caso.temp}°C [${t.conInspo ? `+${t.fotos.length} fotos` : "solo julio"}]`
    );
  };

  for (let i = 0; i < tanda.length; i += CONC) {
    await Promise.all(tanda.slice(i, i + CONC).map(correr));
  }

  writeFileSync(
    "docs_para_claude/barrido/ab-inspiracion.json",
    JSON.stringify(resultados, null, 2)
  );
  console.log(`\n${resultados.length} looks → docs_para_claude/barrido/ab-inspiracion.json`);
}

main();
