// ¿EL JUEZ REPARA LO QUE LAS REGLAS ENCUENTRAN? — medido en producción, sin arnés.
//
// Uso:  npx tsx scripts/reglas-en-produccion.ts [prompt_version ...]
//       npx tsx scripts/reglas-en-produccion.ts            # todas las versiones
//       npx tsx scripts/reglas-en-produccion.ts v53         # sólo v53
//
// POR QUÉ EXISTE, y por qué NO es un arnés (2026-08-18)
// La regla de coherencia cromática (v53) se shipeó sin poder validarla: el
// comparador arma looks con generación NO determinista, así que la diferencia
// entre "con regla" y "sin regla" queda ahogada por el ruido de dos corridas
// distintas. Roberto lo dijo antes de que yo lo viera: "al usar o meter arneses,
// terminaban fallando otras cosas al no dejar que replique de una manera más
// realista la generación". Fijar los looks para aislar la reparación habría sido
// exactamente eso.
//
// La salida es medir donde la realidad ya pasa: LOOKS REALES, generación real,
// cero arnés. Y no hace falta instrumentar nada nuevo — el dato ya se escribe.
//
// DE DÓNDE SALE EL "ANTES" Y EL "DESPUÉS"
// El evento `critic_review` guarda, por look, `before` y `after`: los ids de las
// prendas ANTES y DESPUÉS de la reparación del juez. Correr `revisarEjecucion`
// sobre los dos contesta las tres preguntas que importan de cualquier regla:
//
//   1. ¿Dispara en looks reales, y cuánto? (antes)
//   2. ¿El juez la repara? (desapareció en el después)
//   3. ¿La reparación ROMPE otra cosa? (violaciones nuevas en el después)
//
// La 3 no es teórica: ya se midió una vez que el juez introdujo cinco
// violaciones nuevas al arreglar otra cosa, y nadie estaba mirando el resultado
// del reparador.
//
// LO QUE ESTE SCRIPT NO PUEDE, y hay que decirlo
// El clóset que usa para el contexto es el de HOY, no el que la persona tenía el
// día que se generó el look. Importa sólo para las reglas que distinguen fallo
// de carencia (frío-sin-abrigo, zona-sin-cubrir, separates-en-evento-formal):
// una prenda dada de alta después puede volver "fallo" algo que entonces era
// carencia. Con clósets que casi sólo crecen, el sesgo es hacia marcar de más.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { revisarEjecucion } from "../lib/engine/reglas-ejecucion";
import { bandaDeClima } from "../lib/engine/recetario";
import { conCategoria, ITEM_IMAGE_SELECT, type ItemImageRow } from "../lib/item-image";
import type { EngineItem } from "../lib/engine/prompt";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const VERSIONES = process.argv.slice(2);

