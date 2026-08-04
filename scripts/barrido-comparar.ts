// Compara dos corridas del barrido: ¿el cambio del prompt mejoró algo?
//
// POR QUÉ EXISTE
// El piso de formalidad (v31) se shippeó sin poder decir si servía, porque no
// había con qué comparar: el "32% de fallo" que lo motivó resultó ser un bug del
// arnés, y cuando se arregló la línea base real era 11%. Un cambio de prompt sin
// antes y después es fe, no ingeniería.
//
// Los casos son deterministas (misma semilla → mismo clóset, mismo perfil), así
// que las dos corridas son comparables caso por caso. Lo que NO es determinista
// es el modelo: una diferencia de uno o dos casos es ruido, no señal. Por eso el
// reporte muestra el conteo crudo y no un porcentaje de mejora — un "+40% mejor"
// sobre dos casos de cincuenta se lee como un resultado y no lo es.
//
// Uso:
//   npx tsx scripts/barrido-comparar.ts <antes.json> <despues.json>
//   npx tsx scripts/barrido-comparar.ts --ab docs_para_claude/barrido/ab.json
//
// La forma --ab lee UN archivo con los dos brazos dentro (los que produce
// barrido-correr.ts --ab) y los separa por el campo `brazo`. Es la forma buena:
// mismo modelo, misma corrida, mismo clóset — la única diferencia es el cambio
// que se está midiendo.

import { readFileSync } from "node:fs";

type Veredicto = {
  cumple_silueta: boolean;
  cumple_paleta: boolean;
  respeta_clima: boolean;
  respeta_ocasion: boolean;
  color_near_face_ok: boolean;
  vetos_de_receta_rotos: string[];
  fallo_principal: string;
};
type Fila = {
  caso: { perfil: string; closet: string; clima: { id: string }; ocasion: string; paleta: string };
  look?: string;
  prendas?: string[];
  ejecucion?: { regla: string }[];
  veredicto?: Veredicto | null;
  error?: string;
  /** Solo en corridas --ab: "con-marca" | "sin-marca". */
  brazo?: string;
};

const DIMENSIONES: [keyof Veredicto, string][] = [
  ["cumple_silueta", "silueta"],
  ["cumple_paleta", "paleta del estilo"],
  ["respeta_clima", "clima"],
  ["respeta_ocasion", "ocasión"],
  ["color_near_face_ok", "color cerca de la cara"],
];

const leer = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Fila[];

/** Los fallos de una fila, como etiquetas. Sin veredicto (error/truncado) = null. */
function fallosDe(f: Fila): string[] | null {
  if (f.error || !f.veredicto) return null;
  const out = DIMENSIONES.filter(([k]) => f.veredicto![k] === false).map(([, n]) => n);
  if (f.veredicto.vetos_de_receta_rotos?.length) out.push("veto de la receta");
  for (const e of f.ejecucion ?? []) out.push(`regla: ${e.regla}`);
  return out;
}

/**
 * La identidad de un caso. OJO: cada caso produce 2-3 LOOKS, así que esta clave
 * identifica un grupo de filas, no una fila. Confundirlas fue el primer error al
 * escribir esto: un Map por clave se queda con el último look del caso y tira
 * los otros dos, y la comparación acaba midiendo un tercio de los datos.
 */
const clave = (f: Fila) =>
  `${f.caso.perfil}|${f.caso.closet}|${f.caso.clima.id}|${f.caso.ocasion}|${f.caso.paleta}`;

/**
 * Solo los casos presentes en LAS DOS corridas.
 *
 * Sin esto se comparan muestras distintas: la corrida base fue de 17 casos y la
 * nueva de 50, y el agregado crudo dice "el doble de fallos" cuando lo que hay
 * es el triple de looks. Comparar tamaños distintos es la forma más fácil de
 * fabricar un resultado.
 */
function comunes(a: Fila[], b: Fila[]): Set<string> {
  const ka = new Set(a.map(clave));
  return new Set(b.map(clave).filter((k) => ka.has(k)));
}

function resumen(filas: Fila[], etiqueta: string) {
  const juzgados = filas.filter((f) => fallosDe(f) !== null);
  const conFallo = juzgados.filter((f) => fallosDe(f)!.length > 0);
  const porTipo = new Map<string, number>();
  for (const f of juzgados) for (const x of fallosDe(f)!) porTipo.set(x, (porTipo.get(x) ?? 0) + 1);
  const casos = new Set(filas.map(clave)).size;
  const pct = juzgados.length ? Math.round((conFallo.length / juzgados.length) * 100) : 0;
  const fallosPorLook = juzgados.length
    ? (juzgados.reduce((s, f) => s + fallosDe(f)!.length, 0) / juzgados.length).toFixed(2)
    : "0";
  console.log(
    `${etiqueta}: ${casos} casos · ${juzgados.length} looks juzgados · ${conFallo.length} marcados (${pct}%) · ${fallosPorLook} fallos por look`
  );
  return { juzgados, conFallo, porTipo, pct };
}

