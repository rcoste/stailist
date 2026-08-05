// Arma los pares CIEGOS del A/B para que Roberto los juzgue.
//
// POR QUÉ ESTO Y NO LA IA REVISORA
// La revisora se equivocó en al menos uno de los looks que Roberto revisó (dijo
// "tenis voluminosos" donde había sandalias de cuero) y él la calificó par por
// par: 21 acertó / 4 exageró. Acierta el 84%, o sea que sirve para rastrear
// tendencias pero no para decidir si una versión del motor es mejor que otra.
// Esa decisión pide el ojo humano, y el humano tiene que juzgar sin saber cuál
// es cuál.
//
// EL SORTEO DEL LADO
// Cada par pone un brazo a la izquierda y el otro a la derecha, sorteado. Sin
// eso, el juez nota a los tres pares que el lado izquierdo siempre es el nuevo y
// a partir de ahí ya no está juzgando looks. El sorteo es determinista (semilla
// fija) para que la pantalla no baile entre recargas: si el orden cambiara al
// recargar, un veredicto ya escrito pasaría a apuntar al lado contrario.
//
// UN LOOK POR BRAZO
// Cada caso produjo 2-3 looks por brazo. Comparar "los tres contra los tres" es
// una pregunta difusa; se toma el PRIMERO de cada uno, que es el que la app le
// enseñaría primero a la persona. Es la comparación que se parece al uso real.
//
// LAS IMÁGENES NO SE GUARDAN AQUÍ
// Solo los ids. Las fotos del clóset propio viven en un bucket privado y sus
// URLs caducan en una hora: guardarlas en el JSON daría una pantalla que
// funciona hoy y sale en blanco mañana. La página las firma al renderizar.
//
// Uso: npx tsx scripts/ab-pares.ts [--roberto]
// Salida: lib/engine/barrido/ab-pares.json (para la pantalla, SIN el brazo)
//         docs_para_claude/barrido/ab-clave.json (la clave, para analizar)

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const ROBERTO =
  process.argv.includes("--roberto") ||
  process.argv.includes("--julio") ||
  process.argv.includes("--inspo") ||
  process.argv.includes("--blueprint");

type Fila = {
  caso: Record<string, unknown>;
  brazo?: string;
  look?: string;
  explicacion?: string;
  item_ids?: string[];
  prendas?: string[];
  error?: string;
};

// mulberry32: el mismo generador con semilla del resto del arnés. Determinista a
// propósito (ver cabecera).
function rng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const claveCaso = (f: Fila) =>
  ROBERTO
    // El `n` entra a la clave cuando el arnés lo trae: el A/B del blueprint
    // corre 20 días de diario templado y las temperaturas se repiten, así que
    // sin él dos casos distintos colapsaban en uno y se perdía la mitad de los
    // pares. Los arneses viejos no traen `n` y siguen agrupando igual.
    ? `${f.caso.n ?? ""}|${f.caso.ocasion}|${f.caso.temp}|${f.caso.momento}`
    : [f.caso.perfil, f.caso.closet, (f.caso.clima as { id: string })?.id, f.caso.ocasion, f.caso.paleta].join("|");

async function main() {
  // --julio: el A/B de verdad (motor de julio contra el de hoy). --roberto: el
  // anterior, que comparaba hoy contra hoy-sin-recetario y por eso no contestaba
  // la pregunta. El sintético queda de default.
  const archivo = process.argv.includes("--blueprint")
    ? "docs_para_claude/barrido/ab-blueprint.json"
    : process.argv.includes("--inspo")
    ? "docs_para_claude/barrido/ab-inspiracion.json"
    : process.argv.includes("--julio")
    ? "docs_para_claude/barrido/ab-julio-vs-hoy.json"
    : ROBERTO
      ? "docs_para_claude/barrido/ab-roberto.json"
      : "docs_para_claude/barrido/ab-recetario.json";
  const todo = JSON.parse(readFileSync(archivo, "utf8")) as Fila[];

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: cat } = await s.from("archetypes").select("name,image_path");
  const fotoCatalogo = new Map((cat ?? []).map((c) => [c.name as string, c.image_path as string]));

  // El primer look de cada brazo, por caso.
  const primero = new Map<string, Fila>();
  for (const f of todo) {
    if (f.error || !f.prendas?.length) continue;
    const k = `${claveCaso(f)}::${f.brazo}`;
    if (!primero.has(k)) primero.set(k, f);
  }

  const casos = [...new Set(todo.map(claveCaso))];
  const r = rng(20260804 + (process.argv.includes("--julio") ? 77 : 0) + (process.argv.includes("--inspo") ? 155 : 0) + (process.argv.includes("--blueprint") ? 311 : 0));
  const pares: unknown[] = [];
  const claves: unknown[] = [];

  for (const k of casos) {
    const con = primero.get(`${k}::con-marca`);
    const sin = primero.get(`${k}::sin-marca`);
    // Si a un caso le faltó un brazo (error o truncado) no hay comparación
    // posible: se salta en vez de emparejarlo con otra cosa.
    if (!con || !sin) continue;

    const n = pares.length + 1;
    const conALaIzquierda = r() < 0.5;
    const izq = conALaIzquierda ? con : sin;
    const der = conALaIzquierda ? sin : con;
    const c = con.caso;

    const lado = (f: Fila) => ({
      titulo: f.look ?? "",
      explicacion: f.explicacion ?? "",
      // En el modo Roberto van los ids (la página firma sus fotos); en el
      // sintético van los nombres del catálogo, que sí son públicos.
      itemIds: ROBERTO ? (f.item_ids ?? []) : [],
      prendas: (f.prendas ?? []).map((p) => ({
        nombre: p,
        foto: ROBERTO ? null : (fotoCatalogo.get(p) ?? null),
      })),
    });

    pares.push({
      n,
      ctx: ROBERTO
        ? {
            perfil: "tu perfil real",
            closet: "tu clóset (127 prendas)",
            temp: c.temp,
            ocasion: c.ocasion,
            momento: c.momento,
            paleta: "invierno con flow a otoño",
          }
        : {
            perfil: c.perfil,
            closet: c.closet,
            clima: (c.clima as { id: string })?.id,
            temp: (c.clima as { weather: { temp_c: number } })?.weather?.temp_c,
            ocasion: c.ocasion,
            paleta: c.paleta,
          },
      izq: lado(izq),
      der: lado(der),
    });
    claves.push({ n, izq: conALaIzquierda ? "con-recetario" : "sin-recetario", caso: k });
  }

  // El archivo de la pantalla NO lleva el brazo. La clave vive aparte y fuera
  // del bundle: si viajara junta, bastaría abrir el código fuente de la página
  // para romper el ciego.
  writeFileSync("lib/engine/barrido/ab-pares.json", JSON.stringify({ pares }, null, 1));
  writeFileSync("docs_para_claude/barrido/ab-clave.json", JSON.stringify(claves, null, 1));
  console.log(`${pares.length} pares → lib/engine/barrido/ab-pares.json`);
  console.log(`clave (NO abrir antes de juzgar) → docs_para_claude/barrido/ab-clave.json`);
}

main();
