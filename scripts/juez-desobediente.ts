// ¿EL JUEZ OBEDECE SU PROPIA LISTA DE PROHIBICIONES?
//
// Uso:  npx tsx scripts/juez-desobediente.ts            # la corrida completa
//       npx tsx scripts/juez-desobediente.ts --limite=50
//
// DE DÓNDE SALE ESTA PREGUNTA. js8 (2026-09-18) arregló "plano" en código
// porque el examen de los 460 looks votados mostró que el juez lo marcaba 36
// veces en los 👍 de Roberto — AUNQUE el prompt se lo prohibía desde js5. La
// lección no era sobre "plano": era que una instrucción escrita puede llevar
// meses siendo ignorada sin que nadie se entere.
//
// Y el prompt tiene una LISTA ENTERA de prohibiciones ("Y esto NO es hallazgo
// — si lo marcas, es ruido"): cinturón negro con mocasines burdeos, reloj de
// caucho en oficina, corbata de punto en boda, tenis con abrigo de lana. Si
// desobedeció una, la pregunta obvia es cuántas más.
//
// LA LISTA SE LEE DEL PROMPT, no se copia. Si alguien agrega o quita una
// prohibición, este análisis la recoge sola — una copia se desincronizaría y
// entonces mediría obediencia a una lista que ya no existe.
//
// POR QUÉ CON JEV Y NO CON GREP. Hay que leer ~cientos de hallazgos escritos en
// prosa libre y decir cuál contradice cuál regla. Buscar por palabras sueltas
// ("burdeos", "caucho") se pierde todo lo dicho con otras palabras. Es la tarea
// que Jev ya aprobó midiéndose: 18 de 22 comentarios de Roberto clasificados
// bien, y 16 de 16 cuando dijo estar seguro.
//
// EL CONTROL DE VALIDEZ, que hace que el resultado se pueda creer: "plano" está
// en la lista y YA SABEMOS que lo desobedecía. Si este análisis no lo enciende,
// el método no sirve y el resto de sus números tampoco — antes de leer nada
// más, hay que mirar esa línea.
//
// LA REGLA DE CONTEO, escrita antes de correr: sólo cuenta como desobediencia
// lo que Jev marque con confianza ≥ 0.70. Es el corte donde su calibración se
// midió limpia (16/16 acertados arriba, 2/6 abajo). Lo dudoso se reporta
// aparte, nunca sumado.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SYSTEM_JUEZ_STYLIST, type CriticaStylist } from "../lib/engine/juez-stylist";
import { preguntarJev, type PreguntaChoice } from "../lib/jev";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const CORTE_DE_CONFIANZA = 0.7;
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

/**
 * Las prohibiciones, leídas del prompt vigente.
 *
 * Toma los renglones de viñeta que siguen al encabezado de la sección y se
 * detiene en el primero que no lo es. Si el encabezado cambiara de texto, esto
 * devuelve vacío y el script se para — que es lo correcto: mejor no correr que
 * medir contra una lista equivocada.
 */
export function prohibicionesDelPrompt(prompt: string): string[] {
  const i = prompt.indexOf("Y esto NO es hallazgo");
  if (i < 0) return [];
  const reglas: string[] = [];
  for (const linea of prompt.slice(i).split("\n").slice(1)) {
    if (!linea.startsWith("- ")) break;
    reglas.push(linea.slice(2).trim());
  }
  return reglas;
}

type Hallazgo = { pieza: string; problema: string; arreglo: string; defecto: string; gravedad: string };