type Cambio = { before?: string[]; after?: string[]; verdict?: string };
type DatoCritico = {
  gender?: string | null;
  prompt_version?: string;
  changes?: Cambio[];
};

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: eventos } = await s
    .from("events")
    .select("user_id, created_at, data")
    .eq("type", "critic_review")
    .order("created_at", { ascending: false });

  const relevantes = (eventos ?? []).filter((e) => {
    const d = e.data as DatoCritico;
    return !VERSIONES.length || VERSIONES.includes(d.prompt_version ?? "");
  });

  if (!relevantes.length) {
    const vistas = [
      ...new Set((eventos ?? []).map((e) => (e.data as DatoCritico).prompt_version)),
    ].filter(Boolean);
    console.log(
      `Sin eventos del juez${VERSIONES.length ? ` para ${VERSIONES.join(", ")}` : ""}.`
    );
    if (vistas.length) console.log(`Versiones que sí hay: ${vistas.join(", ")}`);
    console.log(
      `\nSi buscabas v53 (la regla de color): la regla se shipeó el 2026-08-18 y\n` +
        `dispara en ~9% de los looks, así que hacen falta ~100 looks generados para\n` +
        `decir algo. Vuelve a correr esto cuando haya volumen.`
    );
    return;
  }

  // El clóset y el perfil de cada dueño, una vez.
  const closets = new Map<string, EngineItem[]>();
  const generos = new Map<string, string | null>();
  for (const dueno of new Set(relevantes.map((e) => e.user_id as string))) {
    const [{ data: items }, { data: perfil }] = await Promise.all([
      s.from("items").select(`id, ${ITEM_IMAGE_SELECT}`).eq("user_id", dueno).is("deleted_at", null),
      s.from("profiles").select("gender").eq("id", dueno).single(),
    ]);
    closets.set(
      dueno,
      conCategoria((items ?? []) as unknown as ItemImageRow[]) as unknown as EngineItem[]
    );
    generos.set(dueno, (perfil?.gender as string | null) ?? null);
  }

  // El contexto real de cada look, casado por sus prendas finales: el outfit
  // guardado trae la ocasión y el clima con los que se generó, y sin eso las
  // reglas que dependen de formalidad u ocasión no dispararían igual.
  const { data: outfits } = await s
    .from("outfits")
    .select("user_id, item_ids, occasion, weather")
    .is("deleted_at", null);
  const clave = (ids: string[]) => [...ids].sort().join("|");
  const ctxPorLook = new Map<string, { occasion: string | null; weather: unknown }>();
  for (const o of outfits ?? []) {
    ctxPorLook.set(clave((o.item_ids as string[]) ?? []), {
      occasion: (o.occasion as string | null) ?? null,
      weather: o.weather,
    });
  }

  type Conteo = { antes: number; sobrevive: number; nueva: number };
  const porRegla = new Map<string, Conteo>();
  const suma = (regla: string, campo: keyof Conteo) => {
    const c = porRegla.get(regla) ?? { antes: 0, sobrevive: 0, nueva: 0 };
    c[campo]++;
    porRegla.set(regla, c);
  };

  let looks = 0;
  let sinPrendas = 0;
  for (const ev of relevantes) {
    const d = ev.data as DatoCritico;
    const closet = closets.get(ev.user_id as string) ?? [];
    const porId = new Map(closet.map((i) => [i.id, i]));
    for (const c of d.changes ?? []) {
      const before = (c.before ?? []).map((id) => porId.get(id)).filter(Boolean) as EngineItem[];
      const after = (c.after ?? []).map((id) => porId.get(id)).filter(Boolean) as EngineItem[];
      // Un look cuyas prendas ya se borraron no se puede juzgar: sus ids no
      // resuelven y las reglas verían un look a medias.
      if (before.length !== (c.before ?? []).length || !after.length) {
        sinPrendas++;
        continue;
      }
      looks++;
      const ctxLook = ctxPorLook.get(clave(c.after ?? []));
      const ctx = {
        closet,
        gender: generos.get(ev.user_id as string) ?? d.gender ?? null,
        objective: ctxLook?.occasion ?? null,
        clima: bandaDeClima(ctxLook?.weather as never),
      };
      const antes = new Set(revisarEjecucion(before, ctx).map((v) => v.regla));
      const despues = new Set(revisarEjecucion(after, ctx).map((v) => v.regla));
      for (const r of antes) {
        suma(r, "antes");
        if (despues.has(r)) suma(r, "sobrevive");
      }
      // Lo que el reparador INTRODUJO: no estaba antes y sí después.
      for (const r of despues) if (!antes.has(r)) suma(r, "nueva");
    }
  }

  console.log(
    `${looks} looks reales con antes/después del juez${VERSIONES.length ? ` (${VERSIONES.join(", ")})` : ""}` +
      `${sinPrendas ? ` · ${sinPrendas} saltados (prendas borradas)` : ""}\n`
  );
  if (!looks) return;

  const filas = [...porRegla.entries()].sort((a, b) => b[1].antes - a[1].antes);
  console.log(`  ${"regla".padEnd(30)} disparó   sobrevivió   la metió el juez`);
  for (const [regla, c] of filas) {
    const pctRep = c.antes ? `${Math.round((100 * (c.antes - c.sobrevive)) / c.antes)}% rep.` : "";
    console.log(
      `  ${regla.padEnd(30)} ${String(c.antes).padStart(6)} ${String(c.sobrevive).padStart(12)}   ${String(c.nueva).padStart(6)}   ${pctRep}`
    );
  }
  console.log(
    `\nCÓMO LEERLO:\n` +
      `  · "disparó" es cuántos looks reales la rompieron ANTES del juez.\n` +
      `  · "sobrevivió" es cuántas siguieron rotas DESPUÉS de repararlo. Una regla\n` +
      `    que dispara mucho y sobrevive siempre no está sirviendo de nada: el juez\n` +
      `    no la puede arreglar con ese clóset, y eso es carencia, no fallo.\n` +
      `  · "la metió el juez" es la columna incómoda: violaciones que NO existían y\n` +
      `    aparecieron al reparar otra cosa. Ya pasó una vez con cinco.`
  );
}

main();
