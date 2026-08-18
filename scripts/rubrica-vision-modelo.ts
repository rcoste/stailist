// ¿EL JUEZ QUE MIRA FALLA POR EL MODELO, O PORQUE LA TAREA LE QUEDA GRANDE?
//
// Uso:  npx tsx scripts/rubrica-vision-modelo.ts [id-de-modelo ...]
//       (sin argumentos reta a Gemini 3.5 Flash y a Sonnet 5)
//
// LA PREGUNTA, EXACTA
// La rúbrica que mira corre en VISION_MODEL — hoy Gemini 3.1 Flash-Lite. Ese
// modelo ganó una prueba a ciegas de LEER prendas (extraer color, tipo y
// material de una foto: 0.80 errores/foto contra once modelos, 27× más barato
// que Opus). Criticar estilo es otra tarea y más difícil, y nunca se midió.
//
// Lo que la hace sospechosa: sobre los looks que Roberto calificó a mano, la
// rúbrica de VISIÓN coincide con él el 84% y la de TEXTO el 89% — y aprobar
// todo daría 87%. O sea que la que mira está por debajo de no pensar.
//
// POR QUÉ NO ES UN CONCURSO NUEVO. El comparador de visión ya existe pero mide
// LEER, que es justo la tarea equivocada para esta pregunta. Y no hace falta:
// el instrumento ya está en la base — los looks que Roberto marcó 👍/👎 a mano
// en los evales. Se vuelven a juzgar LOS MISMOS con otro modelo y se compara el
// acuerdo. Mismos looks, mismas marcas, misma métrica.
//
// LOS DOS RETADORES POR DEFECTO CONTESTAN COSAS DISTINTAS:
//   · Gemini 3.5 Flash — mismo proveedor, un escalón arriba. Aísla el TIER: si
//     sube, era el modelo.
//   · Sonnet 5 — el que ya saca 89% juzgando por TEXTO. Aísla la TAREA: si
//     mirando también se queda en 84%, el problema no es el modelo sino que
//     juzgar estilo desde fotos es difícil, y mi sospecha estaba mal.
//
// LO QUE ESTE SCRIPT NO HACE: cambiar producción. VISION_MODEL sigue siendo la
// línea de lib/models.ts y sólo se mueve cuando una medición lo gana.
//
// ── LO QUE MIDIÓ LA PRIMERA CORRIDA (2026-08-18, 62 looks, $0.78 en total) ──
//
//   modelo                  acuerdo   caza 👎   rechaza buenos   acierta al rechazar
//   aprobar todo (vara)        87%      0/8         0/54                 —
//   Gemini 3.1 Flash-Lite      84%      2/8         4/54                33%
//   Gemini 3.5 Flash           79%      2/8         7/54                22%
//   Gemini 3.7 Flash           85%      1/8         2/54                33%
//   Sonnet 5                   79%      4/8         9/54                31%
//
// EL RESULTADO, Y VA CONTRA LA SOSPECHA QUE ORIGINÓ EL SCRIPT: no era el modelo.
// Subir de tier (3.5 Flash) no cazó ni un rechazo más y encima empeoró la
// precisión. Y mira la última columna: Flash-Lite, 3.7 y Sonnet aciertan casi lo
// mismo cuando rechazan —1 de cada 3—, y lo único que cambia entre ellos es
// CUÁNTAS VECES se atreven a rechazar. Eso es la firma de modelos que saben lo
// mismo de la tarea con el umbral en distinto lugar: cambiar de modelo te mueve
// por la misma curva, no te da un juez mejor.
//
// (3.7 parece el mejor en acuerdo global sólo porque es el más complaciente: se
// acerca a aprobar todo, que es justo lo que la vara desenmascara.)
//
// SE QUEDA FLASH-LITE. Decisión de Roberto antes de medir, confirmada por la
// medición. La palanca para que los jueces cacen más no es el modelo: es darles
// más de lo que ve el humano — hoy juzgan una cuadrícula de prendas sueltas y él
// vota con el contexto entero.
//
// OJO CON EL PESO DE LA EVIDENCIA: son OCHO rechazos humanos. Alcanza para
// descartar el tier (ahí la mejora fue CERO, no pequeña) y no para coronar a
// nadie. Cuando haya más marcas a mano, vuelve a correrlo.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { evaluarLookConVision, RUBRICA_VISION_VERSION } from "../lib/engine/rubrica-vision";
import { estiloDelPerfil, colorDelPerfil } from "../lib/evales/evales";
import { modeloPorId, RETADORES_VISION } from "../lib/proveedores/catalogo";
import { VISION_MODEL } from "../lib/models";
import { ITEM_IMAGE_SELECT, itemImageUrlSync, type ItemImageRow } from "../lib/item-image";
import type { BriefRubrica, NotaRubrica } from "../lib/engine/rubrica";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

