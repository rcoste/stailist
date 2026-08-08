// ¿LA INSTRUCCIÓN NUEVA DEL PROMPT DE VISIÓN MOVIÓ ALGO MÁS?
//
// El cabo suelto de v0.2.155.0: al prompt que lee UNA prenda se le añadió una
// instrucción para que declare si en la foto hay varias. Ese prompt corre en
// cada foto que alguien sube, y añadir texto a un prompt puede mover lecturas
// que no tenían nada que ver.
//
// CÓMO SE MIDE SIN QUE NADIE VOTE — y es el mismo principio del instrumento
// pareado: la misma foto se lee TRES veces.
//
//   A1  prompt nuevo
//   A2  prompt nuevo otra vez   → esto es el RUIDO: cuánto cambia el modelo
//                                 solo, sin que nadie toque nada
//   B   prompt viejo            → esto es la SEÑAL: A1 contra B
//
// Sin A2 el resultado no significa nada: los modelos no son deterministas, y
// dos lecturas del mismo prompt ya difieren un poco. Si señal ≈ ruido, la
// instrucción es inerte y el cabo queda cerrado. Si la señal es claramente
// mayor, el prompt movió algo y hay que mirarlo.
//
// Correr: npx tsx scripts/vision-deriva.ts [n]

import pg from "pg";
import { readFileSync } from "node:fs";
import { llamar } from "../lib/proveedores";
import { SYSTEM_PRENDA, SCHEMA_PRENDA, type PrendaAnalisis } from "../lib/vision-prenda";
import { VISION_MODEL } from "../lib/models";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
) as Record<string, string>;

// El proveedor lee de process.env, no de este objeto: sin esto la llamada
// muere con "falta GOOGLE_GENERATIVE_AI_API_KEY" aunque la clave esté en el
// archivo. No pisa lo que ya venga del entorno real.
for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

// El trozo EXACTO que se añadió. Quitarlo reconstruye el prompt de ayer — es
// más fiable que guardar una copia del prompt viejo, que se desincroniza.
// LO QUE SE MIDIÓ, EN ORDEN, Y LO QUE FUE CEDIENDO:
//
//   70 palabras a mitad del prompt      z ≈ 2.4 (n=67)  · `material` 5 → 14
//   una cláusula corta                  z ≈ 1.8 (n=71)
//   una cláusula, n grande              z ≈ 2.2 (n=196) · `temporada` 3 → 16
//   NADA en el system, sólo el schema   ← lo que se mide ahora
//
// El patrón es el mismo cada vez: tocar el system prompt mueve lecturas que no
// tienen nada que ver, y no importa cuánto se acorte el texto. El schema es
// otra superficie —la descripción va pegada a su campo— así que la versión
// final no toca el system en absoluto. El "viejo" es entonces el MISMO system
// con el schema sin `varias`.
const SYSTEM_VIEJO = SYSTEM_PRENDA;
const SCHEMA_VIEJO = (() => {
  const s = JSON.parse(JSON.stringify(SCHEMA_PRENDA));
  delete s.properties.varias;
  return s as Record<string, unknown>;
})();

/** Los campos que le importan al motor. `varias` NO entra: es lo que cambió. */
const CAMPOS = [
  "categoria",
  "color",
  "formalidad",
  "temporada",
  "material",
  "patron",
  "corte",
  "largo",
  "manga",
  "subtipo",
  "confianza",
] as const;

const norm = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : v === undefined ? "" : String(v);

async function leerCon(
  imagen: { mediaType: string; base64: string },
  system: string,
  schema: Record<string, unknown>
): Promise<PrendaAnalisis> {
  const recibo = await llamar({
    modelo: VISION_MODEL,
    maxTokens: 500,
    system,
    texto: "Describe esta prenda para mi clóset.",
    imagen,
    schema,
  });
  return JSON.parse(recibo.texto) as PrendaAnalisis;
}

