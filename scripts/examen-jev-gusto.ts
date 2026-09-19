// LA TERCERA PRUEBA DE JEV: ¿sus DESCRIPCIONES de un look predicen el voto de
// Roberto mejor que lo que ya se puede calcular por código?
//
// Uso:
//   npx tsx scripts/examen-jev-gusto.ts --volcar=/ruta/gusto.json   # paga Jev (~$0.05) y vuelca
//   python3 scripts/examen-jev-gusto.py /ruta/gusto.json            # el análisis, gratis y repetible
//
// DE DÓNDE SALE. La idea es de afuera ("Taste DNA"): que Jev no JUZGUE el look
// —eso ya se midió y perdió, scripts/examen-jev.ts— sino que lo DESCRIBA en
// rasgos (de sastre, deportivo, tonal, con textura…) y que un modelo
// estadístico aparte aprenda de los 👍/👎 qué rasgos le gustan a la persona.
// Describir está más cerca de ENTENDER TEXTO, que es lo único en lo que Jev sí
// dio resultado aquí (scripts/examen-jev-comentarios.ts: 82% contra 45%, y
// 16/16 cuando dijo estar seguro). Es una hipótesis distinta a la refutada.
//
// EL CONTROL QUE DECIDE TODO. Muchos de esos rasgos se calculan por código
// desde los atributos de la prenda: "lleva sastre" es una regex, "contraste" es
// aritmética sobre el hex medido. Si los rasgos por código predicen igual, Jev
// sobra y el aprendizaje de gusto se hace sin proveedor nuevo. Por eso el
// análisis corre cuatro brazos con el MISMO modelo y los MISMOS pliegues:
//     A0 contexto solo · A1 contexto+código · A2 contexto+Jev · A3 los tres
//
// LA REGLA, ESCRITA ANTES DE CORRER (2026-09-18):
//   1. La idea está viva sólo si el mejor brazo llega a AUC ≥ 0.65. Debajo de
//      eso ningún juego de rasgos predice su voto y no hay nada que comparar.
//   2. Jev pasa sólo si A3 supera a A1 por ≥ 0.03 de AUC y esa diferencia,
//      pareada por repetición, es mayor que 2 desviaciones estándar.
//   3. Empatar no es pasar: a igualdad, gana el código (gratis, 0 ms, sin
//      proveedor).
//
// LAS DOS TRAMPAS QUE EL DISEÑO EVITA, las dos aprendidas hoy mismo:
//   · FUGA. Los pares espejo repiten el mismo look dentro de una ronda; con
//     pliegues al azar el modelo "predeciría" un look que ya vio. La validación
//     deja RONDAS ENTERAS fuera (28 rondas).
//   · VARIANZA. Con 88 👎 un solo reparto de pliegues puede mentir ±0.05. Se
//     repite con 30 repartos y se reporta media y desviación.
//
// LO QUE ESTO NO PUEDE CONTESTAR aunque salga bien: sólo Roberto tiene votos
// suficientes. Un resultado positivo dice "funciona con 460 votos de una
// persona", no "funciona para una usuaria con ocho".
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarCasosVotados } from "../lib/evales/casos-votados";
import { preguntarJev, type PreguntaJev } from "../lib/jev";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

/**
 * LOS RASGOS. Todos DESCRIPTIVOS a propósito: ninguno pregunta si el look está
 * bien. En cuanto una pregunta pide un juicio ("¿se ve pulido?") vuelve a ser
 * el examen que Jev ya perdió, con otro nombre.
 */