function main() {
  const args = process.argv.slice(2);
  let antesTodo: Fila[];
  let despuesTodo: Fila[];

  const esAb = args[0] === "--ab";
  if (esAb) {
    const todo = leer(args[1]);
    antesTodo = todo.filter((f) => f.brazo === "sin-marca");
    despuesTodo = todo.filter((f) => f.brazo === "con-marca");
    if (!antesTodo.length || !despuesTodo.length) {
      console.error("Ese archivo no trae los dos brazos. ¿Se corrió con --ab?");
      process.exit(1);
    }
  } else {
    const [antesPath, despuesPath] = args;
    if (!antesPath || !despuesPath) {
      console.error("Uso: barrido-comparar.ts <antes.json> <despues.json> | --ab <ab.json>");
      process.exit(1);
    }
    antesTodo = leer(antesPath);
    despuesTodo = leer(despuesPath);
  }

  // Restringir a los casos que existen en ambas: es lo único comparable.
  const comun = comunes(antesTodo, despuesTodo);
  const antes = antesTodo.filter((f) => comun.has(clave(f)));
  const despues = despuesTodo.filter((f) => comun.has(clave(f)));

  console.log("═".repeat(78));
  console.log(
    `Corridas completas: ${new Set(antesTodo.map(clave)).size} casos vs ${new Set(despuesTodo.map(clave)).size} casos.` +
      ` Se comparan los ${comun.size} en común.`
  );
  console.log("═".repeat(78));
  const a = resumen(antes, esAb ? "SIN marca" : "ANTES   ");
  const d = resumen(despues, esAb ? "CON marca" : "DESPUÉS ");
  console.log("═".repeat(78));

  // Los tipos se normalizan a fallos POR LOOK: si una corrida tiene más looks
  // que la otra (el modelo no siempre devuelve 3), el conteo crudo miente.
  console.log("\nPOR TIPO DE FALLO (por cada 100 looks juzgados):");
  const nA = a.juzgados.length || 1;
  const nD = d.juzgados.length || 1;
  const tipos = [...new Set([...a.porTipo.keys(), ...d.porTipo.keys()])].sort();
  for (const t of tipos) {
    const x = Math.round(((a.porTipo.get(t) ?? 0) / nA) * 100);
    const y = Math.round(((d.porTipo.get(t) ?? 0) / nD) * 100);
    const delta = y - x;
    const flecha = delta < -3 ? "↓ mejor" : delta > 3 ? "↑ peor" : "≈ igual";
    console.log(
      `  ${t.padEnd(26)} ${String(x).padStart(3)} → ${String(y).padStart(3)}   ${flecha}`
    );
  }

  // Caso por caso, promediando sus looks: el agregado puede quedarse igual
  // mientras la mitad de los casos mejora y la otra empeora — y eso no es "sin
  // efecto", es un cambio que mueve cosas sin arreglar ninguna.
  const media = (filas: Fila[]) => {
    const j = filas.map(fallosDe).filter((x): x is string[] => x !== null);
    return j.length ? j.reduce((s, x) => s + x.length, 0) / j.length : null;
  };
  const porCaso = (filas: Fila[]) => {
    const m = new Map<string, Fila[]>();
    for (const f of filas) m.set(clave(f), [...(m.get(clave(f)) ?? []), f]);
    return m;
  };
  const ca = porCaso(antes);
  const cd = porCaso(despues);
  let mejor = 0;
  let peor = 0;
  let igual = 0;
  const cambios: string[] = [];
  for (const k of comun) {
    const x = media(ca.get(k) ?? []);
    const y = media(cd.get(k) ?? []);
    if (x === null || y === null) continue;
    if (y < x - 0.01) {
      mejor++;
      cambios.push(`  ✓ ${k}\n      ${x.toFixed(2)} → ${y.toFixed(2)} fallos por look`);
    } else if (y > x + 0.01) {
      peor++;
      cambios.push(`  ✗ ${k}\n      ${x.toFixed(2)} → ${y.toFixed(2)} fallos por look`);
    } else igual++;
  }
  console.log(`\nCASO POR CASO (promedio de sus looks): ${mejor} mejoraron · ${peor} empeoraron · ${igual} igual`);
  if (cambios.length) console.log(cambios.join("\n"));
  console.log(
    `\nOJO: ${comun.size} casos es una muestra chica y el modelo no es determinista.` +
      ` Una diferencia de uno o dos casos es ruido; lo que vale la pena leer es la tasa global y los tipos de fallo.`
  );
}

main();
