// EL EXAMEN DEL JUEZ STYLIST contra los votos de Roberto.
//
// Uso:
//   npx tsx scripts/examen-juez.ts                 # en seco: cruza las críticas YA guardadas con sus votos ($0)
//   npx tsx scripts/examen-juez.ts --correr        # además corre el juez VIGENTE sobre esos looks y compara (~$0.01/look)
//   npx tsx scripts/examen-juez.ts --correr --guardar   # y sobreescribe las críticas guardadas con las nuevas
//
// QUÉ MIDE. Para cada look que Roberto marcó 👍/👎 en el comparador y que
// tiene crítica del juez: ¿el juez lo habría rechazado? Dos cifras por umbral
// de gravedad: cuántos 👎 caza (recall) y cuántos 👍 marca (falsa alarma).
// El universo es 83% positivo, así que el acierto global engaña: un juez que
// dijera "todo bien" acertaría 72%. Por eso la cifra que manda es la primera.
//
// POR QUÉ EXISTE COMO SCRIPT Y NO COMO CONSULTA SUELTA: es la medición que
// `docs/improvement-loop-del-motor.md` dice que se repite cada vez que el juez
// cambia. La primera vez (2026-08-22, js3) dio: ve pero no pesa — 85% de los 👎
// con cualquier hallazgo, 22% con "rompe".
//
// AFINAR Y VALIDAR SOBRE LOS MISMOS LOOKS ES TRAMPA. Si el juez se ajusta
// mirando estos 95, el número de aquí es optimista; el que vale es el de la
// siguiente ronda votada. El script lo imprime para que no se olvide.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { criticarLook, JUEZ_STYLIST_VERSION, type CriticaStylist, type Gravedad } from "../lib/engine/juez-stylist";
import type { BriefRubrica } from "../lib/engine/rubrica";
import { registroDelPerfil, estiloDelPerfil, colorDelPerfil } from "../lib/evales/evales";
import { conCategoria, ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "../lib/item-image";
import { cargarCasosVotados, muestrearParaExamen, FIN_DEL_AFINADO, type CasoVotado } from "../lib/evales/casos-votados";
import { tabla, tiene } from "../lib/evales/tabla-examen";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

/** El caso lo define `lib/evales/casos-votados.ts`: los dos exámenes leen el
 *  MISMO universo o la comparación entre jueces no significa nada. */
type Caso = CasoVotado;

async function comoBase64(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mediaType = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\//.test(mediaType)) return null;
    return { mediaType, base64: buf.toString("base64") };
  } catch {
    return null;
  }
}

