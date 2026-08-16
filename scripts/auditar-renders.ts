// AUDITORÍA DE RENDERS: ¿la imagen dice lo mismo que los atributos?
//
// POR QUÉ EXISTE. Hasta v0.2.244.0 la descripción que recibía el generador de
// imágenes no llevaba el patrón, así que el modelo lo rellenaba: el pantalón
// gris LISO de Roberto salió con príncipe de Gales y su saco de traje con un
// pañuelo de bolsillo. El arreglo aplica de aquí en adelante — pero quedaron
// cientos de renders viejos dibujados a ciegas.
//
// LA TENTACIÓN ERA REGENERARLOS TODOS, y es mala idea: no sabemos cuántos están
// mal (sabemos de dos), la generación NO es determinista —una imagen que hoy
// está bien puede volver peor— y regenerar cuesta bastante más que mirar. Así
// que primero se mide: la visión lee cada render y dice qué patrón VE, y eso se
// compara con lo que la prenda DICE tener. El resultado es una lista de nombres
// en vez de una sospecha.
//
// Cuesta ~$0.0017 por prenda (Gemini 3.1 Flash-Lite, el mismo que ya lee la
// ropa). Auditar entero sale en menos de un dólar; regenerar entero, no.
//
// Uso:  npx tsx scripts/auditar-renders.ts [límite]
//       npx tsx scripts/auditar-renders.ts 20     ← prueba barata primero
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

import { llamar, parsearJson } from "../lib/proveedores";
import { VISION_MODEL } from "../lib/models";

/** Los patrones del vocabulario de la app (components/prenda-campos.tsx). */
const PATRONES = ["liso", "rayas", "cuadros", "estampado", "floral", "grafico", "animal-print"];

const SYSTEM =
  "Eres un lector de catálogo de ropa. Miras UNA foto de producto y respondes SOLO lo que ves, sin suponer.";

const SCHEMA = {
  type: "object",
  properties: {
    patron: { type: "string", enum: PATRONES },
    seguro: { type: "boolean" },
  },
  required: ["patron", "seguro"],
  additionalProperties: false,
};

const PREGUNTA =
  "¿Qué patrón tiene la tela de esta prenda?\n" +
  "· 'liso' = un solo color, sin dibujo (un jaspeado o mezcla de hilo MUY sutil sigue siendo liso).\n" +
  "· 'cuadros' incluye príncipe de Gales, tartán, ventana y pata de gallo.\n" +
  "· 'rayas' incluye la raya diplomática fina.\n" +
  "Responde `seguro: false` si la foto no deja verlo con claridad.";

type Fila = {
  id: string;
  nombre: string;
  email: string;
  patronDicho: string;
  path: string;
};

async function main() {
  const limite = Number(process.argv[2] ?? 0);
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Sólo las que tienen render GENERADO por nosotros: una foto propia no la
  // dibujó ningún modelo y no puede haber inventado nada.
  const { data, error } = await s
    .from("items")
    .select("id, render_path, attrs, user_id, profiles(email)")
    .eq("render_status", "done")
    .is("deleted_at", null)
    .not("render_path", "is", null);
  if (error) throw new Error(`no pude leer las prendas: ${error.message}`);

  const filas: Fila[] = [];
  for (const it of data ?? []) {
    const attrs = (it.attrs ?? {}) as { nombre?: string; patron?: string };
    if (!attrs.patron || !PATRONES.includes(attrs.patron)) continue;
    filas.push({
      id: it.id as string,
      nombre: attrs.nombre ?? "(sin nombre)",
      email: ((it.profiles as { email?: string } | null)?.email ?? "?").split("@")[0],
      patronDicho: attrs.patron,
      path: it.render_path as string,
    });
  }
  const lote = limite > 0 ? filas.slice(0, limite) : filas;
  console.log(`Auditando ${lote.length} renders (de ${filas.length} con patrón declarado)\n`);

  const desacuerdos: (Fila & { patronVisto: string })[] = [];
  const inseguras: Fila[] = [];
  let ok = 0,
    fallos = 0,
    costo = 0;

  // De a 6: la visión aguanta y una auditoría secuencial de 300 tardaría 15 min.
  const CONCURRENCIA = 6;
  for (let i = 0; i < lote.length; i += CONCURRENCIA) {
    await Promise.all(
      lote.slice(i, i + CONCURRENCIA).map(async (f) => {
        try {
          const { data: blob } = await s.storage.from("prendas").download(f.path);
          if (!blob) throw new Error("no bajó la imagen");
          const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
          const r = await llamar({
            modelo: VISION_MODEL,
            system: SYSTEM,
            texto: PREGUNTA,
            imagen: { mediaType: blob.type || "image/jpeg", base64 },
            schema: SCHEMA,
            maxTokens: 200,
          });
          costo += r.costoUsd ?? 0;
          const v = parsearJson<{ patron: string; seguro: boolean }>(r.texto);
          if (!v.seguro) {
            inseguras.push(f);
            return;
          }
          if (v.patron !== f.patronDicho) desacuerdos.push({ ...f, patronVisto: v.patron });
          else ok++;
        } catch (e) {
          // NUNCA en silencio: un fallo de lectura no es un acuerdo.
          fallos++;
          console.error(`  ✗ ${f.nombre}: ${e instanceof Error ? e.message : e}`);
        }
      })
    );
    process.stdout.write(`\r  ${Math.min(i + CONCURRENCIA, lote.length)}/${lote.length}`);
  }

  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`de acuerdo:   ${ok}`);
  console.log(`NO coinciden: ${desacuerdos.length}`);
  console.log(`sin certeza:  ${inseguras.length}`);
  console.log(`fallos:       ${fallos}`);
  console.log(`costo:        $${costo.toFixed(3)}`);

  if (desacuerdos.length) {
    console.log(`\nLos renders que NO dicen lo que la prenda dice:\n`);
    // El caso que motivó todo va primero: dice liso y se dibujó con patrón.
    const inventados = desacuerdos.filter((d) => d.patronDicho === "liso");
    const perdidos = desacuerdos.filter((d) => d.patronDicho !== "liso");
    for (const d of inventados)
      console.log(`  INVENTÓ patrón  ${d.email.padEnd(12)} "${d.nombre}" → ve ${d.patronVisto}`);
    for (const d of perdidos)
      console.log(`  PERDIÓ patrón   ${d.email.padEnd(12)} "${d.nombre}" dice ${d.patronDicho} → ve ${d.patronVisto}`);
  }

  const salida = process.env.OUT;
  if (salida) {
    writeFileSync(salida, JSON.stringify({ desacuerdos, inseguras, ok, fallos, costo }, null, 2));
    console.log(`\nDetalle en ${salida}`);
  }
}

main();
