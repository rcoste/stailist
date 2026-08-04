// Cómo se lleva de verdad cada estilo — destilado de fotos reales de calle.
//
// EL PROBLEMA QUE RESUELVE
// Hasta v24 el motor recibía los gustos de la clienta como palabras sueltas:
//   "Tags de gusto (en orden de fuerza): pulido, clasico, elegante."
// …y nada más. En 432 líneas de prompt había UNA que hablaba de estilos, y era
// genérica ("si es minimalista, evita mezclar demasiados elementos"). O sea: el
// modelo improvisaba qué significa cada palabra. Describir un estilo con
// adjetivos produce outfits aguados, porque los adjetivos se pueden cumplir sin
// que el look funcione: lo que hace que un outfit se lea bien son cosas
// concretas y chiquitas —el nudo de la camisa, el peso del zapato, cuántos
// colores hay— que ningún adjetivo obliga.
//
// DE DÓNDE SALE (v2, taxonomía de 10 familias)
// De 616 fotos de calle aprobadas a mano: cosechadas de Pinterest e Instagram
// con búsquedas GENÉRICAS (buscar "smart casual WIDE TROUSERS" busca las
// prendas que uno ya decidió que son el estilo, y las fotos nunca pueden
// contradecir la hipótesis), filtradas por visión (formato, ejecución 0-10,
// registro, renders de IA) y curadas foto por foto en /admin/destilador.
// Lo que la destilación anota es lo que SE REPITE, no lo que le gusta a quien
// destila: si 14 de 20 fotos traen pantalón claro de pinzas, ese patrón es del
// estilo. Los JSON los escribe scripts/destilar-familia.mjs y cada receta pasó
// una prueba de reconstrucción (regenerar el look SOLO desde el texto — ver
// /admin/recetas) antes de llegar aquí.
//
// La v1 de este archivo tenía 3 recetas escritas a mano (smart-casual,
// clásico-elegante, minimalista) sobre la taxonomía vieja. Dos de esos estilos
// ya ni existen como categorías —se fusionaron en clásico-arreglado— y ninguna
// receta sabía de clima. Esta versión las reemplaza completas.
//
// EL PUENTE CARTAS → FAMILIAS ("el deck mide, el destilador genera")
// El deck del swipe tiene ~27 cartas porque medir gusto pide grano fino
// (streetwear y Y2K se sienten distintos al deslizar); pero generar pide
// vocabulario de prendas, y ahí Y2K es street-urbano con otro pantalón. Cada
// carta pertenece a UNA familia generable; los ❤️ del swipe se convierten en
// tags (computeTasteTags), los tags puntúan cartas, y la familia hereda el
// mejor score de sus cartas. Las cartas de ATRIBUTO (tonos-tierra,
// color-protagonista) y las women-only sin familia masculina (coquette,
// romantico, de-salir) no apuntan a ninguna familia a propósito: miden una
// dimensión (paleta, silueta), no un estilo generable.
//
// EL CLIMA (lo nuevo de v2)
// Cada fórmula declara para qué clima es. Sin eso, el muestreo plano nos puso
// un cuello de tortuga en el look "templado" y un saquito sin abrigo en el de
// "frío": el material de referencia es mayormente templado y el modelo no
// tenía cómo saber qué fórmula aguanta 8°C. Ahora el prompt solo recibe las
// fórmulas de la banda de temperatura del día, y en frío recibe además la
// sección "cómo abriga" — que se destila aparte porque abrigar es una pregunta
// acotada (qué capa, qué material), no un estilo distinto.

import type { Weather } from "@/lib/weather";
import { LOOKS } from "@/lib/looks";

// Los JSON de la destilación, importados ESTÁTICOS (un import dinámico con
// template string funciona en dev pero el bundler de producción no puede
// resolver una ruta que solo existe en runtime — ya nos pasó en /admin/recetas).
import casualLimpio from "@/lib/engine/recetas/casual-limpio.json";
import clasicoArreglado from "@/lib/engine/recetas/clasico-arreglado.json";
import deportivo from "@/lib/engine/recetas/deportivo.json";
import edgy from "@/lib/engine/recetas/edgy.json";
import preppy from "@/lib/engine/recetas/preppy.json";
import resortBoho from "@/lib/engine/recetas/resort-boho.json";
import sastre from "@/lib/engine/recetas/sastre.json";
import streetUrbano from "@/lib/engine/recetas/street-urbano.json";
import thriftVintage from "@/lib/engine/recetas/thrift-vintage.json";
import utilitario from "@/lib/engine/recetas/utilitario.json";

