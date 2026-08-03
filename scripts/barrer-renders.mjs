// Barre las referencias APROBADAS buscando imágenes generadas por IA.
//
// POR QUÉ EXISTE
// La calibración del filtro v2 (2026-08-03) encontró renders de IA entre las
// fotos ya aprobadas: en una muestra de 30, había 2-3. Se colaron porque el
// filtro v1 no los buscaba y a ojo humano en un swipe rápido pasan. Son veneno
// silencioso para la destilación: una imagen de IA copia la moda real con fits
// idealizados y errores sutiles, y destilar de ahí es aprender de una copia de
// copia — justo cuando el producto mismo genera imágenes.
//
// Prompt DEDICADO solo a esto, a propósito: la detección multi-tarea del
// filtro mostró varianza (una foto salía render en una corrida y foto en
// otra). Un solo juicio con veredicto de tres valores ('foto'/'render'/'duda')
// y solo se mata con 'render' — la duda respeta el juicio humano previo.
//
// NO borra: marca sirve=false, motivo='render-ia'. Recuperable con un update.
//
// Uso: node scripts/barrer-renders.mjs [genero]   (default hombre)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const genero = process.argv[2] ?? "hombre";
const CONCURRENCIA = 6;

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};
process.env.ANTHROPIC_API_KEY = leer("ANTHROPIC_API_KEY");
const cliente = new Anthropic();
const supabase = createClient(leer("NEXT_PUBLIC_SUPABASE_URL"), leer("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const db = new pg.Client({
  connectionString: leer("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const SISTEMA = `Decides si una imagen de moda es una FOTOGRAFÍA REAL o una imagen GENERADA POR IA / render 3D.

Señales de IA/render: piel con textura plástica o demasiado lisa, manos o dientes raros, simetría facial perfecta de maniquí, fondo genérico difuminado sin detalle real, iluminación de estudio virtual imposible, tela sin una sola arruga natural, bordes que se derriten, sombras incoherentes.

Señales de foto real: grano o ruido de cámara, arrugas y caída natural de la tela, fondo con detalle real (gente, letreros, imperfecciones), luz con dirección coherente, poros o textura de piel.

Veredictos:
- "render": estás SEGURO de que es IA o 3D.
- "foto": estás seguro de que es una fotografía real.
- "duda": no puedes decidir. Ante la duda, duda — esta imagen ya la aprobó un humano.`;

const ESQUEMA = {
  type: "object",
  properties: {
    senales: { type: "string", description: "Qué viste que te hizo decidir, en pocas palabras" },
    veredicto: { type: "string", enum: ["foto", "render", "duda"] },
  },
  required: ["senales", "veredicto"],
  additionalProperties: false,
};

async function juzgar(ref) {
  const { data, error } = await supabase.storage.from("referencias").download(ref.path);
  if (error) return { error: error.message };
  const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  const tipo = ref.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await cliente.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: SISTEMA,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: tipo, data: b64 } },
            { type: "text", text: "¿Foto real o generada?" },
          ],
        }],
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
      });
      return JSON.parse(r.content.find((c) => c.type === "text")?.text ?? "{}");
    } catch (e) {
      if (i === 3) return { error: e.message };
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

const { rows } = await db.query(
  `select id, estilo, path from public.referencias
   where genero = $1 and sirve = true order by estilo, path`,
  [genero]
);
console.log(`${rows.length} aprobadas por revisar.\n`);

const renders = [];
let dudas = 0;
let errores = 0;
for (let i = 0; i < rows.length; i += CONCURRENCIA) {
  const lote = rows.slice(i, i + CONCURRENCIA);
  const vs = await Promise.all(lote.map(juzgar));
  for (let j = 0; j < lote.length; j++) {
    const v = vs[j];
    if (v.error) {
      errores++;
      continue;
    }
    if (v.veredicto === "render") renders.push({ ...lote[j], senales: v.senales });
    if (v.veredicto === "duda") dudas++;
  }
  process.stdout.write(`\r${Math.min(i + CONCURRENCIA, rows.length)} de ${rows.length}`);
}
console.log("\n");

if (renders.length) {
  await db.query(
    `update public.referencias set sirve = false, motivo = 'render-ia'
     where id = any($1::uuid[])`,
    [renders.map((r) => r.id)]
  );
  for (const r of renders) console.log(`  ✗ ${r.path} — ${r.senales}`);
}
console.log(`\n${renders.length} renders marcados, ${dudas} dudas (se quedan), ${errores} errores.`);
await db.end();