// Los ids NO se escriben aquí: viven en el catálogo, que es el único lugar del
// repo donde puede aparecer el nombre de un modelo. Un test lo impide, y me
// cazó al escribir este script.
const RETADORES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.values(RETADORES_VISION);

type Look = { nombre: string; item_ids: string[]; explicacion: string; tip?: string | null };
type NotaDeLook = { texto?: NotaRubrica | null; vision?: NotaRubrica | null };

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
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const modelos = RETADORES.map((id) => {
    const m = modeloPorId(id);
    if (!m) throw new Error(`modelo desconocido: ${id} (ver lib/proveedores/catalogo)`);
    return m;
  });

  // Los briefs con marca humana, con su corrida (para saber de quién es el clóset).
  const { data: briefs } = await s
    .from("eval_briefs")
    .select("id, corrida_id, brief, looks, notas, marcas")
    .not("marcas", "is", null);

  const corridaIds = [...new Set((briefs ?? []).map((b) => b.corrida_id as string))];
  const { data: corridas } = await s
    .from("eval_corridas")
    .select("id, closet_user_id")
    .in("id", corridaIds);
  const duenoDe = new Map((corridas ?? []).map((c) => [c.id as string, c.closet_user_id as string]));

  // El clóset y las fotos de cada dueño, una sola vez.
  const meta = new Map<string, Map<string, { nombre: string; url: string | null }>>();
  const perfiles = new Map<string, Record<string, unknown>>();
  for (const dueno of new Set(duenoDe.values())) {
    const [{ data: perfil }, { data: items }] = await Promise.all([
      s.from("profiles").select("*").eq("id", dueno).single(),
      s.from("items").select(`id, ${ITEM_IMAGE_SELECT}`).eq("user_id", dueno).is("deleted_at", null),
    ]);
    perfiles.set(dueno, (perfil ?? {}) as Record<string, unknown>);
    const filas = (items ?? []) as unknown as (ItemImageRow & { id: string })[];
    const firmadas = new Map<string, string>();
    for (const f of filas) {
      for (const path of [f.photo_path, f.render_path].filter(Boolean) as string[]) {
        const { data } = await s.storage.from("prendas").createSignedUrl(path, 3600);
        if (data?.signedUrl) firmadas.set(path, data.signedUrl);
      }
    }
    meta.set(
      dueno,
      new Map(
        filas.map((f) => [
          f.id,
          {
            nombre: ((f.attrs ?? {}) as { nombre?: string }).nombre ?? "Prenda",
            url: itemImageUrlSync(f, (p) => firmadas.get(p), "https://stailist.co"),
          },
        ])
      )
    );
  }

  // Los casos: un look marcado a mano = una fila.
  type Caso = {
    brief: BriefRubrica;
    look: Look;
    humanoAprueba: boolean;
    /** Lo que dijo la rúbrica de visión de producción, ya guardado. */
    visionActual: boolean | null;
    textoActual: boolean | null;
    dueno: string;
  };
  const casos: Caso[] = [];
  for (const b of briefs ?? []) {
    const dueno = duenoDe.get(b.corrida_id as string);
    if (!dueno) continue;
    const p = perfiles.get(dueno)!;
    const looks = (b.looks as Look[] | null) ?? [];
    const notas = (b.notas as NotaDeLook[] | null) ?? [];
    for (const [idx, marca] of Object.entries((b.marcas ?? {}) as Record<string, string>)) {
      if (marca !== "arriba" && marca !== "abajo") continue;
      const look = looks[Number(idx)];
      if (!look) continue;
      const raw = b.brief as Record<string, unknown>;
      casos.push({
        dueno,
        look,
        humanoAprueba: marca === "arriba",
        visionActual: notas[Number(idx)]?.vision?.aprobado ?? null,
        textoActual: notas[Number(idx)]?.texto?.aprobado ?? null,
        brief: {
          objective: raw.objective as string,
          workDressCode: (p.work_dress_code as string | null) ?? null,
          veCliente: typeof raw.veCliente === "boolean" ? raw.veCliente : null,
          plan: (raw.plan as string | null) ?? null,
          tipoEvento: (raw.tipoEvento as string | null) ?? null,
          formality: (raw.formality as string | null) ?? null,
          momento: raw.momento as BriefRubrica["momento"],
          weather: raw.weather as BriefRubrica["weather"],
          paraguas: raw.paraguas === true,
          estilo: estiloDelPerfil(p),
          color: colorDelPerfil(p),
        },
      });
    }
  }

  console.log(`Rúbrica de visión ${RUBRICA_VISION_VERSION} · ${casos.length} looks con marca humana`);
  console.log(`Producción: ${VISION_MODEL.etiqueta} · retadores: ${modelos.map((m) => m.etiqueta).join(", ")}\n`);

  // La línea base que ya está en la base, sin volver a pagar nada.
  const base = casos.filter((c) => c.visionActual !== null);
  const aciertosBase = base.filter((c) => c.visionActual === c.humanoAprueba).length;
  const abajos = casos.filter((c) => !c.humanoAprueba);
  const cazaBase = abajos.filter((c) => c.visionActual === false).length;
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "—");
  // Aprobar TODO es la vara honesta: con esta proporción de 👍, un juez que
  // nunca reprueba ya acierta esto. Ganarle por poco no es ganar.
  const siempreAprueba = casos.filter((c) => c.humanoAprueba).length;

  const filas: string[] = [];
  // Y el otro lado de la moneda, que es el que decide si un juez sirve para
  // filtrar: cuántos looks BUENOS rechaza para cazar los malos. Un juez que
  // caza el doble rechazando cinco veces más no es mejor, es más estricto.
  const arribas = casos.filter((c) => c.humanoAprueba);
  const rechazaBuenosBase = arribas.filter((c) => c.visionActual === false).length;
  const linea = (etq: string, ac: number, de: number, caza: number, malRechaza: number) =>
    `  ${etq.padEnd(26)} ${pct(ac, de).padStart(5)}   caza ${caza}/${abajos.length} 👎   rechaza ${malRechaza}/${arribas.length} buenos`;
  filas.push(linea("aprobar todo (vara)", siempreAprueba, casos.length, 0, 0));
  filas.push(
    linea(VISION_MODEL.etiqueta + " (hoy)", aciertosBase, base.length, cazaBase, rechazaBuenosBase)
  );

  let costo = 0;
  for (const modelo of modelos) {
    let aciertos = 0;
    let caza = 0;
    let malRechaza = 0;
    let fallos = 0;
    const cola = [...casos];
    const obrero = async () => {
      for (;;) {
        const c = cola.shift();
        if (!c) return;
        const porId = meta.get(c.dueno)!;
        try {
          const prendas = await Promise.all(
            c.look.item_ids.map(async (id) => {
              const m = porId.get(id);
              return {
                nombre: m?.nombre ?? "Prenda",
                imagen: m?.url ? await comoBase64(m.url) : null,
              };
            })
          );
          const { nota, recibo } = await evaluarLookConVision(
            c.brief,
            {
              nombre: c.look.nombre,
              explicacion: c.look.explicacion,
              tip: c.look.tip ?? null,
              prendas,
            },
            null,
            modelo
          );
          costo += recibo.costoUsd ?? 0;
          if (nota.aprobado === c.humanoAprueba) aciertos++;
          if (!c.humanoAprueba && !nota.aprobado) caza++;
          if (c.humanoAprueba && !nota.aprobado) malRechaza++;
        } catch (e) {
          fallos++;
          if (fallos <= 2) console.error(`  fallo ${modelo.etiqueta}: ${e instanceof Error ? e.message : e}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, obrero));
    const juzgados = casos.length - fallos;
    filas.push(
      linea(modelo.etiqueta, aciertos, juzgados, caza, malRechaza) +
        (fallos ? `   (${fallos} fallos)` : "")
    );
  }

  console.log(`ACUERDO CON EL HUMANO (aprobado sí/no) y COBERTURA DE SUS 👎:\n`);
  filas.forEach((f) => console.log(f));
  console.log(`\ncosto $${costo.toFixed(2)}`);
  console.log(
    `\nCÓMO LEERLO: el acuerdo global engaña porque la mayoría son 👍 — por eso está\n` +
      `la vara de "aprobar todo". Lo que decide es la SEGUNDA columna: cuántos de los\n` +
      `rechazos humanos caza cada modelo. Si nadie sube ahí, el problema no era el\n` +
      `modelo sino la tarea.`
  );
}

main();