export type Clima = "calor" | "templado" | "frio";

export type Receta = {
  /** El id de la familia generable (taxonomía v2). */
  familia: string;
  /** Nombre para el prompt y para humanos. */
  nombre: string;
  /** Las cartas del deck que apuntan a esta familia. */
  cartas: string[];
  /** La regla de proporción — lo primero que se rompe si se ignora. */
  silueta: string;
  /** Qué colores usa la familia y EN QUÉ prendas viven (no una lista suelta). */
  paleta: string;
  /** Combinaciones concretas a nivel prenda, cada una con su clima. */
  formulas: { look: string; clima: Clima }[];
  /** Los detalles chiquitos que separan "bien puesto" de "aguado". */
  detalles: string[];
  /** Lo que mata el estilo aunque las prendas sean correctas. */
  evitar: string[];
  /** Las prendas que más fórmulas generan (alimenta cápsula y viaje). */
  capsula: string[];
  /** Cómo abriga este estilo SIN dejar de ser este estilo. */
  frio: string[];
};

// Carta → familia. ESPEJO de scripts/familias.mjs (la fuente que usan los
// scripts de cosecha/clasificación): no se puede importar un .mjs de scripts/
// al bundle sin arrastrar todo scripts/, así que se duplica aquí y un test
// (recetario.test.ts) compara ambos — si divergen, truena el CI, no el motor.
const FAMILIAS_DECK: { familia: string; nombre: string; cartas: string[] }[] = [
  { familia: "sastre", nombre: "Sastre", cartas: ["sastre", "glam-noche"] },
  { familia: "clasico-arreglado", nombre: "Clásico arreglado", cartas: ["clasico-elegante", "smart-casual", "academia"] },
  { familia: "casual-limpio", nombre: "Casual limpio", cartas: ["minimalista", "casual-effortless", "coreano", "monocromatico"] },
  { familia: "preppy", nombre: "Preppy", cartas: ["preppy", "nautico"] },
  { familia: "edgy", nombre: "Edgy", cartas: ["edgy", "grunge"] },
  { familia: "street-urbano", nombre: "Street urbano", cartas: ["streetwear", "y2k"] },
  { familia: "deportivo", nombre: "Deportivo", cartas: ["athleisure", "gorpcore"] },
  { familia: "utilitario", nombre: "Utilitario", cartas: ["utility"] },
  { familia: "thrift-vintage", nombre: "Thrift / vintage", cartas: ["hipster", "vintage"] },
  { familia: "resort-boho", nombre: "Resort / boho", cartas: ["coastal", "boho"] },
];

type RecetaJson = {
  familia: string;
  receta: Omit<Receta, "familia" | "nombre" | "cartas">;
};

const JSONS = [
  casualLimpio,
  clasicoArreglado,
  deportivo,
  edgy,
  preppy,
  resortBoho,
  sastre,
  streetUrbano,
  thriftVintage,
  utilitario,
] as unknown as RecetaJson[];

export const RECETAS_HOMBRE: Receta[] = FAMILIAS_DECK.map((f) => {
  const json = JSONS.find((j) => j.familia === f.familia);
  if (!json) throw new Error(`familia sin receta destilada: ${f.familia}`);
  return { ...f, ...json.receta };
});

// Los tags de una carta viven en lib/looks.ts (son los que el swipe convierte
// en taste vector); aquí solo se consultan para no tener DOS listas de tags.
const TAGS_POR_CARTA = new Map(LOOKS.map((l) => [l.id, l.tags]));

/**
 * Las recetas que aplican a unos gustos dados, de la más fuerte a la más débil.
 *
 * `tasteTags` viene EN ORDEN DE FUERZA de computeTasteTags, así que un tag en
 * primera posición pesa más que uno en la sexta. score de una carta =
 * Σ 1/(posición+1) sobre sus tags que aparecen: premia qué tan arriba está el
 * tag Y cuántos tags de la carta empatan. La familia hereda el MEJOR score de
 * sus cartas — no la suma, porque una familia con 4 cartas sumaría más que una
 * de 1 solo por ser ancha, y utilitario nunca ganaría ni al fan del utility.
 *
 * El tope existe porque inyectar cinco recetas es lo mismo que no inyectar
 * ninguna: el modelo acaba con una sopa de reglas que se contradicen (el
 * casual-limpio veta el hardware que el edgy exige) y vuelve a improvisar.
 */
