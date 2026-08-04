// El A/B del recetario, pero con el CLÓSET REAL de Roberto.
//
// POR QUÉ ESTE Y NO EL SINTÉTICO
// Idea suya, y es mejor: "de esta manera comparamos manzanas con manzanas". Los
// clósets del barrido son sorteos del catálogo — sirven para medir tendencias,
// pero nadie puede juzgar de verdad un look armado con ropa que no conoce. Con
// su clóset de 127 prendas la pregunta deja de ser "¿está bien armado?" y pasa a
// ser la única que importa: "¿me pondría esto?".
//
// EL CONTEXTO SE ARMA COMO LO ARMA LA APP
// Mismo perfil, misma colorimetría, mismos vetos, mismo orden barajado del
// clóset (app/api/generate/route.ts). Si aquí se armara distinto, mediríamos un
// motor que nadie usa — que es el error clásico de este tipo de arnés y ya nos
// costó tres bugs esta semana.
//
// LO QUE VARÍA
// Su clóset es uno solo, así que los casos salen de cruzar ocasión × clima: es
// lo que de verdad cambia de un día a otro para una misma persona.
//
// Uso: npx tsx scripts/ab-roberto.ts [--concurrencia=3]
// Salida: docs_para_claude/barrido/ab-roberto.json

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generateOutfits } from "../lib/engine/generate";
import { orderClosetForEngine, type EngineContext, type EngineItem } from "../lib/engine/prompt";
import { EMPTY_TASTE_SIGNAL } from "../lib/engine/taste-signal";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "../lib/vetoes";
import { siluetaPromptLine, type Build, type Volume } from "../lib/silueta";
import { ageStylingLine, type AgeRange } from "../lib/edad";
import { lifestyleSummary, type LifestyleAnswers } from "../lib/capsule";
import { styleReferenceForEngine } from "../lib/estilo-referencia";
import type { Season } from "../lib/colorimetria";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const CONC = Number(
  (process.argv.find((a) => a.startsWith("--concurrencia=")) ?? "--concurrencia=3").split("=")[1]
);
// El perfil de PRUEBA, hecho con el onboarding actual (deck v4 + pares de
// corte). El real de Roberto tiene tags del 27 de julio y fit_pref en null, así
// que medir con él sería medir el motor alimentado con datos viejos. Su clóset
// (127 prendas) se clonó aquí — ver scripts/clonar-perfil-prueba.sql.
const EMAIL = "roberto@playrobix.com";

// Ocasión × clima: lo que de verdad cambia día con día para una misma persona.
//
// DOCE y no ocho: con ocho juicios humanos un 5-3 es exactamente lo que sale
// tirando una moneda. Doce empieza a distinguirse del azar sin volverse una
// tarea larga.
//
// PESAN HACIA EL DIARIO a propósito (5 de 12). Es la promesa del producto —"qué
// me pongo hoy"— y donde el motor falla la mitad que en evento de noche. El
// barrido anterior resultó ser 100% evento de noche por accidente, o sea que
// llevábamos horas optimizando el caso más raro y más difícil.
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

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await s
    .from("profiles")
    .select("*")
    .eq("email", EMAIL)
    .single();
  if (!profile) throw new Error(`No encontré el perfil de ${EMAIL}`);

  const { data: rows } = await s
    .from("items")
    .select("id, attrs")
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
  const { items } = applyVetoes((rows ?? []) as EngineItem[], vetoes);
  console.log(`Clóset de ${EMAIL}: ${items.length} prendas (tras vetos)\n`);

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

  const nombre = new Map(items.map((i) => [i.id, i.attrs.nombre ?? i.attrs.tipo ?? i.id]));
  const resultados: unknown[] = [];
  let hechos = 0;

  // Los dos brazos comparten el MISMO ctx (mismo orden de clóset incluido): si
  // el barajado difiriera entre brazos, parte de la diferencia sería el orden.
  const tanda = CASOS.flatMap((caso) => {
    const ctx = base(caso);
    return [
      { caso, ctx, conRecetario: true },
      { caso, ctx, conRecetario: false },
    ];
  });

  const correr = async (t: (typeof tanda)[number]) => {
    try {
      const outfits = await generateOutfits(t.ctx, { sinRecetario: !t.conRecetario });
      for (const o of outfits) {
        resultados.push({
          caso: t.caso,
          brazo: t.conRecetario ? "con-marca" : "sin-marca",
          look: o.nombre,
          explicacion: o.explicacion,
          item_ids: o.item_ids,
          prendas: o.item_ids.map((id) => nombre.get(id) ?? id),
        });
      }
    } catch (e) {
      resultados.push({
        caso: t.caso,
        brazo: t.conRecetario ? "con-marca" : "sin-marca",
        error: (e as Error).message,
      });
    }
    console.log(
      `  ${++hechos}/${tanda.length}  ${t.caso.ocasion}/${t.caso.temp}°C [${t.conRecetario ? "con" : "sin"} recetario]`
    );
  };

  for (let i = 0; i < tanda.length; i += CONC) {
    await Promise.all(tanda.slice(i, i + CONC).map(correr));
  }

  writeFileSync(
    "docs_para_claude/barrido/ab-roberto.json",
    JSON.stringify(resultados, null, 2)
  );
  console.log(`\n${resultados.length} looks → docs_para_claude/barrido/ab-roberto.json`);
}

main();
