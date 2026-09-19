// EL EXAMEN DE JEV: ¿un modelo que sólo contesta preguntas acotadas caza los
// 👎 de Roberto mejor que el juez vigente?
//
// Uso:
//   npx tsx scripts/examen-jev.ts                  # corre Jev sobre los looks votados
//   npx tsx scripts/examen-jev.ts --control        # + el juez vigente SIN fotos (el control que importa)
//   npx tsx scripts/examen-jev.ts --limite=20      # una cata barata antes de pagar la corrida entera
//   npx tsx scripts/examen-jev.ts --volcar=/tmp/jev.json
//   npx tsx scripts/examen-jev.ts --estado=limpio  # jv2: sin las reglas de la casa en el estado
//
// jv2, REGLA ESCRITA ANTES DE CORRERLA (2026-09-19): cambia el veredicto sólo si
// jv2 pasa la MISMA regla de abajo contra el campeón. Si mejora su separación
// pero sigue perdiendo, el veredicto se queda y se anota cuánto explicaba la
// contaminación del estado. Una sola variable cambia respecto a jv1: el estado.
//
// QUÉ COMPARA, y son TRES columnas a propósito:
//   1. GUARDADO — la crítica que ya corrió en su ronda, CON las fotos de las
//      prendas. Sale gratis (está en la base) y es el campeón a vencer. OJO: es
//      la versión del juez VIGENTE EN ESA RONDA, no necesariamente la de hoy.
//   2. EL JUEZ DE HOY, TEXTO-SOLO (--control) — el mismo juez con las fotos
//      escondidas. Sin esta columna, "Jev perdió" y "sin fotos no se puede"
//      son la misma tabla, y son cosas distintas.
//   3. JEV — preguntas atómicas, texto solo.
//
// LA REGLA, ESCRITA ANTES DE LA PRIMERA CORRIDA (2026-09-18):
// Jev pasa si, contra js7 TEXTO-SOLO en las rondas que ninguno de los dos vio
// al afinarse, caza al menos los mismos 👎 con una falsa alarma que no sea
// mayor. Si sólo empata, NO se adopta: no explica, no propone arreglo, y un
// empate no paga cambiar de proveedor. Si gana, lo que se abre es la
// conversación de arquitectura (una criba delante del juez), no el reemplazo.
//
// LA TRAMPA QUE ESTE SCRIPT EVITA: elegir el umbral mirando los mismos looks
// con los que luego se presume. Los pesos se eligen SÓLO en las rondas viejas
// (≤ FIN_DEL_AFINADO) y el número que vale sale de las nuevas.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { criticarLook, JUEZ_STYLIST_VERSION, type CriticaStylist } from "../lib/engine/juez-stylist";
import type { BriefRubrica } from "../lib/engine/rubrica";
import { registroDelPerfil, estiloDelPerfil, colorDelPerfil } from "../lib/evales/evales";
import { cargarCasosVotados, muestrearParaExamen, FIN_DEL_AFINADO, type CasoVotado } from "../lib/evales/casos-votados";
import { tabla, tiene, pct } from "../lib/evales/tabla-examen";
import { preguntarJev, type RespuestaJev } from "../lib/jev";
import {
  CLAVE_GRAVEDAD,
  JUEZ_JEV_VERSION as VERSION_JV1,
  JUEZ_JEV_VERSION_LIMPIO,
  estadoLimpioParaJev,
  PESOS_INICIALES,
  criticaDesdeJev,
  curvaDeUmbral,
  discriminacion,
  estadoParaJev,
  preguntasDelJuez,
  type CasoMedible,
} from "../lib/engine/juez-jev";
import { DEFECTOS_MOTOR } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const DEFECTOS = DEFECTOS_MOTOR.map((d) => d.clave);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

/**
 * LA REGLA DE SELECCIÓN DEL UMBRAL, pre-registrada: se queda el umbral que
 * maximiza (caza − falsa alarma). Es el criterio de Youden, y se escribe aquí
 * —en código, antes de ver un solo resultado— para que no se elija después "el
 * que se ve mejor en la tabla", que es como se fabrica un buen número falso.
 */