export function recetasParaTags(
  tasteTags: string[],
  genero: "hombre" | "mujer",
  tope = 2
): Receta[] {
  if (genero !== "hombre") return []; // mujer: pipeline de destilación pendiente
  const posicion = new Map(tasteTags.map((t, i) => [t, i]));
  const scoreCarta = (carta: string) =>
    (TAGS_POR_CARTA.get(carta) ?? []).reduce((suma, t) => {
      const p = posicion.get(t);
      return p === undefined ? suma : suma + 1 / (p + 1);
    }, 0);

  return RECETAS_HOMBRE.map((receta) => {
    const scores = receta.cartas.map(scoreCarta);
    return {
      receta,
      score: Math.max(...scores),
      // Desempate: la suma sí distingue "me late una carta de la familia" de
      // "me laten todas" cuando el máximo empata.
      total: scores.reduce((a, b) => a + b, 0),
    };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, tope)
    .map((x) => x.receta);
}

/**
 * La banda de clima que decide qué fórmulas ve el modelo.
 *
 * Los umbrales son los de la práctica de vestir, no meteorológicos: a 16-25°C
 * un look templado (camisa, capa ligera opcional) funciona; debajo de eso ya
 * se necesita la capa de abrigo del estilo, y de 26°C para arriba la manga
 * larga pesada estorba. Sin clima (usuaria sin ubicación) se asume templado:
 * es donde vive la mayoría del material y el error es el menos caro en ambas
 * direcciones.
 */
export function bandaDeClima(weather: Weather | null): Clima {
  if (!weather) return "templado";
  if (weather.temp_c <= 15) return "frio";
  if (weather.temp_c >= 26) return "calor";
  return "templado";
}

/** Formatea las recetas para el prompt. Vacío si no aplica ninguna. */
export function recetasParaPrompt(
  recetas: Receta[],
  weather: Weather | null = null
): string {
  if (recetas.length === 0) return "";
  const banda = bandaDeClima(weather);

  const bloques = recetas.map((r) => {
    // Solo las fórmulas de la banda del día: mandar las 15 revueltas es como
    // no mandar clima — así salió el cuello de tortuga a 28°C. Si la banda no
    // tiene material (utilitario no tiene fórmulas de calor; resort-boho no
    // tiene de frío porque sus fotos no abrigan), caen las de templado y el
    // modelo adapta con el clima que ya recibe — mejor honesto que inventarle
    // fórmulas que las fotos no sostienen.
    const deBanda = r.formulas.filter((f) => f.clima === banda);
    const formulas = (deBanda.length ? deBanda : r.formulas.filter((f) => f.clima === "templado")).map(
      (f) => f.look
    );

    const lineas = [
      `### ${r.nombre}`,
      `Silueta: ${r.silueta}`,
      // La paleta dice en qué PRENDA vive cada color ("el camel es de abrigo,
      // no de suéter") — es guía de combinación, no permiso para pintar
      // prendas: la colorimetría personal de la clienta manda sobre esto.
      `Paleta del estilo (su colorimetría personal manda sobre esto): ${r.paleta}`,
      `Fórmulas que funcionan${deBanda.length ? "" : " (de clima templado — adáptalas al clima de hoy)"}:`,
      ...formulas.map((f) => `  - ${f}`),
    ];
    // La sección de abrigo va SOLO en frío: en templado es ruido y en calor es
    // una invitación a ponerle capas a un look de 30°C.
    if (banda === "frio" && r.frio.length) {
      lineas.push(`Cómo abriga este estilo sin dejar de serlo:`, ...r.frio.map((x) => `  - ${x}`));
    }
    lineas.push(
      `Detalles que lo hacen:`,
      ...r.detalles.map((d) => `  - ${d}`),
      `Lo que lo arruina:`,
      ...r.evitar.map((e) => `  - ${e}`)
    );
    return lineas.join("\n");
  });

  return [
    "Cómo se lleva su estilo (destilado de fotos reales de calle):",
    ...bloques,
    "Usa esto para ELEGIR entre combinaciones válidas y para armar la silueta. No inventes prendas que no estén en su clóset para cumplirlo; si su clóset no da para la fórmula exacta, acércate con lo que hay.",
  ].join("\n\n");
}
