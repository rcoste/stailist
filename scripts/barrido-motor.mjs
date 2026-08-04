// Barrido del motor: generar N looks contra perfiles y clósets distintos, y
// medir en qué falla — por FRECUENCIA, no por lo que alguien alcanzó a ver.
//
// EL PROBLEMA QUE RESUELVE
// Las tres reglas de ejecución que existen salieron de un 👎 de Roberto sobre
// uno de cinco looks. Eso es cobertura azarosa: encontramos lo que casualmente
// le tocó. Un fallo que pasa el 15% de las veces puede no aparecer en cinco
// looks y arruinar uno de cada siete a una persona real.
//
// LOS GUSTOS SE SIMULAN CON SWIPES, NO CON TAGS
// No se le escriben tags al motor a mano: se simulan los ❤️ del deck y se pasan
// por computeTasteTags REAL. Así el barrido prueba la tubería completa —deck →
// tags → familia → receta— y no solo su segunda mitad. Si el puente entre las
// cartas y las familias se rompe, el barrido lo ve; si arrancara desde los tags,
// no.
//
// LOS CLÓSETS, Y POR QUÉ UNO ES HOSTIL
// - basicos: el checklist de 15, que es con lo que arranca TODA la persona nueva
//   y por lo tanto el caso más importante, no el menos.
// - completo: ~60 prendas, un clóset ya poblado.
// - hostil: SIN las prendas que las recetas piden (sin oxford para preppy, sin
//   abrigo para el frío). Mide la pregunta incómoda: ¿la receta se adapta a lo
//   que hay, o empuja hacia prendas que no existen y saca un look a medias?
//
// EVALUACIÓN EN DOS CAPAS
// 1. Reglas de ejecución (determinista, gratis) sobre los N looks.
// 2. Un juez que compara cada look contra la receta de SU familia: silueta,
//    paleta, vetos de la receta, y color cerca de la cara contra su
//    colorimetría. Devuelve veredicto estructurado.
//
// La salida es una tabla ordenada por frecuencia y un JSON con cada caso y su
// contexto, para poder depurar de dónde salió.
//
// Uso:  node scripts/barrido-motor.mjs [--n=50] [--dry]
// Salida: docs_para_claude/barrido/<fecha>.json + resumen en consola

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const N = Number((process.argv.find((a) => a.startsWith("--n=")) ?? "--n=50").slice(4));
const DRY = process.argv.includes("--dry");
const SALIDA = "docs_para_claude/barrido";

// ── Perfiles: qué cartas palomea cada uno ────────────────────────────────────
// Nombres de cartas reales del deck (lib/looks.ts). El último es a propósito
// incoherente: en la vida real mucha gente palomea de todo, y ese es el caso
// que más estresa la selección de receta (¿cuál gana cuando hay señal para
// cinco familias?).
export const PERFILES = [
  { id: "preppy-puro", likes: ["preppy", "nautico", "academia", "clasico-elegante"] },
  { id: "minimalista", likes: ["minimalista", "monocromatico", "coreano"] },
  { id: "street", likes: ["streetwear", "y2k", "edgy", "grunge"] },
  { id: "deportivo", likes: ["athleisure", "gorpcore", "utility"] },
  { id: "clasico-arreglado", likes: ["smart-casual", "clasico-elegante", "sastre"] },
  { id: "caotico", likes: ["preppy", "streetwear", "sastre", "boho", "athleisure", "vintage"] },
];

// ── Contextos ────────────────────────────────────────────────────────────────
export const CLIMAS = [
  { id: "frio", weather: { temp_c: 8, condition: "nublado" } },
  { id: "templado", weather: { temp_c: 22, condition: "despejado" } },
  { id: "calor", weather: { temp_c: 30, condition: "soleado" } },
];
export const OCASIONES = ["diario", "oficina", "evento de noche"];
// Las dos fronteras de Roberto: invierno (frío) y otoño (cálido). Si la
// colorimetría manda sobre la paleta del estilo, un mismo gusto tiene que
// producir looks de color distinto entre estas dos.
export const PALETAS = ["invierno", "otono"];

/**
 * Muestra equilibrada del producto cartesiano.
 *
 * No es aleatoria: con 324 combinaciones y una muestra de 50 al azar, alguna
 * dimensión queda con dos casos y el "8 de 50" de esa fila no significa nada.
 * Recorrer los ejes con índices desfasados garantiza que cada valor de cada
 * dimensión aparezca ~N/|dimensión| veces.
 */
export function muestra(n, ejes) {
  const [perfiles, closets, climas, ocasiones, paletas] = ejes;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      perfil: perfiles[i % perfiles.length],
      closet: closets[Math.floor(i / perfiles.length) % closets.length],
      clima: climas[i % climas.length],
      ocasion: ocasiones[Math.floor(i / climas.length) % ocasiones.length],
      paleta: paletas[i % paletas.length],
    });
  }
  return out;
}

if (DRY) {
  const casos = muestra(N, [
    PERFILES.map((p) => p.id),
    ["basicos", "completo", "hostil"],
    CLIMAS.map((c) => c.id),
    OCASIONES,
    PALETAS,
  ]);
  const cuenta = (k) =>
    Object.entries(
      casos.reduce((a, c) => ({ ...a, [c[k]]: (a[c[k]] ?? 0) + 1 }), {})
    )
      .map(([v, n]) => `${v}:${n}`)
      .join("  ");
  console.log(`Muestra de ${N} casos. Cobertura por dimensión:\n`);
  for (const k of ["perfil", "closet", "clima", "ocasion", "paleta"]) {
    console.log(`  ${k.padEnd(9)} ${cuenta(k)}`);
  }
  console.log("\n(--dry: solo el plan de muestreo, no se generó nada.)");
  process.exit(0);
}

mkdirSync(SALIDA, { recursive: true });
console.log(
  "El barrido completo necesita el motor y la API; este archivo trae el plan de\n" +
    "muestreo y los perfiles. Corre con --dry para ver la cobertura."
);
