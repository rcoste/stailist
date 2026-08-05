// A/B CIEGO del blueprint: ¿armar sobre una estructura real mejora el look?
//
// LOS DOS LADOS — y esta vez lo único distinto es la estructura:
//   A: el motor de HOY, tal cual está en producción, sin blueprint
//   B: el mismo motor + UNA estructura de referencia ya emparejada
// Mismo perfil, mismo clóset y su orden, mismo clima, misma ocasión, Opus 5 en
// los dos. Comparar contra julio mediría dos cambios a la vez.
//
// POR QUÉ 20 PARES Y SIN OPCIÓN "IGUAL"
// El A/B anterior (12 pares) tuvo 5 empates, y con 7 decididos hacía falta un
// 7-0 para llegar a p<0.05. O sea: la prueba no podía pasar aunque el cambio
// fuera bueno. El instrumento, no la hipótesis. Con 20 decididos el listón baja
// a 15-5 (p=0.041), que sí es alcanzable por algo que de verdad funcione.
//
// LA REGLA, PRE-REGISTRADA ANTES DE CORRER:
//   gana el blueprint con 15-5 o mejor  → se queda encendido
//   cualquier cosa por debajo           → se apaga y se queda apagado
// Escrita aquí para que no se pueda reinterpretar después de ver el resultado.
// Es la tercera vez que se pre-registra en este proyecto y las dos anteriores
// se honraron (el recetario se revirtió).
//
// UNA ESTRUCTURA DISTINTA POR CASO, a propósito. En producción el blueprint va
// sembrado por día (generador y juez tienen que ver el mismo), pero eso le daría
// al A/B la MISMA estructura 20 veces y mediría una sola. Aquí se inyecta una
// distinta en cada caso: se prueba la idea, no un blueprint con suerte.
//
// SOLO diario/templado: es la única celda con blueprints, y es donde vive el
// 70% del uso real (97 de 138 outfits generados son de diario; oficina son 6).
//
// Uso: npx tsx scripts/ab-blueprint.ts [--conc=3]
// Salida: docs_para_claude/barrido/ab-blueprint.json

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generateOutfits } from "../lib/engine/generate";
import {
  orderClosetForEngine,
  type EngineContext,
  type EngineItem,
} from "../lib/engine/prompt";
import { elegirBlueprint } from "../lib/engine/blueprint";
import { recetasParaTags } from "../lib/engine/recetario";
import { EMPTY_TASTE_SIGNAL } from "../lib/engine/taste-signal";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "../lib/vetoes";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const CONC = Number(
  (process.argv.find((a) => a.startsWith("--conc=")) ?? "--conc=3").split("=")[1]
);
const EMAIL = "roberto@playrobix.com";