async function main() {
  const n = Number(process.argv[2] ?? 12);
  if ((SCHEMA_PRENDA.properties as Record<string, unknown>).varias === undefined) {
    console.error("❌ El schema ya no tiene `varias` — no hay nada que comparar.");
    process.exit(1);
  }

  const c = new pg.Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query(
    // La foto ORIGINAL sólo la conservan 5 prendas en toda la base — el flujo
    // de varias guarda el render y descarta la foto. Se cae al render: es una
    // imagen limpia de UNA prenda real de alguien, que es justo lo que este
    // lector recibe cuando alguien sube una foto buena. Y de paso mide algo
    // extra: sobre imágenes de una sola prenda, `varias` DEBE salir false, así
    // que los falsos positivos se ven solos.
    `select id, coalesce(photo_path, render_path) as photo_path, attrs->>'nombre' as nombre
       from items
      where source='photo' and deleted_at is null
        and coalesce(photo_path, render_path) is not null
      order by random() limit $1`,
    [n]
  );
  await c.end();

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  let ruido = 0;
  let senal = 0;
  let comparaciones = 0;
  const porCampo = new Map<string, { ruido: number; senal: number }>();
  const varias: string[] = [];
  let saltadas = 0;
  let leidas = 0;

  for (const r of rows) {
    const { data } = await sb.storage.from("prendas").createSignedUrl(r.photo_path, 600);
    if (!data?.signedUrl) continue;
    const res = await fetch(data.signedUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const imagen = {
      mediaType: res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
      base64: buf.toString("base64"),
    };

    // Una imagen que el proveedor no digiere (503 "unable to process input
    // image") tiraba la corrida entera y se perdía todo lo medido. Se salta esa
    // prenda y se sigue: la muestra baja en uno, no a cero.
    let a1: PrendaAnalisis, a2: PrendaAnalisis, b: PrendaAnalisis;
    try {
      [a1, a2, b] = await Promise.all([
        leerCon(imagen, SYSTEM_PRENDA, SCHEMA_PRENDA),
        leerCon(imagen, SYSTEM_PRENDA, SCHEMA_PRENDA),
        leerCon(imagen, SYSTEM_VIEJO, SCHEMA_VIEJO),
      ]);
    } catch {
      saltadas++;
      process.stdout.write("x");
      continue;
    }
    if (a1.varias) varias.push(r.nombre ?? r.id);

    for (const campo of CAMPOS) {
      const x = norm((a1 as Record<string, unknown>)[campo]);
      const y = norm((a2 as Record<string, unknown>)[campo]);
      const z = norm((b as Record<string, unknown>)[campo]);
      const acc = porCampo.get(campo) ?? { ruido: 0, senal: 0 };
      if (x !== y) {
        acc.ruido++;
        ruido++;
      }
      if (x !== z) {
        acc.senal++;
        senal++;
      }
      porCampo.set(campo, acc);
      comparaciones++;
    }
    leidas++;
    process.stdout.write(".");
  }

  console.log(`\n\nprendas releídas: ${leidas} (saltadas ${saltadas}) · campos comparados: ${comparaciones}\n`);
  console.log("campo        | ruido (mismo prompt) | señal (prompt viejo)");
  console.log("-------------|----------------------|---------------------");
  for (const campo of CAMPOS) {
    const a = porCampo.get(campo) ?? { ruido: 0, senal: 0 };
    console.log(
      `${campo.padEnd(12)} | ${String(a.ruido).padStart(20)} | ${String(a.senal).padStart(19)}`
    );
  }
  const pRuido = ((ruido / comparaciones) * 100).toFixed(1);
  const pSenal = ((senal / comparaciones) * 100).toFixed(1);
  console.log(`\nTOTAL        | ${pRuido}% | ${pSenal}%`);
  // EL VEREDICTO VA POR z, NO POR UNA RAZÓN A OJO. La versión anterior decía
  // "✅" si señal ≤ ruido × 1.5, y con 402 contra 323 (razón 1.24) cantó verde
  // cuando z era 3.05 — o sea que el umbral casero daba por bueno un efecto
  // claramente real. Un cociente no sabe cuántas observaciones hay detrás.
  const p = (ruido + senal) / (2 * comparaciones);
  const se = Math.sqrt((p * (1 - p) * 2) / comparaciones);
  const z = se > 0 ? (senal - ruido) / comparaciones / se : 0;
  console.log(`(en crudo: ${ruido} de ruido, ${senal} de señal · z = ${z.toFixed(2)})`);
  // EL MÍNIMO NO ES DECORATIVO: con 5 prendas la primera corrida dio 5 contra 7
  // y el script cantó "✅" — un veredicto sobre cinco diferencias no dice nada.
  if (comparaciones < 200) {
    console.log(
      `\n⚠️  Muestra insuficiente (${comparaciones} comparaciones): no se concluye. Sube la n.`
    );
  } else {
    console.log(
      z < 1.96
        ? `\n✅ z = ${z.toFixed(2)} < 1.96: la señal no se distingue del ruido.`
        : `\n⚠️  z = ${z.toFixed(2)} ≥ 1.96: el cambio movió otras lecturas. Mirar la tabla.`
    );
  }
  // Sobre imágenes de UNA prenda, todo 'varias' es un falso positivo.
  console.log(
    `\nfalsos positivos de 'varias' (imágenes de una sola prenda): ${varias.length}/${leidas}`
  );
  if (varias.length) console.log(`  ${varias.slice(0, 8).join(" · ")}`);
}

main();