function mejorUmbral(casos: CasoMedible[]) {
  const curva = curvaDeUmbral(casos, DEFECTOS, [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
  return curva.reduce((mejor, p) => {
    const j = (x: typeof p) =>
      (x.totalAbajo ? x.caza / x.totalAbajo : 0) - (x.totalArriba ? x.falsaAlarma / x.totalArriba : 0);
    return j(p) > j(mejor) ? p : mejor;
  }, curva[0]);
}

const LIMPIO = arg("estado") === "limpio";
const JUEZ_JEV_VERSION = LIMPIO ? JUEZ_JEV_VERSION_LIMPIO : VERSION_JV1;

async function main() {
  const limite = Number(arg("limite") ?? 0);
  const conControl = process.argv.includes("--control");
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { casos: todos, corridas } = await cargarCasosVotados(s);
  // LA MISMA regla de muestreo que examen-juez, importada y no reescrita: si un
  // examen muestreara todas las rondas y el otro sólo las nuevas, "js7 caza
  // más" podría significar "js7 vio looks más fáciles" — exactamente el fallo
  // que lib/evales/casos-votados.ts existe para cerrar.
  const casos = muestrearParaExamen(todos, limite);
  console.log(
    `EXAMEN ${JUEZ_JEV_VERSION} (Jev) · ${casos.length} looks votados${limite ? ` (limitado de ${todos.length})` : ""}`
  );

  const conCritica = casos.filter((c) => c.critica);
  tabla(`GUARDADO · CON fotos (el campeón: la crítica que corrió en su ronda)`, conCritica, (c) => c.critica);

  // El perfil del dueño del clóset: el brief se arma igual que en examen-juez,
  // o el retador estaría juzgando contra otro pedido.
  const dueno = corridas[0]?.closet_user_id;
  const { data: perfil } = await s.from("profiles").select("*").eq("id", dueno).single();
  const p = (perfil ?? {}) as Record<string, unknown>;
  const briefDe = (c: CasoVotado): BriefRubrica => ({
    objective: c.brief.objective,
    workDressCode: (p.work_dress_code as string | null) ?? null,
    veCliente: typeof c.brief.veCliente === "boolean" ? c.brief.veCliente : null,
    plan: c.brief.plan ?? null,
    tipoEvento: c.brief.tipoEvento ?? null,
    formality: c.brief.formality ?? null,
    momento: c.brief.momento,
    weather: c.brief.weather,
    paraguas: c.brief.paraguas === true,
    estilo: estiloDelPerfil(p),
    registro: registroDelPerfil(p),
    color: colorDelPerfil(p),
  });

  // Los atributos de las prendas, sólo para jv2. Se cuenta cuántas resolvieron:
  // los ids de algunas rondas murieron con el clóset del 08-18, y una prenda sin
  // atributos cae al nombre pelado — la desventaja que jv2 dice quitar.
  const { data: items } = LIMPIO ? await s.from("items").select("id, attrs").eq("user_id", dueno) : { data: [] };
  const attrsDe = new Map<string, Record<string, unknown>>(
    (items ?? []).map((i) => [i.id as string, (i.attrs ?? {}) as Record<string, unknown>])
  );
  if (LIMPIO) {
    const todas = casos.flatMap((c) => c.look.prendas ?? []);
    const con = todas.filter((p) => attrsDe.has(p.id)).length;
    console.log(`\nESTADO LIMPIO (jv2) · prendas con atributos: ${con}/${todas.length}`);
  }

  // ── La corrida de Jev ──────────────────────────────────────────────────────
  const preguntas = preguntasDelJuez();
  const respuestas = new Map<CasoVotado, Record<string, RespuestaJev>>();
  let costo = 0, ms = 0, fallos = 0, hechos = 0;
  const cola = [...casos];
  const obrero = async () => {
    for (;;) {
      const c = cola.shift();
      if (!c) return;
      try {
        const estado = LIMPIO
          ? estadoLimpioParaJev(briefDe(c), c.look.prendas!.map((x) => ({ nombre: x.nombre, attrs: attrsDe.get(x.id) })))
          : estadoParaJev(briefDe(c), {
          nombre: c.look.nombre,
          explicacion: c.look.explicacion,
          tip: c.look.tip ?? null,
          prendas: c.look.prendas!.map((x) => ({ nombre: x.nombre })),
        });
        const r = await preguntarJev(estado, preguntas);
        respuestas.set(c, r.respuestas);
        costo += r.recibo.costoUsd ?? 0;
        ms += r.recibo.ms;
      } catch (e) {
        fallos++;
        if (fallos <= 3) console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
      }
      if (++hechos % 20 === 0) console.log(`  ${hechos}/${casos.length}`);
    }
  };
  console.log(`\nCorriendo Jev sobre ${casos.length} looks…`);
  await Promise.all(Array.from({ length: 4 }, obrero));
  const n = respuestas.size;
  if (!n) {
    console.error("Ningún look contestó. Sin datos no hay examen.");
    process.exit(1);
  }
  console.log(
    `  listo · ${n} contestados · fallos ${fallos} · costo $${costo.toFixed(4)} · ${Math.round(ms / n)}ms por look`
  );

  const evaluados = casos.filter((c) => respuestas.has(c));
  const medible = (c: CasoVotado): CasoMedible => {
    const r = respuestas.get(c)!;
    const probabilidades: Record<string, number> = {};
    for (const d of DEFECTOS) {
      const x = r[d];
      if (x?.type === "noul") probabilidades[d] = x.noul;
    }
    const esc = r[CLAVE_GRAVEDAD];
    return { probabilidades, escala: esc?.type === "score" ? esc.score : 0, marca: c.marca };
  };

  tabla(
    `JEV ${JUEZ_JEV_VERSION} · SIN fotos · umbral inicial ${PESOS_INICIALES.umbral}`,
    evaluados,
    (c) => criticaDesdeJev(respuestas.get(c)!, PESOS_INICIALES)
  );

  // ── La curva: lo que el juez vigente no puede dar ──────────────────────────
  console.log(`\nCURVA DE UMBRAL (marca el look si algún defecto pasa el umbral)`);
  console.log(`  ${"umbral".padEnd(8)} caza de los 👎      falsa alarma en 👍`);
  for (const q of curvaDeUmbral(evaluados.map(medible), DEFECTOS))
    console.log(
      `  ${q.umbral.toFixed(2).padEnd(8)} ${String(q.caza).padStart(3)}/${q.totalAbajo} (${pct(q.caza, q.totalAbajo).padStart(4)})      ${String(q.falsaAlarma).padStart(3)}/${q.totalArriba} (${pct(q.falsaAlarma, q.totalArriba).padStart(4)})`
    );

  console.log(`\nQUÉ PREGUNTA SIRVE (probabilidad media en 👎 contra 👍; cerca de 0 = no mide su gusto)`);
  for (const d of discriminacion(evaluados.map(medible), DEFECTOS))
    console.log(
      `  ${d.defecto.padEnd(12)} 👎 ${d.mediaAbajo.toFixed(2)}   👍 ${d.mediaArriba.toFixed(2)}   separación ${d.separacion >= 0 ? "+" : ""}${d.separacion.toFixed(2)}`
    );

  // ── El número honesto: umbral elegido en lo viejo, medido en lo nuevo ──────
  const viejos = evaluados.filter((c) => c.creada <= FIN_DEL_AFINADO);
  const nuevos = evaluados.filter((c) => c.creada > FIN_DEL_AFINADO);
  if (viejos.length && nuevos.length) {
    const elegido = mejorUmbral(viejos.map(medible));
    console.log(
      `\nUMBRAL ELEGIDO en las ${viejos.length} rondas viejas (regla pre-registrada: máx caza − falsa alarma): ${elegido.umbral}`
    );
    tabla(
      `JEV ${JUEZ_JEV_VERSION} · SÓLO rondas posteriores a ${FIN_DEL_AFINADO.slice(0, 10)} · umbral ${elegido.umbral} ← EL NÚMERO QUE VALE`,
      nuevos,
      (c) => criticaDesdeJev(respuestas.get(c)!, { ...PESOS_INICIALES, umbral: elegido.umbral })
    );
    tabla(`GUARDADO · las MISMAS rondas nuevas (para leerlo al lado)`, nuevos.filter((c) => c.critica), (c) => c.critica);
  } else {
    console.log(`\n⚠ No hay rondas a los dos lados del ${FIN_DEL_AFINADO.slice(0, 10)}: sin corte honesto, el umbral se elegiría y se presumiría sobre los mismos looks.`);
  }

  // ── El control: el mismo juez vigente, sin fotos ───────────────────────────
  if (conControl) {
    console.log(`\nCorriendo ${JUEZ_STYLIST_VERSION} SIN fotos sobre los mismos ${evaluados.length} looks…`);
    const control = new Map<CasoVotado, CriticaStylist>();
    let costoC = 0, fallosC = 0;
    const colaC = [...evaluados];
    const obreroC = async () => {
      for (;;) {
        const c = colaC.shift();
        if (!c) return;
        try {
          const r = await criticarLook(briefDe(c), {
            nombre: c.look.nombre,
            explicacion: c.look.explicacion,
            tip: c.look.tip ?? null,
            // La única diferencia con el examen normal: las fotos no van.
            prendas: c.look.prendas!.map((x) => ({ nombre: x.nombre, imagen: null })),
          });
          control.set(c, r.critica);
          costoC += r.recibo.costoUsd ?? 0;
        } catch (e) {
          fallosC++;
          // El control es contra quien se decide la regla: un fallo sistemático
          // aquí (cuota, truncado) le regalaría la victoria a Jev por ausencia.
          if (fallosC <= 3) console.error(`  fallo del control: ${e instanceof Error ? e.message : e}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, obreroC));
    console.log(`  listo · costo $${costoC.toFixed(2)} · fallos ${fallosC}`);
    // Los DOS lados sobre los looks que contestaron en AMBOS: si el control
    // falla en algunos, "misma desventaja" deja de ser cierto y la regla se
    // decidiría sobre universos distintos.
    const ambos = evaluados.filter((c) => control.has(c));
    tabla(
      `JEV ${JUEZ_JEV_VERSION} · los MISMOS ${ambos.length} looks del control`,
      ambos,
      (c) => criticaDesdeJev(respuestas.get(c)!, PESOS_INICIALES)
    );
    tabla(
      `${JUEZ_STYLIST_VERSION} TEXTO-SOLO (el control: misma desventaja que Jev)`,
      ambos,
      (c) => control.get(c)!
    );
  }

  // ── Los looks donde se equivoca, que es lo que se lee para la v2 ───────────
  const critica = (c: CasoVotado) => criticaDesdeJev(respuestas.get(c)!, PESOS_INICIALES);
  console.log(`\n👎 que ${JUEZ_JEV_VERSION} deja pasar sin "rompe":`);
  for (const c of evaluados.filter((x) => x.marca === "abajo" && !tiene(critica(x), ["rompe"])))
    console.log(
      `  · [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}\n      tú: ${c.comentario ?? "(sin comentario)"}\n      jev: ${critica(c).hallazgos.map((h) => `${h.defecto} ${h.problema}`).join(", ") || "NADA"}`
    );
  console.log(`\n👍 que ${JUEZ_JEV_VERSION} marca con "rompe" (falsas alarmas graves):`);
  for (const c of evaluados.filter((x) => x.marca === "arriba" && tiene(critica(x), ["rompe"])))
    console.log(
      `  · [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}\n      jev: ${critica(c).hallazgos.filter((h) => h.gravedad === "rompe").map((h) => h.problema).join(" | ")}`
    );

  const volcar = arg("volcar");
  if (volcar) {
    writeFileSync(
      volcar,
      JSON.stringify(
        evaluados.map((c) => ({
          ronda: c.ronda, creada: c.creada, etiqueta: c.brief.etiqueta,
          prendas: c.look.prendas!.map((x) => x.nombre),
          comentario: c.comentario,
          ...medible(c),
        })),
        null,
        1
      )
    );
    console.log(`\nvolcado en ${volcar}`);
  }

  console.log(
    `\nRECORDATORIO DE LA REGLA: Jev pasa sólo si en las rondas nuevas caza al menos tantos 👎 como ${JUEZ_STYLIST_VERSION} texto-solo con falsa alarma no mayor. Empatar NO es pasar: no explica ni propone arreglo.`
  );
}

main();