// 20 días de diario en banda templada (16-25°C). La variación real entre casos
// no es la temperatura —dentro de la banda el motor ve lo mismo— sino la
// estructura que le toca a cada uno. La temperatura y el momento varían para
// que los looks no salgan idénticos por construcción.
const CASOS = Array.from({ length: Number((process.argv.find((a) => a.startsWith("--casos=")) ?? "--casos=20").split("=")[1]) }, (_, i) => ({
  n: i + 1,
  ocasion: "diario",
  temp: 16 + (i % 10),
  momento: i % 5 === 4 ? "noche" : "dia",
  cond: ["despejado", "nublado", "soleado"][i % 3],
}));

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
  if (!profile) throw new Error(`No encontré ${EMAIL}`);

  const { data: crudas } = await s
    .from("items")
    .select("id, attrs")
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
  // SIN barajar aquí: el barajado va DENTRO de ctxDe, una vez por generación.
  // Barajarlo una sola vez y reusar el orden en las 40 llamadas es exactamente
  // lo que orderClosetForEngine existe para evitar —los modelos sobre-eligen lo
  // de arriba de la lista— y hace que salgan SIEMPRE las mismas prendas.
  // Producción lo llama por generación (generate/route.ts, look-of-day/route.ts);
  // este arnés no, y por eso Roberto vio los mismos dos looks una y otra vez.
  const items = applyVetoes((crudas ?? []) as never, vetoes).items as never as EngineItem[];
  const tags = (profile.taste_tags as string[]) ?? [];
  const familias = recetasParaTags(tags, profile.gender).map((r) => r.familia);

  const ctxDe = (caso: (typeof CASOS)[number]) =>
    ({
      gender: profile.gender,
      objective: caso.ocasion,
      plan: null,
      lifestyle: null,
      tasteTags: tags,
      archetype: profile.style_archetype,
      season: profile.palette_season,
      flow: profile.palette_flow,
      items: orderClosetForEngine(items),
      weather: { temp_c: caso.temp, condition: caso.cond },
      recentCombos: [],
      vetoes: vetoLabels(vetoes),
      timeOfDay: caso.momento,
      silueta: null,
      fitPref: profile.fit_pref,
      tasteSignal: EMPTY_TASTE_SIGNAL,
      styleWords: (profile.style_words as string | null) ?? null,
    }) as unknown as EngineContext;

  // Una estructura DISTINTA por caso: se van marcando como usadas para que no
  // se repitan. Si se agotan las armables, elegirBlueprint reinicia la rotación.
  const usados = new Set<string>();
  const conBp = CASOS.map((caso) => {
    const bp = elegirBlueprint({
      ocasion: caso.ocasion,
      clima: "templado",
      items,
      familias,
      evitar: usados,
      rand: Math.random,
    });
    if (bp) usados.add(bp.bp.path);
    return { caso, bp };
  });
  const conEstructura = conBp.filter((x) => x.bp).length;
  console.log(
    `${conEstructura}/${CASOS.length} casos con estructura · ${usados.size} estructuras distintas\n`
  );

  const resultados: unknown[] = [];
  const tanda = conBp.flatMap(({ caso, bp }) => [
    { caso, bp, conBlueprint: true },
    { caso, bp: null, conBlueprint: false },
  ]);

  // Barajado para que las dos ramas de un caso no salgan seguidas: si el modelo
  // tuviera cualquier deriva temporal, se repartiría entre los dos brazos.
  tanda.sort(() => Math.random() - 0.5);

  let hechos = 0;
  const correr = async (t: (typeof tanda)[number]) => {
    const etiqueta = `${t.caso.ocasion}/${t.caso.temp}°${t.conBlueprint ? " [estructura]" : " [sin]"}`;
    try {
      const outs = await generateOutfits(
        ctxDe(t.caso),
        t.conBlueprint ? { blueprint: t.bp } : { sinBlueprint: true }
      );
      resultados.push({
        caso: t.caso,
        // Etiquetas que ab-pares.ts ya entiende.
        brazo: t.conBlueprint ? "con-marca" : "sin-marca",
        estructura: t.bp?.bp.path ?? null,
        nucleo: t.bp?.bp.nucleo.map((x) => x.tipo) ?? null,
        clave: t.bp?.bp.clave ?? null,
        looks: outs.map((o) => ({
          look: o.nombre,
          explicacion: o.explicacion,
          item_ids: o.item_ids,
          prendas: o.item_ids.map(
            (id) =>
              (items.find((i) => i.id === id)?.attrs.nombre as string) ?? id
          ),
        })),
      });
      console.log(`  ${String(++hechos).padStart(2)}/${tanda.length}  ${etiqueta}`);
    } catch (e) {
      console.error(`  ✗ ${etiqueta}: ${(e as Error).message.slice(0, 60)}`);
      resultados.push({
        caso: t.caso,
        brazo: t.conBlueprint ? "con-marca" : "sin-marca",
        error: (e as Error).message,
      });
    }
  };

  for (let i = 0; i < tanda.length; i += CONC) {
    await Promise.all(tanda.slice(i, i + CONC).map(correr));
  }

  writeFileSync(
    (process.argv.find((a) => a.startsWith("--salida=")) ?? "--salida=docs_para_claude/barrido/ab-blueprint.json").split("=")[1],
    JSON.stringify(resultados, null, 1)
  );
  console.log(
    `\n${resultados.length} generaciones → docs_para_claude/barrido/ab-blueprint.json`
  );
}

main();