const RASGOS: Record<string, string> = {
  sastre: "¿El look está construido sobre piezas de sastrería (saco, blazer, traje, pantalón de vestir)?",
  deportivo: "¿El look tiene un aire deportivo o atlético (tenis deportivos, prendas técnicas, sudadera, jogger)?",
  contraste: "¿Hay un contraste fuerte de claro contra oscuro entre las prendas principales?",
  paleta_neutra: "¿Toda la paleta es de neutros (negro, gris, marino, blanco, beige, café)?",
  color_protagonista: "¿Hay una prenda de color saturado o llamativo que sea la protagonista?",
  tonal: "¿El look es tonal o monocromático, con casi todo en la misma familia de color?",
  textura: "¿Hay una prenda de textura marcada (punto grueso, pana, ante, lana, mezclilla, lino)?",
  minimalista: "¿El look es minimalista: pocas piezas, lisas, sin adornos?",
  rudo: "¿Tiene un aire rudo o de trabajo (botas, mezclilla, chamarra de piel, overshirt, franela)?",
  preppy: "¿Tiene un aire preppy o clásico universitario (oxford, polo, chinos, mocasín, suéter de punto)?",
  formal: "¿El look es formal (traje, corbata, zapato de vestir)?",
  accesorios: "¿Lleva accesorios visibles más allá del cinturón (reloj, corbata, bufanda, gorra, lentes)?",
  relajado: "¿Las siluetas son relajadas u holgadas en vez de entalladas?",
  oscuro: "¿El look es predominantemente oscuro?",
};

type Attrs = Record<string, unknown>;

async function main() {
  const volcar = process.argv.find((a) => a.startsWith("--volcar="))?.slice(9);
  if (!volcar) {
    console.error("Falta --volcar=<ruta>: sin volcado la corrida se paga y se pierde.");
    process.exit(1);
  }
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { casos, corridas } = await cargarCasosVotados(s);
  const dueno = corridas[0]?.closet_user_id;
  const { data: items } = await s.from("items").select("id, attrs").eq("user_id", dueno);
  const attrsDe = new Map<string, Attrs>((items ?? []).map((i) => [i.id as string, (i.attrs ?? {}) as Attrs]));

  // El estado lleva los ATRIBUTOS, no sólo el nombre: es la desventaja que el
  // primer examen cargó ("Camisa azul rey" sin corte ni material) y aquí se
  // quita, para que si pierde no sea por falta de información.
  const describir = (id: string, nombre: string) => {
    const a = attrsDe.get(id) ?? {};
    const partes = ["color", "corte", "largo", "material", "patron", "formalidad"]
      .map((k) => (a[k] ? `${k}: ${a[k]}` : ""))
      .filter(Boolean);
    return partes.length ? `${nombre} [${partes.join("; ")}]` : nombre;
  };

  const preguntas: Record<string, PreguntaJev> = Object.fromEntries(
    Object.entries(RASGOS).map(([k, instructions]) => [k, { type: "noul" as const, instructions }])
  );

  console.log(`GUSTO · ${casos.length} looks votados · ${Object.keys(RASGOS).length} rasgos por look`);
  const salida: unknown[] = [];
  let costo = 0, ms = 0, fallos = 0, hechos = 0;
  const cola = [...casos];
  const obrero = async () => {
    for (;;) {
      const c = cola.shift();
      if (!c) return;
      const prendas = c.look.prendas!;
      try {
        const estado = `PRENDAS DEL LOOK:\n${prendas.map((p) => `- ${describir(p.id, p.nombre)}`).join("\n")}`;
        const r = await preguntarJev(estado, preguntas);
        costo += r.recibo.costoUsd ?? 0;
        ms += r.recibo.ms;
        const jev: Record<string, number> = {};
        for (const k of Object.keys(RASGOS)) {
          const a = r.respuestas[k];
          if (a?.type === "noul") jev[k] = a.noul;
        }
        salida.push({
          ronda: c.ronda,
          marca: c.marca,
          brief: {
            objective: c.brief.objective,
            formality: c.brief.formality ?? null,
            momento: c.brief.momento ?? null,
            temp_c: c.brief.weather?.temp_c ?? null,
            condition: c.brief.weather?.condition ?? null,
          },
          prendas: prendas.map((p) => ({ nombre: p.nombre, attrs: attrsDe.get(p.id) ?? {} })),
          jev,
        });
      } catch (e) {
        fallos++;
        if (fallos <= 3) console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
      }
      if (++hechos % 100 === 0) console.log(`  ${hechos}/${casos.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, obrero));
  console.log(`  listo · ${salida.length} descritos · fallos ${fallos} · costo $${costo.toFixed(4)} · ${Math.round(ms / Math.max(salida.length, 1))}ms por look`);
  writeFileSync(volcar, JSON.stringify(salida));
  console.log(`volcado en ${volcar} — ahora: python3 scripts/examen-jev-gusto.py ${volcar}`);
}

main();
