// Condensa la salida del barrido a lo que necesita la pantalla de revisión.
//
// POR QUÉ UN PASO APARTE
// El JSON del barrido guarda todo el contexto de cada caso para poder depurar,
// pero la pantalla solo necesita: qué prendas (con su foto), en qué contexto, y
// qué dijeron el juez y las reglas. Meter el archivo entero al bundle sería
// cargar 40 KB de datos que nadie mira.
//
// Y sobre todo: el resultado del barrido vive en docs_para_claude/, que está
// fuera de git — en producción ese archivo no existe. Este paso lo mete al repo
// como dato de la pantalla.
//
// ORDEN: primero lo marcado. La atención de quien revisa es el recurso caro del
// experimento, y se gasta donde hay algo que juzgar. Lo limpio va al final, de
// contexto.
//
// Uso: npx tsx scripts/barrido-a-revision.ts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

type Entrada = {
  caso: { perfil: string; closet: string; clima: { id: string }; ocasion: string; paleta: string };
  look: string;
  prendas: string[];
  ejecucion: { regla: string; detalle: string }[];
  veredicto: Record<string, unknown> | null;
  error?: string;
};

const crudo = JSON.parse(
  readFileSync("docs_para_claude/barrido/ultimo.json", "utf8")
) as Entrada[];

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
async function main() {
const { data: cat } = await s.from("archetypes").select("name,image_path");
const foto = new Map((cat ?? []).map((c) => [c.name as string, c.image_path as string]));

const fallos = (e: Entrada) => {
  const f: string[] = [];
  const v = e.veredicto;
  if (v?.cumple_silueta === false) f.push("silueta");
  if (v?.cumple_paleta === false) f.push("paleta del estilo");
  if (v?.respeta_clima === false) f.push("clima");
  if (v?.respeta_ocasion === false) f.push("ocasión");
  if (v?.color_near_face_ok === false) f.push("color cerca de la cara");
  if ((v?.vetos_de_receta_rotos as string[])?.length) f.push("veto de la receta");
  e.ejecucion?.forEach((x) => f.push(`regla: ${x.regla}`));
  return f;
};

const looks = crudo
  .filter((e) => e.ejecucion)
  .map((e, i) => ({
    n: i + 1,
    titulo: e.look,
    contexto: `${e.caso.perfil} · ${e.caso.closet} · ${e.caso.clima.id} · ${e.caso.ocasion} · ${e.caso.paleta}`,
    prendas: e.prendas.map((p) => ({ nombre: p, foto: foto.get(p) ?? null })),
    fallos: fallos(e),
    // La frase del juez: es lo que hay que juzgar, no solo la etiqueta.
    diagnostico: (e.veredicto?.fallo_principal as string) ?? "",
    vetos: (e.veredicto?.vetos_de_receta_rotos as string[]) ?? [],
  }))
  // Lo marcado primero: ahí es donde el ojo humano decide si el juez acertó.
  .sort((a, b) => b.fallos.length - a.fallos.length);

mkdirSync("lib/engine/barrido", { recursive: true });
writeFileSync("lib/engine/barrido/revision.json", JSON.stringify({ looks }, null, 1));
console.log(
  `${looks.length} looks → lib/engine/barrido/revision.json ` +
    `(${looks.filter((l) => l.fallos.length).length} con algo marcado)`
);
}

main();