async function main() {
  const reglas = prohibicionesDelPrompt(SYSTEM_JUEZ_STYLIST);
  if (!reglas.length) {
    console.error("No encontré la sección de prohibiciones en el prompt. Se paró antes de medir contra una lista equivocada.");
    process.exit(1);
  }
  console.log(`LISTA DE PROHIBICIONES leída del prompt vigente · ${reglas.length} reglas`);
  reglas.forEach((r, i) => console.log(`  r${i + 1}. ${r.slice(0, 100)}`));

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: lados } = await s.from("comparador_motor_lados").select("criticas");
  const hallazgos: Hallazgo[] = [];
  for (const l of lados ?? [])
    for (const c of ((l.criticas as CriticaStylist[] | null) ?? []))
      for (const h of c?.hallazgos ?? []) if (h?.problema) hallazgos.push(h as Hallazgo);

  const limite = Number(arg("limite") ?? 0);
  const lote = limite > 0 ? hallazgos.slice(0, limite) : hallazgos;
  if (!lote.length) {
    console.error("No hay hallazgos guardados que analizar. Sin datos no hay análisis.");
    process.exit(1);
  }
  console.log(`\n${hallazgos.length} hallazgos guardados por el juez${limite ? ` · midiendo ${lote.length}` : ""}`);

  const pregunta: PreguntaChoice = {
    type: "choice",
    instructions:
      "Un juez de moda marcó un defecto en un outfit. Su manual le PROHÍBE marcar ciertas cosas. ¿Este defecto es una de las prohibidas? Elige 'ninguna' si el defecto no corresponde a ninguna regla de la lista.",
    criteria: {
      ninguna: "El defecto marcado no corresponde a ninguna de las prohibiciones de la lista.",
      ...Object.fromEntries(reglas.map((r, i) => [`r${i + 1}`, r])),
    },
  };

  let costo = 0, ms = 0, fallos = 0, hechos = 0;
  const marcados: { h: Hallazgo; regla: string; conf: number }[] = [];
  const cola = [...lote];
  const obrero = async () => {
    for (;;) {
      const h = cola.shift();
      if (!h) return;
      try {
        const estado = `Defecto marcado: ${h.defecto} (gravedad: ${h.gravedad}).\nPieza: ${h.pieza}.\nProblema: ${h.problema}\nArreglo propuesto: ${h.arreglo}`;
        const r = await preguntarJev(estado, { regla: pregunta });
        const a = r.respuestas.regla;
        costo += r.recibo.costoUsd ?? 0;
        ms += r.recibo.ms;
        if (a?.type === "choice" && a.choice !== "ninguna")
          marcados.push({ h, regla: a.choice, conf: a.confidence });
      } catch (e) {
        fallos++;
        if (fallos <= 3) console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
      }
      if (++hechos % 100 === 0) console.log(`  ${hechos}/${lote.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, obrero));
  console.log(`  listo · costo $${costo.toFixed(4)} · ${Math.round(ms / Math.max(hechos, 1))}ms por hallazgo · fallos ${fallos}`);

  const seguros = marcados.filter((m) => m.conf >= CORTE_DE_CONFIANZA);
  const dudosos = marcados.filter((m) => m.conf < CORTE_DE_CONFIANZA);

  console.log(`\nDESOBEDIENCIAS (confianza ≥ ${CORTE_DE_CONFIANZA}) · ${seguros.length} de ${lote.length} hallazgos (${Math.round((seguros.length * 100) / lote.length)}%)`);
  const porRegla: Record<string, { h: Hallazgo; conf: number }[]> = {};
  for (const m of seguros) (porRegla[m.regla] ??= []).push({ h: m.h, conf: m.conf });
  for (const [k, v] of Object.entries(porRegla).sort((a, b) => b[1].length - a[1].length)) {
    const i = Number(k.slice(1)) - 1;
    console.log(`\n  ${k} · ${v.length} veces — ${reglas[i]?.slice(0, 110)}`);
    for (const x of v.slice(0, 4))
      console.log(`      [${x.h.defecto}/${x.h.gravedad}] ${x.h.pieza}: ${x.h.problema.slice(0, 110)}`);
    if (v.length > 4) console.log(`      … y ${v.length - 4} más`);
  }

  console.log(`\nDUDOSOS (< ${CORTE_DE_CONFIANZA}, NO contados): ${dudosos.length}`);

  // EL CONTROL. "plano" es la prohibición que js8 ya demostró que se
  // desobedecía. Si no aparece, el método no está viendo lo que debería.
  const iPlano = reglas.findIndex((r) => r.includes("plano"));
  if (iPlano >= 0) {
    const n = (porRegla[`r${iPlano + 1}`] ?? []).length;
    console.log(
      `\nCONTROL · "plano" (r${iPlano + 1}) es la desobediencia que YA conocíamos: ${n} detectadas.` +
        (n > 0 ? " El método ve lo que debe ver." : " ⚠ NO la detectó: no te creas el resto de esta corrida.")
    );
  }
}

main();
