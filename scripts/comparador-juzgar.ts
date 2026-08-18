// LA RÚBRICA JUZGA UNA CORRIDA DEL COMPARADOR — el instrumento pareado.
//
// Uso:  npx tsx scripts/comparador-juzgar.ts <corridaId>
//
// POR QUÉ EXISTE, con el número que lo justifica: dos corridas del eval CON EL
// MISMO CÓDIGO dieron 76% y 88% de aprobación. Con esa varianza entre días,
// comparar dos versiones con una corrida cada una no distingue una mejora del
// ruido — y así se decidieron cuatro versiones del motor el 7 de agosto, todas
// con la honestidad de decir "esto no es concluyente".
//
// El comparador YA corre A y B sobre el MISMO brief. Lo único que le faltaba
// era que alguien juzgara sin esperar el voto humano. Al comparar dentro del
// mismo brief, la varianza del día se resta y desaparece.
//
// LO QUE ESTO DECIDE Y LO QUE NO: decide iteraciones de PROMPT y REGLAS, donde
// los dos lados corren el mismo juez y su sesgo se cancela. NO corona un modelo
// — un juez Claude prefiere looks escritos por Claude, y esa decisión se queda
// con el voto ciego humano. Está escrito en rubrica.ts desde que nació.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { evaluarLook, RUBRICA_VERSION, type BriefRubrica, type NotaRubrica } from "../lib/engine/rubrica";
import { estiloDelPerfil, colorDelPerfil } from "../lib/evales/evales";
import { marcadorPareado, paresNecesarios } from "../lib/comparador/juez-pareado";
import type { BriefMotor, VarianteMotor } from "../lib/comparador/motor";
import { conCategoria, ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "../lib/item-image";
import { evaluarLookConVision, RUBRICA_VISION_VERSION } from "../lib/engine/rubrica-vision";
import { criticarLook, JUEZ_STYLIST_VERSION, type CriticaStylist } from "../lib/engine/juez-stylist";
import { resumirPorVariante } from "../lib/engine/resumen-ronda";
import type { EngineItem } from "../lib/engine/prompt";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

type Look = { nombre: string; item_ids: string[]; explicacion: string; tip?: string | null };

/** Mismo helper que scripts/rubrica-vision-acuerdo.ts: la foto como la ve el
 *  humano al votar. Sin imagen, la prenda viaja sólo por nombre y el juez lo
 *  sabe (la rúbrica lo dice explícito para que no dé por visto lo que no vio). */
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
  const corridaId = process.argv[2];
  if (!corridaId) {
    console.error("Uso: npx tsx scripts/comparador-juzgar.ts <corridaId>");
    process.exit(1);
  }
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: corrida } = await s
    .from("comparador_motor_corridas")
    .select("variantes, closet_user_id, prompt_version, pool_version")
    .eq("id", corridaId)
    .single();
  if (!corrida) throw new Error("no existe esa corrida");
  const variantes = corrida.variantes as VarianteMotor[];
  const claves: [string, string] = [variantes[0].clave, variantes[1].clave];
  const dueno = corrida.closet_user_id as string;

  const { data: perfil } = await s.from("profiles").select("*").eq("id", dueno).single();
  const p = (perfil ?? {}) as Record<string, unknown>;
  const { data: items } = await s
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .eq("user_id", dueno)
    .is("deleted_at", null);
  const closet = conCategoria((items ?? []) as unknown as ItemImageRow[]) as unknown as EngineItem[];
  const porId = new Map(closet.map((i) => [i.id, i]));

  // Las URLs de las fotos, firmadas donde toque (el bucket es privado). Mismo
  // paso que scripts/rubrica-vision-acuerdo.ts — sin esto el juez visual
  // recibiría prendas sin imagen y calificaría a ciegas creyendo que vio.
  const filasImg = (items ?? []) as unknown as (ItemImageRow & { id: string })[];
  const firmadas = new Map<string, string>();
  for (const f of filasImg) {
    for (const path of [f.photo_path, f.render_path].filter(Boolean) as string[]) {
      const { data } = await s.storage.from("prendas").createSignedUrl(path, 3600);
      if (data?.signedUrl) firmadas.set(path, data.signedUrl);
    }
  }
  const urlPorItem = new Map(
    filasImg.map((f) => [
      f.id,
      itemImageUrlSync(f, (path) => firmadas.get(path), "https://stailist.co"),
    ])
  );

  const [{ data: pares }, { data: lados }] = await Promise.all([
    s.from("comparador_motor_pares").select("*").eq("corrida_id", corridaId).order("n"),
    s.from("comparador_motor_lados").select("*").eq("corrida_id", corridaId),
  ]);

  console.log(
    `Juzgando ${corridaId.slice(0, 8)} · ${variantes.map((v) => v.etiqueta).join(" contra ")}`
  );
  console.log(
    `  prompt ${corrida.prompt_version} · pool ${corrida.pool_version} · rúbricas ${RUBRICA_VERSION} + ${RUBRICA_VISION_VERSION} + ${JUEZ_STYLIST_VERSION}`
  );

  // EL AVISO QUE EVITA QUE ESTE NÚMERO SE USE MAL. Si las dos variantes cambian
  // de MODELO, la rúbrica no puede decidir: un juez Claude tiende a preferir
  // looks escritos por Claude, y ese sesgo es justo el que corrompería un
  // Opus-contra-Gemini. Lo dice rubrica.ts desde que nació, y sin este aviso el
  // número saldría igual de convincente en la pantalla.
  const modelos = new Set(variantes.map((v) => v.modeloId ?? "produccion"));
  const compararModelos = modelos.size > 1;
  if (compararModelos) {
    console.log(
      `\n  ⚠ ESTAS DOS VARIANTES CAMBIAN DE MODELO.\n` +
        `    La rúbrica NO corona modelos: un juez Claude prefiere looks de Claude.\n` +
        `    Lo de abajo sirve para VER DÓNDE difieren, no para decidir cuál usar —\n` +
        `    esa decisión se queda con el voto ciego humano.`
    );
  }
  console.log("");

  // Los espejos NO se juzgan: repiten los looks de su original, así que
  // duplicarían pares y falsearían la muestra.
  const reales = (pares ?? []).filter((x) => !x.repite_de);
  let costo = 0;
  let fallos = 0;

  const trabajo: {
    ladoId: string;
    brief: BriefMotor;
    looks: Look[];
    previas: NotaRubrica[];
    previasVision: NotaRubrica[];
    previasCriticas: CriticaStylist[];
  }[] = [];
  for (const par of reales) {
    for (const l of (lados ?? []).filter((x) => x.par_id === par.id)) {
      const looks = (l.looks as Look[] | null) ?? [];
      const previas = (l.notas as NotaRubrica[] | null) ?? [];
      const previasVision = (l.notas_vision as NotaRubrica[] | null) ?? [];
      const previasCriticas = (l.criticas as CriticaStylist[] | null) ?? [];
      // Falta trabajo si CUALQUIERA de las dos rúbricas va incompleta: al
      // entrar visión, los lados juzgados sólo con texto tienen que completarse
      // sin volver a pagar el texto.
      const listo =
        previas.length >= looks.length &&
        previasVision.length >= looks.length &&
        previasCriticas.length >= looks.length;
      if (!looks.length || listo) continue;
      trabajo.push({
        ladoId: l.id as string,
        brief: par.brief as BriefMotor,
        looks,
        previas,
        previasVision,
        previasCriticas,
      });
    }
  }
  console.log(`${trabajo.length} lados por juzgar (los ya juzgados no se re-pagan)`);

  const cola = [...trabajo];
  let hechos = 0;
  const obrero = async () => {
    for (;;) {
      const t = cola.shift();
      if (!t) return;
      const b = t.brief;
      const brief: BriefRubrica = {
        objective: b.objective,
        workDressCode: (p.work_dress_code as string | null) ?? null,
        veCliente: typeof b.veCliente === "boolean" ? b.veCliente : null,
        plan: b.plan ?? null,
        tipoEvento: b.tipoEvento ?? null,
        formality: b.formality ?? null,
        momento: b.momento,
        weather: b.weather,
        paraguas: b.paraguas === true,
        estilo: estiloDelPerfil(p),
        color: colorDelPerfil(p),
      };
      // ── La rúbrica que MIRA, en paralelo a la que lee ──────────────────
      // Cuesta $0.002 por look contra $0.011 la de texto: 5× más barata, y ve
      // lo único que el texto no puede ver — el tono real, la textura y si dos
      // piezas se pelean a la vista. En un instrumento PAREADO su sesgo no
      // estorba: los dos lados corren el mismo juez y se cancela.
      // La cuadrícula de fotos, UNA vez por look: la comparten el juez que mira
      // y el stylist. Bajarla dos veces sería pagar el ancho de banda doble
      // para mandar exactamente las mismas imágenes.
      const fotosDe = async (look: Look) =>
        Promise.all(
          look.item_ids.map(async (id) => {
            const it = porId.get(id);
            const url = urlPorItem.get(id) ?? null;
            return {
              nombre: it?.attrs.nombre ?? "Prenda",
              imagen: url ? await comoBase64(url) : null,
            };
          })
        );

      const notasVision: NotaRubrica[] = [...t.previasVision];
      const criticas: CriticaStylist[] = [...t.previasCriticas];
      for (let i = notasVision.length; i < t.looks.length; i++) {
        const look = t.looks[i];
        try {
          const prendas = await fotosDe(look);
          const rv = await evaluarLookConVision(brief, {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas,
          });
          notasVision.push(rv.nota);
          costo += rv.recibo.costoUsd ?? 0;
        } catch (e) {
          fallos++;
          if (fallos <= 3) console.error(`  fallo visión: ${e instanceof Error ? e.message : e}`);
          break; // se guarda lo que haya; el siguiente pase completa
        }
      }

      // ── El juez que CRITICA ────────────────────────────────────────────
      // No puntúa: dice qué pieza falla, por qué y qué cambiarías. Es el que
      // hace el trabajo de revisión que Roberto hacía a mano, y su salida es la
      // que alimenta el resumen de la ronda.
      for (let i = criticas.length; i < t.looks.length; i++) {
        const look = t.looks[i];
        try {
          const rc = await criticarLook(brief, {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas: await fotosDe(look),
          });
          criticas.push(rc.critica);
          costo += rc.recibo.costoUsd ?? 0;
        } catch (e) {
          fallos++;
          if (fallos <= 3) console.error(`  fallo stylist: ${e instanceof Error ? e.message : e}`);
          break;
        }
      }

      const notas: NotaRubrica[] = [...t.previas];
      for (let i = notas.length; i < t.looks.length; i++) {
        const look = t.looks[i];
        try {
          const r = await evaluarLook(brief, {
            nombre: look.nombre,
            explicacion: look.explicacion,
            tip: look.tip ?? null,
            prendas: look.item_ids.map((id) => {
              const it = porId.get(id);
              return {
                nombre: it?.attrs.nombre ?? "Prenda",
                color: it?.attrs.color ?? null,
                material: (it?.attrs as { material?: string } | undefined)?.material ?? null,
              };
            }),
          });
          notas.push(r.nota);
          costo += r.recibo.costoUsd ?? 0;
        } catch (e) {
          fallos++;
          if (fallos <= 3) console.error(`  fallo: ${e instanceof Error ? e.message : e}`);
          break; // se guarda lo que haya; el siguiente pase completa
        }
      }
      await s
        .from("comparador_motor_lados")
        .update({ notas, notas_vision: notasVision, criticas })
        .eq("id", t.ladoId);
      if (++hechos % 10 === 0) console.log(`  ${hechos}/${trabajo.length}…`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, obrero));

  // ── El marcador, releyendo TODO (incluidos los lados ya juzgados antes) ──
  const { data: finales } = await s
    .from("comparador_motor_lados")
    .select("par_id, variante, notas, notas_vision, criticas")
    .eq("corrida_id", corridaId);

  // DOS marcadores, uno por rúbrica, y NO se promedian: cuando la que lee y la
  // que mira discrepan, eso es el dato — promediarlas lo escondería detrás de
  // un número intermedio que no describe a ninguna de las dos.
  const armarPorPar = (campo: "notas" | "notas_vision") => {
    const m = new Map<string, { variante: string; notas: NotaRubrica[] }[]>();
    for (const l of finales ?? []) {
      const k = l.par_id as string;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push({
        variante: l.variante as string,
        notas: ((l as Record<string, unknown>)[campo] as NotaRubrica[] | null) ?? [],
      });
    }
    return m;
  };
  const juzgadosDe = (campo: "notas" | "notas_vision") => {
    const m = armarPorPar(campo);
    return reales.map((par) => ({
      n: par.n as number,
      etiqueta: (par.brief as BriefMotor).etiqueta,
      lados: m.get(par.id as string) ?? [],
    }));
  };
  const juzgados = juzgadosDe("notas");

  const et = (c: string) => variantes.find((v) => v.clave === c)?.etiqueta ?? c;

  const imprimirMarcador = (
    r: ReturnType<typeof marcadorPareado>,
    titulo: string
  ) => {
  console.log(`\n${"=".repeat(66)}`);
  console.log(titulo);
  console.log(`  ${r.comparables} pares comparables\n`);
  console.log(`  ${et(claves[0]).padEnd(24)} gana ${r.gana[claves[0]]}`);
  console.log(`  ${et(claves[1]).padEnd(24)} gana ${r.gana[claves[1]]}`);
  console.log(`  empates ${r.empates}`);
  console.log(`  sign test: p = ${r.p == null ? "—" : r.p.toFixed(3)}`);

  if (r.diferencia) {
    const { media, se, t } = r.diferencia;
    console.log(
      `\n  diferencia media (${et(claves[0])} − ${et(claves[1])}): ${media >= 0 ? "+" : ""}${media.toFixed(3)} puntos`
    );
    console.log(`  error estándar ${se.toFixed(3)} · t = ${t ?? "—"}`);
    console.log(
      `  ${t != null && Math.abs(t) > 2 ? "→ SEÑAL: la diferencia sobrevive al ruido" : "→ dentro del ruido: no se puede afirmar diferencia"}`
    );
    // Y la parte que evita gastar a ciegas la próxima vez.
    const sd = se * Math.sqrt(r.comparables);
    console.log(`\n  para detectar +0.2 puntos harían falta ~${paresNecesarios(sd)} pares`);
  }

  console.log(`\n  DÓNDE está la diferencia:`);
  console.log(`  dimensión      ${et(claves[0]).slice(0, 12).padEnd(14)}${et(claves[1]).slice(0, 12)}`);
  for (const d of ["ocasion", "clima", "armado", "estilo", "color", "wow"]) {
    const a = r.porDimension[claves[0]][d];
    const b = r.porDimension[claves[1]][d];
    const flecha = Math.abs(a - b) < 0.05 ? "  " : a > b ? "←" : "→";
    console.log(`  ${d.padEnd(14)} ${a.toFixed(2).padStart(5)}  ${flecha}  ${b.toFixed(2).padStart(5)}`);
  }
  };

  imprimirMarcador(
    marcadorPareado(juzgados, claves),
    "MARCADOR PAREADO · rúbrica que LEE (nombres de prenda)"
  );
  // La que mira sólo si hay notas: las corridas juzgadas antes de rv3 entrar
  // aquí no las tienen, y un marcador de cero pares se lee como empate.
  const juzgadosVision = juzgadosDe("notas_vision");
  const hayVision = juzgadosVision.some((j) => j.lados.some((l) => l.notas.length));
  if (hayVision) {
    imprimirMarcador(
      marcadorPareado(juzgadosVision, claves),
      "MARCADOR PAREADO · rúbrica que MIRA (fotos de las prendas)"
    );
    console.log(
      `\n  Los dos marcadores NO se promedian a propósito. Si discrepan, eso es\n` +
        `  el dato: el texto ve nombres y la visión ve tonos y texturas.`
    );
  } else {
    console.log(`\n(sin notas de visión en esta corrida — vuelve a correr el script)`);
  }

  // ── EL RESUMEN DE LA RONDA ───────────────────────────────────────────────
  // La parte que reemplaza el trabajo manual: 240 notas sueltas convertidas en
  // "estos son los problemas, ordenados por lo que más duele". Por variante,
  // porque la pregunta no es sólo cuál ganó sino EN QUÉ difieren.
  const criticasPorVariante: Record<string, CriticaStylist[]> = {};
  for (const l of finales ?? []) {
    const cs = (l.criticas as CriticaStylist[] | null) ?? [];
    if (!cs.length) continue;
    const k = l.variante as string;
    (criticasPorVariante[k] ??= []).push(...cs);
  }
  if (Object.keys(criticasPorVariante).length) {
    const porVar = resumirPorVariante(criticasPorVariante);
    console.log(`\n${"=".repeat(66)}`);
    console.log(`LO QUE VIO EL JUEZ STYLIST (${JUEZ_STYLIST_VERSION})`);
    for (const clave of claves) {
      const r = porVar[clave];
      if (!r) continue;
      console.log(`\n  ${et(clave)}`);
      console.log(
        `  ${r.conHallazgos}/${r.looks} looks con algo que decir · ${r.conRotos} con un fallo que ROMPE`
      );
      for (const t of r.temas) {
        const marca = t.peor === "rompe" ? "🔴" : t.peor === "resta" ? "🟠" : "· ";
        console.log(`  ${marca} ${t.label.padEnd(22)} ${t.looks} looks (${t.hallazgos} hallazgos)`);
        for (const e of t.ejemplos.slice(0, 2)) {
          console.log(`       "${e.pieza}": ${e.problema}`);
          console.log(`        → ${e.arreglo}`);
        }
      }
    }
    console.log(`\n  Los temas de arriba son la lista de qué ajustar en el motor.`);
    console.log(`  Cada uno que se repita es candidato a regla en código.`);
  }

  console.log(`\ncosto $${costo.toFixed(2)}${fallos ? ` · ${fallos} fallos` : ""}`);
  if (compararModelos) {
    console.log(
      `\n⚠ Recordatorio: estas variantes cambian de modelo. Este marcador describe,\n` +
        `  no decide. Para coronar un modelo, el voto ciego humano.`
    );
  }
}

main();
