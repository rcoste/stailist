// Reglas de ejecución: fallos de armado que se COMPRUEBAN, no se piden.
//
// POR QUÉ EXISTE ESTE ARCHIVO
// El recetario describe cómo se lleva cada estilo, y sale de fotos de calle. Pero
// de fotos de gente BIEN vestida es imposible aprender qué sale mal: nadie
// fotografía sus errores. Ese conocimiento tiene otra fuente —ver al motor
// equivocarse— y por eso vive aparte.
//
// Y vive en CÓDIGO, no en el prompt, por dos razones. Una: son propiedades
// aritméticas de un conjunto de prendas (¿estos dos hex se parecen?, ¿estos dos
// cueros son del mismo color?), no juicios de gusto — pedírselas a un modelo es
// pedirle que calcule y esperar que se acuerde. Dos: en el prompt se pueden
// borrar sin que nada truene, que es exactamente lo que pasó — v28 tenía la
// regla del tono repetido, la destilación v2 la reemplazó, y dos de los cinco
// primeros looks generados cayeron en ella.
//
// EL CRITERIO PARA AGREGAR UNA REGLA AQUÍ
// Antes de escribir una, hay que contestar "¿de qué es esto un caso?". Si la
// respuesta es "de nada, es este outfit", es un parche y no entra. Las tres de
// abajo son dos principios: dos prendas contiguas del mismo tono se leen como
// UNA (y por eso el saco marino sobre pantalón marino finge un traje que no es),
// y los materiales que se repiten en un look tienen que coincidir o se leen como
// accidente.
//
// LA VUELTA QUE EVITA QUE SEA UN PARCHE
// "Mismo tono = mal" a secas rompería monocromático y edgy, cuyas recetas viven
// justo de eso ("cuando todo es negro, la textura hace el contraste, no el
// color"). La regla correcta es una vuelta más: mismo tono EXIGE distinto
// material. Piel negra sobre punto negro funciona; algodón negro sobre algodón
// negro no. Un solo principio cubre el fallo y los dos casos legítimos.
//
// QUÉ SE HACE CON LAS VIOLACIONES
// No se rechaza el look: se le pasan al juez (critic.ts) como hallazgos ya
// verificados para que las repare con el clóset que tiene. Detección
// determinista + reparación con criterio, que es lo que cada uno hace mejor.

import type { EngineItem } from "./prompt";
import type { Clima } from "./recetario";
import { tipoDePrenda } from "./vocabulario";

export type Violacion = { regla: string; detalle: string };

/**
 * Lo que las reglas necesitan saber además del look.
 *
 * `closet` es el clóset COMPLETO, no las prendas del look, y esa distinción es
 * la que separa un fallo de una carencia: salir a 8°C sin abrigo teniendo uno es
 * un error que el juez puede reparar; hacerlo sin tener ninguno no es reparable
 * y va por otro camino (el aviso de honestidad, ver cobertura.ts). Una regla que
 * no distinga las dos manda al juez a arreglar lo que no se puede.
 */
export type ContextoReglas = { clima?: Clima; closet?: EngineItem[] };

/** #rrggbb → [r,g,b]. null si no hay hex o viene mal escrito. */
function rgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Distancia entre dos colores, 0-441.
 *
 * Euclidiana en RGB a propósito: no es perceptualmente exacta, pero aquí solo
 * hace falta separar "es el mismo tono" de "son tonos distintos", y para eso
 * alcanza. Un espacio perceptual (Lab) sería más correcto y añadiría una
 * dependencia y una conversión para no cambiar ninguno de los veredictos.
 */