async function main() {
  const correr = process.argv.includes("--correr");
  const guardar = process.argv.includes("--guardar");
  // --limite CON --guardar sobreescribiría UNA DE CADA `paso` críticas, dejando
  // la columna "guardado" mezclada entre dos versiones del juez y sin forma de
  // saber cuál escribió cuál fila. Esa columna es el campeón contra el que se
  // miden los dos exámenes: mezclarla es destruir la línea base en silencio, y
  // el update es destructivo (no hay historial). Se prohíbe la combinación.
  if (guardar && process.argv.some((a) => a.startsWith("--limite="))) {
    console.error(
      "--guardar NO se puede combinar con --limite: dejaría la columna guardada mezclada entre dos versiones del juez.\nCorre la muestra sin --guardar, o guarda la corrida COMPLETA."
    );
    process.exit(1);
  }
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { casos, corridas } = await cargarCasosVotados(s);
  const conCritica = casos.filter((c) => c.critica);
  console.log(`EXAMEN DEL JUEZ · ${casos.length} looks votados y reconstruibles · ${conCritica.length} con crítica guardada`);
  tabla("GUARDADO (la crítica que se corrió en su ronda)", conCritica, (c) => c.critica);

  if (process.argv.includes("--detalle")) {
    // Para escribir la siguiente versión del juez: qué dijo en los 👍 (ruido)
    // y qué dijo —o calló— en los 👎, con la palabra de Roberto al lado.
    for (const marca of ["abajo", "arriba"] as const) {
      console.log(`\n===== ${marca === "abajo" ? "👎" : "👍"} =====`);
      for (const c of conCritica.filter((x) => x.marca === marca)) {
        console.log(`· [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}`);
        if (c.comentario) console.log(`    tú: ${c.comentario}`);
        for (const h of c.critica!.hallazgos) console.log(`    ${h.defecto}/${h.gravedad} (${h.pieza}): ${h.problema}`);
      }
    }
  }

  if (!correr) return;

  // --limite=N: correr el juez sobre una MUESTRA, para no pagar los 460 cada
  // vez. La muestra sale de las rondas POSTERIORES al afinado (las que el juez
  // no vio) y se toma a paso fijo, no al azar: dos corridas del mismo N miden
  // los mismos looks, que es lo que permite comparar una versión con otra.
  const limite = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9) ?? 0);
  const aCorrer = muestrearParaExamen(casos, limite);
  if (limite > 0)
    console.log(`\nMUESTRA: ${aCorrer.length} looks de las rondas posteriores al afinado (${FIN_DEL_AFINADO.slice(0, 10)}).`);

  // ── Correr el juez vigente sobre los mismos looks ─────────────────────────
  const dueno = corridas[0]?.closet_user_id;
  const { data: perfil } = await s.from("profiles").select("*").eq("id", dueno).single();
  const p = (perfil ?? {}) as Record<string, unknown>;
  const { data: items } = await s.from("items").select(`id, ${ITEM_IMAGE_SELECT}`).eq("user_id", dueno).is("deleted_at", null);
  const filas = (items ?? []) as unknown as (ItemImageRow & { id: string })[];
  conCategoria(filas as unknown as ItemImageRow[]);
  const firmadas = new Map<string, string>();
  for (const f of filas)
    for (const path of [f.photo_path, f.render_path].filter(Boolean) as string[]) {
      const { data } = await s.storage.from("prendas").createSignedUrl(path, 3600);
      if (data?.signedUrl) firmadas.set(path, data.signedUrl);
    }
  const urlPorItem = new Map(filas.map((f) => [f.id, itemImageUrlSync(f, (x) => firmadas.get(x), "https://stailist.co")]));
  const imagenes = new Map<string, { mediaType: string; base64: string } | null>();
  const imagenDe = async (id: string) => {
    if (!imagenes.has(id)) { const u = urlPorItem.get(id); imagenes.set(id, u ? await comoBase64(u) : null); }
    return imagenes.get(id) ?? null;
  };

  console.log(`\nCorriendo ${JUEZ_STYLIST_VERSION} sobre ${aCorrer.length} looks…`);
  const nuevas = new Map<Caso, CriticaStylist>();
  let costo = 0, fallos = 0, hechos = 0;
  const cola = [...aCorrer];
  const obrero = async () => {
    for (;;) {
      const c = cola.shift();
      if (!c) return;
      const b = c.brief;
      const brief: BriefRubrica = {
        objective: b.objective, workDressCode: (p.work_dress_code as string | null) ?? null,
        veCliente: typeof b.veCliente === "boolean" ? b.veCliente : null, plan: b.plan ?? null,
        tipoEvento: b.tipoEvento ?? null, formality: b.formality ?? null, momento: b.momento,
        weather: b.weather, paraguas: b.paraguas === true, estilo: estiloDelPerfil(p),
        registro: registroDelPerfil(p), color: colorDelPerfil(p),
      };
      try {
        const prendas = await Promise.all((c.look.prendas ?? []).map(async (pr) => ({ nombre: pr.nombre, imagen: await imagenDe(pr.id) })));
        const r = await criticarLook(brief, { nombre: c.look.nombre, explicacion: c.look.explicacion, tip: c.look.tip ?? null, prendas });
        nuevas.set(c, r.critica);
        costo += r.recibo.costoUsd ?? 0;
      } catch (e) {
        fallos++;
        if (fallos <= 3) console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
      }
      if (++hechos % 20 === 0) console.log(`  ${hechos}/${aCorrer.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, obrero));
  console.log(`  listo · costo $${costo.toFixed(2)} · fallos ${fallos}`);

  const evaluados = aCorrer.filter((c) => nuevas.has(c));
  // LA COMPARACIÓN PAREADA: los MISMOS looks, con la crítica vieja que quedó
  // guardada y con la recién corrida. Sin esto sólo habría dos números sobre
  // universos distintos, que es como se fabrica una mejora que no existe.
  // PAREADO DE VERDAD: los dos lados sobre EXACTAMENTE los mismos looks. Un
  // look sin crítica guardada no tiene "antes", así que sale de los dos lados —
  // si saliera sólo de uno, la comparación volvería a ser dos números sobre
  // universos distintos, que es lo que esta tabla existe para evitar.
  const pareados = evaluados.filter((c) => c.critica);
  if (limite > 0) {
    tabla(`ANTES (lo guardado) · los MISMOS ${pareados.length} looks`, pareados, (c) => c.critica);
    tabla(`DESPUÉS ${JUEZ_STYLIST_VERSION} · los MISMOS ${pareados.length} looks`, pareados, (c) => nuevas.get(c)!);
  }
  tabla(`VIGENTE ${JUEZ_STYLIST_VERSION} (recién corrido)`, evaluados, (c) => nuevas.get(c)!);
  // LA CIFRA QUE VALE. js5 se afinó el 2026-08-22 mirando los votos de hasta
  // ese día; las rondas posteriores son looks que nunca vio. Sin este corte el
  // examen mezcla tarea con prueba y sale optimista.
  // Con --limite el universo YA es post-afinado, así que esta tabla sería un
  // duplicado exacto de la anterior bajo otro título — y dos veces el mismo
  // número se lee como corroboración.
  if (limite === 0) {
    const limpios = evaluados.filter((c) => c.creada > FIN_DEL_AFINADO);
    tabla(`VIGENTE ${JUEZ_STYLIST_VERSION} · SÓLO rondas posteriores al afinado (${FIN_DEL_AFINADO.slice(0, 10)})`, limpios, (c) => nuevas.get(c)!);
  }

  console.log(`\n👎 que ${JUEZ_STYLIST_VERSION} deja pasar sin "rompe":`);
  for (const c of evaluados.filter((x) => x.marca === "abajo" && !tiene(nuevas.get(x)!, ["rompe"])))
    console.log(`  · [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}\n      tú: ${c.comentario ?? "(sin comentario)"}\n      juez: ${nuevas.get(c)!.hallazgos.map((h) => `${h.defecto}/${h.gravedad}`).join(", ") || "NADA"}`);
  console.log(`\n👍 que ${JUEZ_STYLIST_VERSION} marca con "rompe" (falsas alarmas graves):`);
  for (const c of evaluados.filter((x) => x.marca === "arriba" && tiene(nuevas.get(x)!, ["rompe"])))
    console.log(`  · [${c.brief.etiqueta}] ${c.look.prendas!.map((x) => x.nombre).join(" + ")}\n      juez: ${nuevas.get(c)!.hallazgos.filter((h) => h.gravedad === "rompe").map((h) => `${h.defecto}: ${h.problema}`).join(" | ")}`);

  // --volcar=<ruta>: cada caso con su crítica nueva, para analizar fuera del
  // script (qué se le escapa, falsas alarmas, acuerdo por par) sin volver a
  // pagar la corrida.
  const volcar = process.argv.find((a) => a.startsWith("--volcar="))?.slice("--volcar=".length);
  if (volcar) {
    writeFileSync(
      volcar,
      JSON.stringify(
        evaluados.map((c) => ({
          ronda: c.ronda, creada: c.creada, parId: c.parId, variante: c.variante, indice: c.indice,
          etiqueta: c.brief.etiqueta, prendas: c.look.prendas!.map((x) => x.nombre), marca: c.marca,
          comentario: c.comentario, hallazgos: nuevas.get(c)!.hallazgos,
        })),
        null,
        1
      )
    );
    console.log(`volcado en ${volcar}`);
  }

  console.log(`\n⚠ Si ${JUEZ_STYLIST_VERSION} se afinó mirando estos looks, este número es optimista: el que vale es el de la próxima ronda votada.`);

  if (guardar) {
    const porLado = new Map<string, Caso[]>();
    for (const c of evaluados) (porLado.get(c.ladoId) ?? porLado.set(c.ladoId, []).get(c.ladoId)!).push(c);
    let n = 0;
    for (const [ladoId, cs] of porLado) {
      const { data: lado } = await s.from("comparador_motor_lados").select("criticas, looks").eq("id", ladoId).single();
      const criticas = [...(((lado?.criticas as CriticaStylist[] | null) ?? []))];
      for (const c of cs) criticas[c.indice] = nuevas.get(c)!;
      const { error } = await s.from("comparador_motor_lados").update({ criticas }).eq("id", ladoId);
      if (error) throw error;
      n++;
    }
    console.log(`guardado en ${n} lados (las críticas anteriores quedaron reemplazadas).`);
  }
}
main();