function distancia(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// 60 sobre 441: separa negro de azul marino (#1A1A1A vs #1F2A44 ≈ 45 → mismo
// tono a ojos de esta regla, que es correcto: leídos juntos se enlodan) pero no
// marca crema contra taupe. Calibrado contra los looks reales que fallaron.
const MISMO_TONO = 60;

const norm = (s?: string) => (s ?? "").toLowerCase().trim();

// Cuando la prenda no declara material —las del catálogo de básicos no lo
// traen, y ese es el clóset con el que arranca TODA la gente nueva— se deduce
// del nombre. Sin esto la regla del tono repetido no dispara nunca en el caso
// más común, que es justo donde se detectó el fallo.
//
// Deliberadamente corta: solo prendas cuyo nombre implica una superficie sin
// ambigüedad. Lo que no cae aquí devuelve null y la regla se salta — un falso
// positivo manda al juez a "reparar" un look que estaba bien, y eso es peor que
// no detectar.
function materialPorNombre(nombre: string): string | null {
  const s = norm(nombre);
  if (/jeans|mezclilla|denim/.test(s)) return "mezclilla";
  if (/su[eé]ter|cardigan|c[aá]rdigan|cuello alto|jersey/.test(s)) return "punto";
  if (/cintur[oó]n|zapato|mocas[ií]n|bot[ií]n|bota|reloj de piel/.test(s)) return "piel";
  if (/camisa|camiseta|playera|polo|chino|pantal[oó]n|short|bermuda|overshirt|hoodie|sudadera/.test(s))
    return "liso";
  return null;
}

// Familias de material: lo que importa es si el OJO ve dos superficies
// distintas, no la fibra. Punto grueso y punto fino son la misma superficie;
// piel y algodón no.
function familiaMaterial(m?: string, nombre?: string): string | null {
  const s = norm(m);
  if (!s) return nombre ? materialPorNombre(nombre) : null;
  if (/piel|cuero|ante|gamuza|charol/.test(s)) return "piel";
  if (/punto|tejido|lana|cachemir|canal/.test(s)) return "punto";
  if (/mezclilla|denim|jean/.test(s)) return "mezclilla";
  if (/nylon|poli[eé]ster|t[eé]cnic|shell|impermeable/.test(s)) return "tecnico";
  if (/lino/.test(s)) return "lino";
  if (/pana|terciopelo|sarga|tweed|franela/.test(s)) return "textura";
  if (/algod[oó]n|jersey|felpa|popelina|tela/.test(s)) return "liso";
  return s;
}

const TIPO = (i: EngineItem) => norm(i.attrs.tipo) || norm(i.attrs.nombre);

const esCapaAbierta = (i: EngineItem) =>
  /camisa|overshirt|sobrecamisa|cardigan|c[aá]rdigan|chamarra|saco|blazer|chaleco|abrigo|gabardina/.test(TIPO(i));
const esBase = (i: EngineItem) =>
  /camiseta|playera|polo|su[eé]ter|top|blusa|cuello alto/.test(TIPO(i));
const esSaco = (i: EngineItem) => /saco|blazer/.test(TIPO(i));
const esPantalonVestir = (i: EngineItem) =>
  /pantal[oó]n de vestir|pantal[oó]n de traje|pantal[oó]n formal/.test(TIPO(i));
const esCuero = (i: EngineItem) =>
  familiaMaterial(i.attrs.material, i.attrs.nombre) === "piel" ||
  /cintur[oó]n|zapato|mocas[ií]n|bot[ií]n|bota|reloj de piel|correa/.test(TIPO(i));

const nombre = (i: EngineItem) => i.attrs.nombre ?? i.attrs.tipo ?? i.id;

/**
 * Revisa un look ya armado. Devuelve las violaciones encontradas (vacío = limpio).
 *
 * Todo lo que no se puede comprobar —falta el hex, falta el material— NO cuenta
 * como violación: una regla que dispara por datos incompletos hace más daño que
 * la que no dispara, porque manda al juez a "reparar" lo que estaba bien.
 */
export function revisarEjecucion(
  items: EngineItem[],
  ctx: ContextoReglas = {}
): Violacion[] {
  const v: Violacion[] = [];
  const conColor = items.filter((i) => rgb(i.attrs.color_hex));

  // 1. Capa abierta del mismo tono que la prenda de debajo, sin cambio de
  //    material: la capa desaparece y el look deja de leerse por capas.
  for (const capa of conColor.filter(esCapaAbierta)) {
    for (const base of conColor.filter(esBase)) {
      const d = distancia(rgb(capa.attrs.color_hex)!, rgb(base.attrs.color_hex)!);
      if (d > MISMO_TONO) continue;
      const mc = familiaMaterial(capa.attrs.material, capa.attrs.nombre);
      const mb = familiaMaterial(base.attrs.material, base.attrs.nombre);
      // Sin material NI nombre reconocible no se puede saber si hay contraste
      // de textura: se deja pasar en vez de inventar una violación.
      if (!mc || !mb || mc !== mb) continue;
      v.push({
        regla: "capa-invisible",
        detalle: `"${nombre(capa)}" va encima de "${nombre(base)}" en el mismo tono y el mismo material (${mc}): la capa no se ve, el look se lee como una sola prenda. Cambia una de las dos por otra de tono o material distinto.`,
      });
    }
  }

  // 2. Traje desparejado: saco y pantalón de vestir del mismo color sin ser un
  //    traje. Es el mismo principio que la #1 —dos piezas fingiendo ser una— y
  //    se nota más porque el traje real existe como referencia.
  for (const saco of conColor.filter(esSaco)) {
    for (const pant of conColor.filter(esPantalonVestir)) {
      const d = distancia(rgb(saco.attrs.color_hex)!, rgb(pant.attrs.color_hex)!);
      if (d > MISMO_TONO) continue;
      v.push({
        regla: "traje-desparejado",
        detalle: `"${nombre(saco)}" y "${nombre(pant)}" son del mismo color sin ser un traje: se lee como un traje mal conjuntado, no como un look armado. Cambia el pantalón por uno de otro color.`,
      });
    }
  }

  // 3. Los cueros del look se hablan entre sí. Ya está escrito en dos recetas
  //    ("café con café, negro con negro") pero como consejo dentro de un párrafo
  //    largo; aquí se comprueba.
  const cueros = conColor.filter(esCuero);
  for (let i = 0; i < cueros.length; i++) {
    for (let j = i + 1; j < cueros.length; j++) {
      const d = distancia(rgb(cueros[i].attrs.color_hex)!, rgb(cueros[j].attrs.color_hex)!);
      // Ni iguales ni claramente distintos: la franja de en medio es la que se
      // lee como error. Café con café pasa; café con crema también (son dos
      // decisiones). Café con negro no.
      if (d <= MISMO_TONO || d > 200) continue;
      v.push({
        regla: "cueros-que-no-se-hablan",
        detalle: `"${nombre(cueros[i])}" y "${nombre(cueros[j])}" son cueros de colores distintos que no dialogan: se lee como accidente. Iguálalos (café con café, negro con negro) o quita uno.`,
      });
    }
  }

  // 4. Prenda de código: hay atuendos que no admiten piezas sueltas. Un smoking
  //    no es "un saco negro elegante" — es un conjunto con reglas (pantalón del
  //    mismo juego con galón, camisa blanca, moño), y una pieza fuera del código
  //    no lo hace variado sino equivocado, que es lo que ve cualquiera que
  //    conozca el código y justo la gente que va a esos eventos.
  //
  //    Es el mismo principio que el traje desparejado —piezas que fingen ser un
  //    conjunto— llevado a su caso más estricto. El look que la motivó: saco de
  //    smoking negro + camisa azul claro + corbata burdeos + pantalón de vestir
  //    gris, para alguien de perfil deportivo en un evento de noche. Roberto:
  //    "el peor de todos... un Frankenstein espantoso".
  //
  //    La regla NO exige que el clóset tenga las piezas: si no las tiene, el
  //    arreglo correcto es quitar el smoking y armar un formal normal, y eso es
  //    lo que dice el detalle. Un smoking a medias se lee como error; un buen
  //    look formal sin smoking, no.
  const esSmoking = (i: EngineItem) => /smoking|esmoquin|tuxedo/.test(TIPO(i));
  if (items.some(esSmoking)) {
    const falta: string[] = [];
    const pantalon = items.find((i) => tipoDePrenda(nombre(i))?.zona === "pierna");
    if (pantalon && !esSmoking(pantalon)) {
      falta.push(
        `el pantalón ("${nombre(pantalon)}") no es del smoking — el pantalón de smoking lleva el galón de raso y es el único que va con ese saco`
      );
    }
    // La camisa del smoking es blanca. Se juzga por el color real y no por el
    // nombre: "Camisa de vestir" no dice de qué color es.
    const camisa = items.find((i) => /camisa/.test(TIPO(i)));
    const camisaRgb = camisa ? rgb(camisa.attrs.color_hex) : null;
    if (camisa && camisaRgb && Math.min(...camisaRgb) < 200) {
      falta.push(`la camisa ("${nombre(camisa)}") tiene que ser blanca`);
    }
    const corbata = items.find((i) => /corbata/.test(TIPO(i)));
    if (corbata && !/mo[nñ]o|pajarita|bow/.test(TIPO(corbata))) {
      falta.push(`con smoking va moño, no corbata ("${nombre(corbata)}")`);
    }
    if (falta.length) {
      v.push({
        regla: "codigo-de-smoking",
        detalle: `Este look mezcla un smoking con piezas que no son de smoking: ${falta.join("; ")}. El smoking es un conjunto con código cerrado, no un saco negro elegante. Complétalo con las piezas correctas del clóset o quita el smoking y arma un look formal normal — a medias se lee como error, no como versión relajada.`,
      });
    }
  }

  // 4b. El traje con el pantalón de otro. Lo cazó Roberto juzgando el par #11
  //     del A/B: el look llevaba "Traje marino de lana" Y ADEMÁS "Pantalón de
  //     vestir marino". Su comentario: "si el traje azul marino y el pantalón
  //     son del mismo juego y que no sean diferentes".
  //
  //     Un traje ya trae su pantalón. Añadirle otro no es un matiz de estilo:
  //     o sobra una prenda o son dos piezas dispares que se leen como error.
  //
  //     SOLO traje y esmoquin, a propósito. Un vestido sobre pantalón sí es un
  //     look real y no se toca; el traje con otro pantalón no lo es nunca.
  const enteros = items.filter((i) => {
    const t = tipoDePrenda(nombre(i));
    return t?.tipo === "traje" || t?.tipo === "esmoquin";
  });
  if (enteros.length) {
    const piernaSuelta = items.find((i) => {
      const t = tipoDePrenda(nombre(i));
      return t?.zonas.includes("pierna") && t.tipo !== "traje" && t.tipo !== "esmoquin";
    });
    if (piernaSuelta) {
      v.push({
        regla: "traje-con-pantalon-ajeno",
        detalle: `El look lleva "${nombre(enteros[0])}" (que YA incluye su pantalón) y además "${nombre(piernaSuelta)}". Quita el pantalón suelto: un traje se lleva con el suyo, y dos piezas de juegos distintos se leen como error, no como estilo.`,
      });
    }
  }

  // 5. Frío sin abrigo. Objetivo, no de gusto: a 8°C una camiseta y un pantalón
  //    no alcanzan, y de nada sirve que el look esté bien compuesto si la
  //    persona se congela. Roberto lo marcó en dos looks del barrido.
  //
  //    SOLO dispara si el clóset TIENE una capa: si no la tiene, no es un fallo
  //    reparable sino una carencia, y esa se dice con honestidad en la
  //    explicación (ver cobertura.ts) en vez de mandar al juez a arreglar algo
  //    que no puede.
  if (ctx.clima === "frio" && ctx.closet?.length) {
    const esCapa = (i: EngineItem) => tipoDePrenda(nombre(i))?.zona === "capa";
    if (!items.some(esCapa)) {
      const disponibles = ctx.closet.filter(esCapa);
      if (disponibles.length) {
        v.push({
          regla: "frio-sin-abrigo",
          detalle: `Hace frío y el look no lleva ninguna capa de abrigo, pero su clóset SÍ tiene: ${disponibles
            .slice(0, 4)
            .map(nombre)
            .join(", ")}. Añade la que mejor vaya con el look — a esta temperatura salir sin abrigo no es una decisión de estilo, es un look que no se puede usar.`,
        });
      }
    }
  }

  return v;
}

/** Bloque para el mensaje del juez. Vacío si el look está limpio. */
export function bloqueEjecucion(
  items: EngineItem[],
  ctx: ContextoReglas = {}
): string[] {
  const v = revisarEjecucion(items, ctx);
  if (v.length === 0) return [];
  return [
    "",
    "PROBLEMAS YA VERIFICADOS EN ESTE LOOK (comprobados con los colores y materiales reales de las prendas, no son opinión — REPÁRALOS):",
    ...v.map((x) => `- [${x.regla}] ${x.detalle}`),
  ];
}
