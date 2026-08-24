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
import { tipoDePrenda, type Zona } from "./vocabulario";
import { mismoColorAOjo, oklch } from "./color-perceptual";

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
export type ContextoReglas = {
  clima?: Clima;
  closet?: EngineItem[];
  /** El día está lluvioso (viene del clima resuelto, no de la banda de temperatura). */
  lluvia?: boolean;
  /**
   * Va a llevar paraguas. Cambia SOLO lo de arriba: el paraguas tapa el torso,
   * no los pies. Con paraguas la capa exterior se puede elegir por estilo; sin
   * él tiene que repeler agua. El calzado no lo toca — llueva como llueva, se
   * pisa el agua igual.
   */
  paraguas?: boolean;
  /** La formalidad del evento, cuando el wizard la preguntó. */
  formality?: string | null;
  /**
   * QUÉ evento es (lib/eventos.ts). La formalidad no basta: un funeral y una
   * boda comparten "formal" y no comparten nada de lo que hay que acertar.
   */
  tipoEvento?: string | null;
  /**
   * PARA QUÉ es el look ("oficina", "diario", "evento"…). Distinto de la
   * formalidad: hay prendas correctas de nivel y equivocadas de contexto — el
   * lino de arriba abajo es impecable y no es ropa de oficina.
   */
  objective?: string | null;
  /**
   * Para quién. Hoy solo lo usa la regla del suéter, y por una razón medida:
   * "el suéter pide algo debajo" es una convención del guardarropa MASCULINO.
   * En el femenino, llevar el punto a piel es una elección normal y frecuente —
   * el camisol es opcional, no requisito. Sin este dato la regla marcaba como
   * error algo correcto en la mitad de los clósets.
   */
  gender?: string | null;
  /**
   * Apaga la regla de coherencia cromática. SOLO para el comparador: es la
   * variante que mide si la regla suma o estorba, corriendo el motor real con
   * el flag en vez de una imitación (misma disciplina que `sinRepararEnCodigo`).
   */
  sinCoherenciaCromatica?: boolean;
  /** Día o noche: "boda de noche" y "boda de día" no comparten camisa. */
  momento?: "dia" | "noche" | null;
  /** Ablación del comparador: apaga las 4 reglas de v61 como grupo. */
  sinReglasV61?: boolean;
};

/**
 * Materiales que el agua ARRUINA. Es el criterio de Roberto, dicho por él:
 * "chukka o chelsea de gamuza, cosas que se vayan a meter agua o se vayan a
 * afectar… seamos un poquito más tolerantes". O sea NO es el tipo de zapato
 * (un tenis de piel o de suela gruesa pasa, un botín Chelsea de piel pasa) —
 * es de qué está hecho.
 *
 * Piel y sintético pasan; ante, gamuza y las telas no. Medido sobre los 44
 * pares de calzado de la base: 33 pasan, 6 caen aquí, 4 no tienen material
 * (y esos NO bloquean, ver abajo).
 */
const MATERIAL_SE_ARRUINA =
  /ante|gamuza|lona|tela|textil|algod[oó]n|punto|lino|terciopelo|pana|malla|mesh|knit|primeknit|flyknit/;

/**
 * Formas de calzado que el agua vence AUNQUE sean de piel, y por eso el
 * material no basta para juzgarlas.
 *
 * Salió de la corrida de verificación: 5 de los 17 looks de lluvia trajeron
 * mocasín, y el mocasín es de piel — o sea que pasaba limpio por el filtro de
 * material. Roberto ya lo había dicho votando el veredicto ("Mocasín en lluvia
 * no aplica") y también había dicho la regla tolerante ("tenis de piel o con
 * suela grande, botines Chelsea… seamos un poquito más tolerantes"). Las dos
 * cosas son ciertas a la vez porque la diferencia no es de qué está hecho sino
 * de cómo está hecho: un Chelsea te cubre el tobillo y un tenis de suela
 * gruesa te levanta del charco; un mocasín es escotado, de suela fina y sin
 * cierre — el agua entra por arriba.
 *
 * Náutico y sandalia van por lo mismo. Bota, botín, tenis y zapato formal NO
 * están aquí: esos los juzga el material, como quiso Roberto.
 */
const FORMA_NO_AGUANTA = new Set(["mocasin", "nautico", "sandalia"]);

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
  // EL LINO VA ANTES que la línea genérica de prendas: "Pantalón de lino
  // marino" caía en /pantal[oó]n/ → "liso" y full-lino-en-oficina quedaba MUDA
  // — el motor entregó camisa de lino + pantalón de lino a una oficina y
  // Roberto: "full lino no debe usarse para trabajo!! Lo he dicho muchas
  // veces" (2026-08-24, tercera ronda con el mismo reclamo). La regla existía;
  // el orden del fallback la apagaba.
  if (/\blino\b/.test(s)) return "lino";
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

/**
 * SACO DE TRAJE contra BLAZER — la distinción que pidió Roberto, con sus
 * palabras: "una cosa es un blazer y otra es un saco traje. El saco de traje
 * debe ir con su pantalón de traje, y el pantalón de traje sí podría ir solo".
 *
 * DOS SEÑALES, y el orden importa:
 *
 * 1. `attrs.conjunto` — el lazo que la persona pone al dar de alta un traje.
 *    Es la señal DURA: si existe, esa prenda vino de un traje y tiene un par
 *    concreto. Cero falsos positivos.
 * 2. El nombre y el subtipo. Hace falta porque la señal dura casi no existe
 *    todavía: al escribir esto había 6 prendas con `conjunto` en toda la base
 *    —las 6 de un solo usuario— contra 46 sacos sin él. Sin esta segunda capa
 *    la regla nacería correcta e inerte para 17 de 18 personas.
 *
 * LO QUE **NO** ES SACO DE TRAJE, y por eso no basta con buscar "saco": el
 * blazer, el desestructurado, el sport y los de patrón (cuadros, pata de gallo,
 * príncipe de Gales) se llevan sueltos POR DISEÑO. Marcarlos sería el error
 * contrario y más caro — prohibir combinaciones correctas.
 */
const esSacoDeTraje = (i: EngineItem) => {
  const t = TIPO(i);
  // 0. Tiene que ser una prenda de esa familia. Esto es lo que deja FUERA al
  //    pantalón del traje, que también lleva `conjunto` — la asimetría que pidió
  //    Roberto ("el pantalón de traje sí podría ir solo") y que se rompía al
  //    mirar `conjunto` antes que la prenda. Lo cazó su test.
  //    El \\b de "chaqué" NO es decorativo: sin él "chaqueta negra con cierre"
  //    entraba por el "chaque" de dentro, y la regla marcaba una chamarra
  //    normal. Lo cazó la verificación contra los 107 looks de la corrida.
  if (!/saco|esmoquin|smoking|chaqu[eé]\b/.test(t)) return false;
  // 1. El nombre lo dice: es de traje, pase lo que pase con el material.
  if (/traje|esmoquin|smoking|chaqu[eé]\b/.test(t)) return true;
  // 2. O lo dice el lazo que la persona puso al dar de alta su traje.
  if (i.attrs.conjunto) return true;
  // 3. El resto de los sacos —blazer, desestructurado, sport, de cuadros— se
  //    llevan sueltos por diseño. En la duda NO se marca: prohibir una
  //    combinación correcta es el error caro.
  return false;
};
const esPantalonVestir = (i: EngineItem) =>
  /pantal[oó]n de vestir|pantal[oó]n de traje|pantal[oó]n formal/.test(TIPO(i));
// Exportado porque el reparador en código (reparar.ts) necesita LA MISMA vara
// que la regla: decidir qué es un cuero con otro predicado repararía contra un
// criterio distinto del que detecta.
/**
 * Lo que abriga de verdad a 8°C, por nombre. Exportado porque el reparador
 * (reparar.ts) necesita LA MISMA vara que `blazer-no-es-abrigo`: añadir "una
 * capa" con otro predicado repararía contra un criterio distinto del que
 * detecta — y la regla volvería a disparar sobre su propio arreglo.
 */
export const ABRIGA_DE_VERDAD =
  /abrigo|gab(a|á)rdina|parka|puffer|acolchad|plumas|trench|anorak|chamarra|cazadora|chaqueta/;

export const esCuero = (i: EngineItem) =>
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
      // UN TRAJE DE VERDAD NO ES UN TRAJE DESPAREJADO. Sale de Roberto subiendo
      // la foto de su traje gris: la visión lo parte —bien— en saco y pantalón,
      // y el par resultante es exactamente lo que esta regla prohíbe. Sin esta
      // salida, tener un traje bueno impedía usarlo, que es lo contrario de lo
      // que la regla busca. El lazo lo pone la persona al darlo de alta.
      if (saco.attrs.conjunto && saco.attrs.conjunto === pant.attrs.conjunto) continue;
      v.push({
        regla: "traje-desparejado",
        detalle: `"${nombre(saco)}" y "${nombre(pant)}" son del mismo color sin ser un traje: se lee como un traje mal conjuntado, no como un look armado. Cambia el pantalón por uno de otro color.`,
      });
    }
  }

  // 2b. EL SACO DE TRAJE VA CON SU PANTALÓN, O NO VA.
  //
  //     Salió del veredicto de Gemini 3.7 (2026-08-14), donde Roberto lo anotó
  //     en CUATRO pares distintos y pidió que fuera regla con esas palabras:
  //     "no podemos poner los sacos de traje así como por sí solos, o tienen
  //     que ir con su par. Eso es una regla". Y el diagnóstico de por qué se ve
  //     mal: "se ve parchado" — el saco de traje está cortado y entelado para
  //     su pantalón, así que junto a otro se lee como un traje mal apareado, no
  //     como un look armado.
  //
  //     NO LA CUBRÍA LA REGLA 2 (`traje-desparejado`): aquella sólo dispara
  //     cuando saco y pantalón son del MISMO color, o sea dos piezas fingiendo
  //     ser un traje. Ésta es más fuerte y al revés — un saco de traje con
  //     CUALQUIER pantalón que no sea el suyo.
  //
  //     LA ASIMETRÍA ES DELIBERADA Y ES DE ÉL: el pantalón de traje suelto SÍ
  //     se puede usar. Sólo el saco queda atado a su par.
  //
  //     Cuando el lazo `conjunto` existe se exige el par EXACTO; cuando no
  //     existe (la mayoría de los clósets hoy) sólo se puede exigir que haya
  //     algún pantalón de vestir, que es lo que el dato permite afirmar sin
  //     inventar.
  for (const saco of items.filter(esSacoDeTraje)) {
    const par = saco.attrs.conjunto
      ? items.find((i) => i !== saco && i.attrs.conjunto === saco.attrs.conjunto)
      : items.find(esPantalonVestir);
    if (par) continue;
    v.push({
      regla: "saco-de-traje-suelto",
      detalle: `"${nombre(saco)}" es un saco de TRAJE, no un blazer: está cortado y entelado para su pantalón, así que con otro se ve parchado. Ponlo con el pantalón de su traje, o cámbialo por un blazer o saco desestructurado, que sí se llevan sueltos.`,
    });
  }

  // 2c. FUNERAL: NADA DE ETIQUETA, Y LA CORBATA NEGRA.
  //
  //     El motor sacó un ESMOQUIN para un funeral en el veredicto de Gemini 3.7
  //     y Roberto lo calificó con una palabra: "terrible". Más una corbata de
  //     color en el mismo look — "tendría que ser negra".
  //
  //     LA IRONÍA, y por eso hacía falta código y no más prompt: el catálogo ya
  //     gritaba "EL COLOR ES NEGRO — el AZUL MARINO NO", y la prenda más negra
  //     y más formal de ese clóset era justamente el esmoquin. La regla del
  //     color EMPUJÓ hacia el error. Que algo sea negro no lo vuelve luto: el
  //     esmoquin es ropa de celebración.
  //
  //     Va como regla comprobable porque las dos condiciones son verificables
  //     (¿hay una prenda de etiqueta?, ¿el hex de la corbata es negro?) y
  //     porque una línea de prompt se puede ignorar; ésta la repara el juez.
  if (ctx.tipoEvento === "funeral") {
    for (const et of items.filter((i) => /esmoquin|smoking|chaqu[eé]\b|frac|pajarita|mo[nñ]o/.test(TIPO(i)))) {
      v.push({
        regla: "funeral-etiqueta",
        detalle: `"${nombre(et)}" es ropa de etiqueta, o sea de CELEBRACIÓN: en un funeral se lee como una falta de respeto por muy negro que sea. Cámbialo por un traje o piezas sueltas en negro o gris muy oscuro.`,
      });
    }
    // La corbata: negra o nada. Se juzga en OKLCH —oscura Y sin color— porque
    // en RGB un vino y un carbón oscuros se parecen y aquí la diferencia es
    // exactamente la que importa. Sin hex NO se marca: inventar el error es
    // peor que no verlo.
    for (const c of items.filter((i) => /corbata/.test(TIPO(i)))) {
      const o = oklch(c.attrs.color_hex);
      if (!o) continue;
      if (o.L <= 0.42 && o.C <= 0.05) continue; // negra o carbón sin color: pasa
      v.push({
        regla: "funeral-corbata-color",
        detalle: `"${nombre(c)}" no va en un funeral: la corbata tiene que ser NEGRA. Si no hay una negra, es mejor ir sin corbata que con una de color.`,
      });
    }
  }

  // 2d. LINO DE ARRIBA ABAJO NO ES ROPA DE OFICINA.
  //
  //     Roberto lo marcó en dos pares del veredicto de 3.7, los dos con signos
  //     de admiración: "Full lino para trabajo no está bien! Full lino es más
  //     para eventos, playa, etc." y "full lino en trabajo está mal!". Y la
  //     frase que fija el alcance: "el look está cool, pero te fuiste FULL
  //     lino" — el problema no es el lino, es el lino en todo.
  //
  //     LOS DOS CASOS ERAN IDÉNTICOS: camisa de lino + pantalón de lino. Por eso
  //     la regla cuenta prendas ESTRUCTURALES (torso, pierna, capa) y pide DOS:
  //     una camisa de lino sola es correcta en una oficina de calor, y marcarla
  //     sería prohibir el lino, que no es lo que dijo.
  //
  //     No es formalidad: el look puede estar impecable de nivel y seguir
  //     leyéndose como vacaciones. Por eso hace falta el objetivo y no basta con
  //     `formality`.
  if (/oficina|trabajo/.test(norm(ctx.objective ?? undefined))) {
    const estructural = (i: EngineItem) => {
      const z = tipoDePrenda(nombre(i))?.zona;
      return z === "torso" || z === "pierna" || z === "capa";
    };
    const deLino = items
      .filter(estructural)
      .filter((i) => familiaMaterial(i.attrs.material, i.attrs.nombre) === "lino");
    if (deLino.length >= 2) {
      v.push({
        regla: "full-lino-en-oficina",
        detalle: `El look es lino de arriba abajo ("${deLino
          .map(nombre)
          .join('", "')}") y esto es para la oficina: el lino completo se lee como evento o vacaciones, y además se arruga sentado toda la mañana. Deja UNA pieza de lino y cambia la otra por algodón, lana fría o mezclilla.`,
      });
    }
  }

  // 3. Los cueros del look se hablan entre sí. Ya está escrito en dos recetas
  //    ("café con café, negro con negro") pero como consejo dentro de un párrafo
  //    largo; aquí se comprueba.
  const cueros = conColor.filter(esCuero);
  for (let i = 0; i < cueros.length; i++) {
    for (let j = i + 1; j < cueros.length; j++) {
      const ha = cueros[i].attrs.color_hex;
      const hb = cueros[j].attrs.color_hex;
      // EN OKLCH, NO EN RGB. La distancia euclidiana en RGB no separa el matiz
      // de la luminosidad, así que dos colores oscuros y desaturados siempre
      // "se parecen": café chocolate #5C4433 y burdeos #5C2A2E medían 26.5 —
      // por debajo del umbral— y la regla los daba por el mismo café. En OKLCH
      // sus matices están a 40° y son lo que el ojo ve: dos colores distintos.
      // Lo cazó el juez visual antes que ninguna regla.
      const mismo = mismoColorAOjo(ha, hb);
      if (mismo === null) continue; // sin hex no se juzga
      // Claramente distintos = mucha diferencia de LUMINOSIDAD (café con crema
      // son dos decisiones, no un accidente). Eso sí se lee bien en OKLCH.
      const la = oklch(ha)!.L;
      const lb = oklch(hb)!.L;
      if (mismo || Math.abs(la - lb) > 0.35) continue;
      v.push({
        regla: "cueros-que-no-se-hablan",
        detalle: `"${nombre(cueros[i])}" y "${nombre(cueros[j])}" son cueros de colores distintos que no dialogan: se lee como accidente. Iguálalos (café con café, negro con negro) o quita uno.`,
      });
    }
  }

  // 3b. NEGRO CON BEIGE. Roberto, tres veces en la ronda 8559ec99 (2026-08-19),
  //     sobre chinos beige con mocasín y cinturón negros: "no van los mocasines
  //     y cinturón negros con esos pantalones", "otra vez es un error que ya
  //     habías cometido antes: los zapatos negros con chinos beige… estoy casi
  //     seguro de que no va". Y pidió confirmarlo: es la pareja más discutida
  //     del guardarropa masculino, y el consenso de sastrería es el suyo — el
  //     café, el burdeos o el ante con caqui; el negro corta el tono cálido del
  //     pantalón y se lee como zapato de oficina con ropa de fin de semana.
  //
  //     MEDIDA ANTES DE CABLEARLA (scripts/ablacion-votos.ts): dispara en 3 de
  //     sus 27 👎 y en 0 de sus 68 👍. Los chinos beige que aprobó llevaban
  //     mocasín burdeos y cinturón café.
  //
  //     Va por NOMBRE de color y no por hex: "beige", "caqui", "camel" son
  //     familias que la persona nombra; medir tono en OKLCH aquí inventaría un
  //     umbral para lo que ya viene dicho.
  {
    const ES_CALIDO_CLARO = /beige|caqui|khaki|camel|arena|crudo|hueso|crema|tostado/;
    const esBottomBeige = (i: EngineItem) =>
      /pantal[oó]n|chino|bermuda|short/.test(TIPO(i)) &&
      ES_CALIDO_CLARO.test(`${norm(i.attrs.color)} ${TIPO(i)}`);
    const esNegro = (i: EngineItem) =>
      /negr|black/.test(norm(i.attrs.color)) || /negr/.test(TIPO(i));
    const esPieOCinturon = (i: EngineItem) =>
      tipoDePrenda(nombre(i))?.zona === "pie" || /cintur[oó]n/.test(TIPO(i));
    const bottom = items.find(esBottomBeige);
    const negros = bottom ? items.filter((i) => esPieOCinturon(i) && esNegro(i)) : [];
    if (bottom && negros.length) {
      v.push({
        regla: "negro-con-beige",
        detalle: `"${negros.map(nombre).join('" y "')}" en negro con "${nombre(
          bottom
        )}": el negro corta el tono cálido del pantalón y se lee como zapato de oficina con ropa de fin de semana. Con beige o caqui van café, marrón, burdeos o ante — y el cinturón sigue al calzado.`,
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
    const esMono = (i: EngineItem) => /mo[nñ]o|pajarita|bow/.test(TIPO(i));
    const corbata = items.find((i) => /corbata/.test(TIPO(i)));
    if (corbata && !esMono(corbata)) {
      falta.push(`con smoking va moño, no corbata ("${nombre(corbata)}")`);
    }
    // FALTA el moño, no solo "trae la corbata equivocada". Roberto lo marcó en
    // los DOS looks de esmoquin de la corrida de verificación —incluido el que
    // aprobó— y la regla no lo veía: solo miraba una corbata presente. Un
    // esmoquin con el cuello desnudo no es una versión relajada, es incompleto.
    if (!corbata && !items.some(esMono)) {
      falta.push("le falta el moño — un smoking sin moño queda incompleto");
    }
    // El cinturón. El pantalón de smoking no lleva trabillas: va con faja o
    // tirantes, o con nada. Roberto marcó 👎 el esmoquin CON cinturón y 👍 el
    // mismo esmoquin sin él — la única diferencia entre los dos looks.
    const cinturon = items.find((i) => /cintur[oó]n/.test(TIPO(i)));
    if (cinturon) {
      falta.push(
        `sobra el cinturón ("${nombre(cinturon)}") — el pantalón de smoking no lleva trabillas: va con faja, tirantes o nada`
      );
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

  // 5b. UN BLAZER NO ES UN ABRIGO. La regla #5 se conforma con que haya
  //     CUALQUIER pieza de zona "capa", y el blazer lo es — así que un saco de
  //     lana a 8°C pasaba como si abrigara. Roberto lo cazó calibrando v47:
  //     "para hacer frío ahí falta una capa; que tuviera un abrigo encima del
  //     blazer, o un crew neck entre la camisa y el blazer".
  //
  //     La salida son las DOS que él nombró: un abrigo de verdad encima, o una
  //     capa de punto debajo. Con cualquiera de las dos, el look aguanta.
  if (ctx.clima === "frio" && ctx.closet?.length) {
    const SOLO_SASTRE = /blazer|saco|americana|chaleco/;
    // La CATEGORÍA manda sobre el nombre. Un "Blazer marrón de lana" del
    // catálogo viene con categoría "abrigo" —es una pieza pesada que sí hace de
    // capa exterior— y juzgarlo por su nombre lo tiraba: la primera versión de
    // esta regla marcó ese look, que Roberto había aprobado. El nombre es una
    // heurística; la categoría es un dato.
    const esSastreLigero = (i: EngineItem) =>
      SOLO_SASTRE.test(TIPO(i)) &&
      (i.attrs.categoria ?? "").toLowerCase() !== "abrigo";
    const capas = items.filter((i) => tipoDePrenda(nombre(i))?.zona === "capa");
    const soloSastre =
      capas.length > 0 &&
      capas.every(esSastreLigero) &&
      !capas.some((i) => ABRIGA_DE_VERDAD.test(TIPO(i)));
    // El punto debajo salva el look: es la otra salida que Roberto nombró.
    const conPunto = items.some((i) =>
      /su[eé]ter|sweater|jersey|punto|knit|cardigan|c[aá]rdigan|cuello (alto|tortuga)|turtleneck/.test(
        TIPO(i)
      )
    );
    if (soloSastre && !conPunto) {
      const abrigos = ctx.closet.filter((i) => ABRIGA_DE_VERDAD.test(TIPO(i)));
      const puntos = ctx.closet.filter((i) =>
        /su[eé]ter|sweater|jersey|punto|knit|cardigan|c[aá]rdigan/.test(TIPO(i))
      );
      // Sin nada con qué arreglarlo es carencia, no fallo: se calla, igual que #5.
      if (abrigos.length || puntos.length) {
        v.push({
          regla: "blazer-no-es-abrigo",
          detalle: `A esta temperatura "${nombre(capas[0])}" no abriga por sí solo: un saco es sastrería, no una capa de frío. Súmale ${
            abrigos.length ? `un abrigo encima (${abrigos.slice(0, 2).map(nombre).join(" o ")})` : ""
          }${abrigos.length && puntos.length ? ", o " : ""}${
            puntos.length ? `una capa de punto debajo (${puntos.slice(0, 2).map(nombre).join(" o ")})` : ""
          }.`,
        });
      }
    }
  }

  // 5c. LANA EN CALOR. El prompt lo pide desde v4 ("nada de lana ni tejidos
  //     pesados en calor") y aun así apareció un pantalón de lana a 29°C
  //     soleado. Roberto: "está muy, muy, muy caluroso; la lana es muy calurosa
  //     para soleado". Es el patrón de siempre: lo que el prompt pide y no se
  //     cumple, se comprueba.
  if (ctx.clima === "calor" && ctx.closet?.length) {
    const DE_INVIERNO = /lana|tweed|pana|terciopelo|cachemir|cashmere|franela|shearling|borrega/;
    // La lana FRÍA (tropical, fresco lana) existe justo para el verano: no
    // cuenta. Sin esta excepción la regla marcaría el traje de verano correcto.
    const esDeInvierno = (i: EngineItem) => {
      const t = `${norm(i.attrs.material)} ${TIPO(i)}`;
      if (/lana fr[ií]a|tropical|fresco lana|lana ligera/.test(t)) return false;
      return DE_INVIERNO.test(t);
    };
    const pesadas = items.filter(esDeInvierno);
    if (pesadas.length) {
      const puestas = new Set(items.map((i) => i.id));
      const alternativas = ctx.closet.filter((i) => !puestas.has(i.id) && !esDeInvierno(i));
      if (alternativas.length) {
        v.push({
          regla: "lana-en-calor",
          detalle: `Hace calor y el look lleva ${pesadas
            .map((i) => `"${nombre(i)}"`)
            .join(", ")} — lana y tejidos de invierno dan calor aunque el color sea claro. Cámbialo por algo de algodón, lino o mezcla ligera del clóset.`,
        });
      }
    }
  }

  // 5d. LA BOTA DE MONTAÑA NO ES CALZADO DE CALLE. Roberto, calibrando v47
  //     sobre unas Columbia de senderismo a 8°C despejado: "no deberían ir a
  //     menos que esté nevando — se ve ruidosa, le rompe la madre al look".
  //
  //     Es calzado FUNCIONAL, no estilístico: suela dentada, refuerzos y logos
  //     técnicos gritan montaña en una banqueta. Y en México no nieva, así que
  //     en la práctica es "fuera".
  //
  //     LA EXCEPCIÓN, que es mía y él la aceptó: con lluvia y SIN otro calzado
  //     que aguante, prefiero que salga la bota a que salga un mocasín.
  //     Funcional feo gana a bonito empapado. Es la misma lógica de siempre —
  //     sin recambio, la regla se calla.
  if (ctx.closet?.length) {
    const esDeMontana = (i: EngineItem) =>
      tipoDePrenda(nombre(i))?.zona === "pie" &&
      /senderismo|hiking|trekking|monta[nñ]a|traeking|goretex|gore-tex|columbia|salomon|merrell|timberland|caterpillar|nieve|snow/.test(
        TIPO(i)
      );
    const montaneras = items.filter(esDeMontana);
    if (montaneras.length) {
      const puestas = new Set(items.map((i) => i.id));
      const otros = ctx.closet
        .filter((i) => !puestas.has(i.id))
        .filter((i) => tipoDePrenda(nombre(i))?.zona === "pie")
        .filter((i) => !esDeMontana(i));
      // Con lluvia, el recambio además tiene que aguantar el agua: cambiar una
      // bota impermeable por un mocasín sería "arreglar" hacia atrás.
      const aptos = ctx.lluvia
        ? otros.filter((i) => {
            const t = tipoDePrenda(nombre(i))?.tipo;
            if (t && FORMA_NO_AGUANTA.has(t)) return false;
            const m = norm(i.attrs.material);
            return !m || !MATERIAL_SE_ARRUINA.test(m);
          })
        : otros;
      if (aptos.length) {
        v.push({
          regla: "bota-de-montana-en-la-calle",
          detalle: `"${nombre(montaneras[0])}" es calzado de montaña, no de calle: la suela y los refuerzos técnicos rompen el registro del look. Cámbiala por ${aptos
            .slice(0, 2)
            .map(nombre)
            .join(" o ")}.`,
        });
      }
    }
  }

  // 6. LLUVIA Y EL CALZADO. Es el fallo más marcado del veredicto: 4 de los 6
  //    defectos de clima de toda la corrida cayeron en el brief de lluvia, y
  //    los DOS motores fallaron ahí (Gemini 3, producción 1). Que el prompt
  //    afinado 38 veces contra Claude también fallara es la prueba de que esto
  //    no es cosa de pedirlo mejor: va comprobado.
  //
  //    Y falla EL CALZADO, no el abrigo: en 2 de los 3 casos de Gemini la
  //    chamarra impermeable SÍ estaba, y el look se caía por unos tenis
  //    blancos. Una regla sobre la capa exterior habría pasado por encima de
  //    los dos.
  if (ctx.lluvia && ctx.closet?.length) {
    const esPie = (i: EngineItem) => tipoDePrenda(nombre(i))?.zona === "pie";
    // Abierto (sandalia, huarache) o de un material que el agua arruina.
    const noAguanta = (i: EngineItem) => {
      const t = tipoDePrenda(nombre(i))?.tipo;
      // La FORMA manda sobre el material: un mocasín de piel sigue siendo un
      // mocasín. Este orden importa — al revés, la piel lo absolvía.
      if (t && FORMA_NO_AGUANTA.has(t)) return true;
      const m = norm(i.attrs.material);
      // Sin material no se juzga: una regla que dispara por datos incompletos
      // manda al juez a "arreglar" lo que estaba bien.
      return !!m && MATERIAL_SE_ARRUINA.test(m);
    };
    const malos = items.filter(esPie).filter(noAguanta);
    if (malos.length) {
      const alternativas = ctx.closet.filter(esPie).filter((i) => !noAguanta(i));
      // Sin recambio no es un fallo reparable sino una carencia: se calla, igual
      // que la regla del frío.
      if (alternativas.length) {
        v.push({
          regla: "lluvia-calzado",
          detalle: `Va a llover y el look lleva "${malos
            .map(nombre)
            .join('", "')}" — ese material se arruina con el agua. Cámbialo por algo que aguante: ${alternativas
            .slice(0, 4)
            .map(nombre)
            .join(", ")}. Piel y sintético pasan; ante, gamuza y tela no.`,
        });
      }
    }

    // 6b. Y AUNQUE AGUANTE: con lluvia el calzado escotado PIERDE contra el que
    //     cubre el tobillo, si el clóset tiene uno de formalidad igual o mayor.
    //
    //     POR QUÉ ES PREFERENCIA Y NO PROHIBICIÓN. Roberto no dijo que los tenis
    //     estén prohibidos; en el mismo par escribió las dos cosas: "Gana por el
    //     calzado" (sobre unos botines Chelsea) y "calzado no ideal para lluvia"
    //     (sobre unos tenis). Eso es un ORDEN, no un veto — y ninguna
    //     prohibición encajaba con sus dos frases a la vez.
    //
    //     POR QUÉ EL TOBILLO Y NO LA SUELA. Se leyó la suela de 161 zapatos para
    //     esto y NO servía: sus tenis de piel (que marcó mal) y sus tenis
    //     blancos (que aprobó "por la suela gruesa") salieron los dos gruesa, y
    //     el dato trae ~12% de ruido. El tobillo sí es observable y sí es el
    //     mecanismo que él mismo describió: el agua entra por arriba. Esto
    //     generaliza con un principio la lista fija FORMA_NO_AGUANTA.
    //
    //     EL GUARDIA DE FORMALIDAD NO ES UN PARCHE, es la regla: no se baja el
    //     nivel del look para resolver el clima. Sin él, la propuesta hacía
    //     reprobar TODOS los zapatos de vestir bajo lluvia — se simuló contra su
    //     clóset antes de escribirla y por eso existe esta línea.
    //
    //     LO QUE SÍ SE ACEPTA: marca también unos tenis que Roberto aprobó. No
    //     hay dato que separe esos dos pares, y el costo del falso positivo es
    //     cero — la reparación pone justo las botas que él llamó ganadoras.
    const NIVEL: Record<string, number> = { casual: 0, "formal-casual": 1, formal: 2 };
    const nivelDe = (i: EngineItem) => NIVEL[norm(i.attrs.formalidad)] ?? 0;
    const cubre = (i: EngineItem) => i.attrs.cubre_tobillo === true;
    for (const z of items.filter(esPie)) {
      // `=== false` y no `!cubre`: sin el dato no se inventa el error.
      if (z.attrs.cubre_tobillo !== false) continue;
      if (noAguanta(z)) continue; // ya lo marcó la regla de arriba
      const mejores = ctx.closet
        .filter(esPie)
        .filter(cubre)
        .filter((i) => !noAguanta(i))
        .filter((i) => nivelDe(i) >= nivelDe(z));
      if (!mejores.length) continue;
      v.push({
        regla: "lluvia-mejor-calzado",
        detalle: `Va a llover y "${nombre(z)}" es escotado: el agua entra por arriba. Tienes calzado que cubre el tobillo y sirve igual para este look — cámbialo por ${mejores
          .slice(0, 2)
          .map(nombre)
          .join(" o ")}.`,
      });
    }
  }

  // 7. LLUVIA Y LA CAPA DE ARRIBA — pero solo SIN paraguas.
  //    La distinción es de Roberto y es correcta: el paraguas tapa el torso,
  //    así que con paraguas la capa se elige por estilo. Sin él, tiene que
  //    repeler agua. Sin la distinción, cada día de lluvia colapsaría a la
  //    misma chamarra impermeable durante toda la temporada.
  if (ctx.lluvia && !ctx.paraguas && ctx.closet?.length) {
    const esCapa = (i: EngineItem) => tipoDePrenda(nombre(i))?.zona === "capa";
    const repele = (i: EngineItem) =>
      familiaMaterial(i.attrs.material, i.attrs.nombre) === "tecnico" ||
      /impermeable|gabardina|chubasquero|rompevientos|parka/.test(TIPO(i));
    const capas = items.filter(esCapa);
    if (!capas.some(repele)) {
      const disponibles = ctx.closet.filter(esCapa).filter(repele);
      if (disponibles.length) {
        v.push({
          regla: "lluvia-sin-impermeable",
          detalle: `Va a llover, no lleva paraguas, y ${
            capas.length
              ? `"${capas.map(nombre).join('", "')}" no repele agua`
              : "el look no lleva capa de abrigo"
          }. Su clóset sí tiene con qué: ${disponibles
            .slice(0, 3)
            .map(nombre)
            .join(", ")}.`,
        });
      }
    }
  }

  // 8. UNA PRENDA POR ZONA. Estructural, no de gusto: dos pares de zapatos o
  //    dos suéteres apilados no es un estilo, es un error de armado. Los dos
  //    salieron del veredicto, los dos de Gemini y los dos marcados por
  //    Roberto: "metió dos pares de zapatos" (mocasines burdeos + zapato
  //    formal negro) y "metió suéteres repetidos" (cuello V marino + lana
  //    negro).
  //
    //    Se mira el TIPO FINO, no la zona. Primero lo escribí por zona y el
    //    test viejo lo cazó de inmediato: camisa y camiseta son las dos
    //    "torso", y una camiseta BAJO una camisa es exactamente lo que la
    //    regla de abajo pide. Por tipo fino no hay ambigüedad — dos mocasines
    //    son dos mocasines, y una camisa sobre una camiseta son dos cosas
    //    distintas.
  //    Dos criterios, porque el cuerpo no es simétrico:
  //    - PIES y PIERNAS: uno solo, punto. Dos calzados CUALESQUIERA son un
  //      error aunque sean de tipos distintos (los mocasines burdeos y el
  //      zapato formal negro del veredicto eran justo eso).
  //    - TORSO: se apila por diseño, así que solo cuenta repetir el MISMO
  //      tipo (dos suéteres sí; camiseta bajo camisa no). Lo cazó un test
  //      viejo cuando lo escribí por zona: camisa y camiseta son las dos
  //      "torso", y esa combinación es la que la regla de abajo PIDE.
  const dup = (cuales: EngineItem[], que: string) => {
    if (cuales.length < 2) return;
    v.push({
      regla: "zona-duplicada",
      detalle: `El look lleva ${cuales.length} ${que}: ${cuales
        .map(nombre)
        .join(", ")}. Solo se usa una a la vez — quita la que sobre.`,
    });
  };
  const deZona = (z: string) =>
    items.filter((i) => tipoDePrenda(nombre(i))?.zona === z);
  dup(deZona("pie"), "pares de calzado");
  dup(deZona("pierna"), "prendas de pierna");

  const porTipo = new Map<string, EngineItem[]>();
  for (const i of items) {
    const t = tipoDePrenda(nombre(i));
    if (!t || t.zona !== "torso") continue;
    porTipo.set(t.tipo, [...(porTipo.get(t.tipo) ?? []), i]);
  }
  for (const [, cuales] of porTipo) dup(cuales, "prendas del mismo tipo");

  // 8b. Y EL ESPEJO DE LA ANTERIOR: QUE NO FALTE UNA ZONA.
  //
  //     La 8 caza que SOBRE una prenda en una zona; nadie cazaba que FALTE. El
  //     motor valida que el look traiga ≥2 prendas reales y nada más, así que
  //     "Suéter gris + Camisa blanca" —sin pantalón y sin zapatos— pasaba
  //     entero. Medido sobre los 153 looks reales de la base: 3 sin nada que
  //     cubra las piernas y 6 sin calzado. Eso es un look roto llegando a una
  //     persona que preguntó qué ponerse.
  //
  //     FALLO CONTRA CARENCIA, la distinción que este archivo ya usa: sólo se
  //     marca si el clóset TIENE con qué cubrir la zona. Quien no tiene un solo
  //     par de zapatos dados de alta no está ante un error reparable, y mandar
  //     al juez a arreglar lo que no se puede es peor que callar.
  //
  //     EL TRAJE DE BAÑO CUENTA COMO ABAJO. Un look de alberca es sandalias +
  //     traje de baño + camisa, y ahí la prenda de abajo ES el traje de baño
  //     aunque su zona sea "no-calle". Sin esta excepción la regla marcaba los
  //     dos looks de viaje de la base, que están bien.
  //
  //     Y SI ALGO NO SE RECONOCE, NO SE JUZGA: una prenda que el vocabulario no
  //     sabe leer podría estar cubriendo la zona. Callar ahí es lo que separa
  //     esta regla de una que marque de más. (Hoy el vocabulario reconoce el
  //     99.8% del catálogo real, así que casi nunca aplica.)
  //     EL CALZADO NO ENTRA, Y ESO SE MIDIÓ. La primera versión pedía también
  //     zapatos y fue la única zona que produjo un falso positivo sobre los 153
  //     looks reales: torso marcó 7 con 0 aprobados, pierna 13 con 0, y pie 7
  //     con UNO — "Lino y campo" (camisa de lino + camisa de mezclilla + chinos
  //     oliva), que no lleva calzado en la fila y tiene un evento `worn`: una
  //     persona real SE LO PUSO. Obviamente con zapatos; la app no los nombró y
  //     a ella no le estorbó.
  //
  //     La lectura de producto es que el calzado es la zona que la gente rellena
  //     sola, y el pantalón no. Marcar el calzado mandaría al juez a reparar
  //     looks que alguien ya se puso — el peor tipo de falso positivo que puede
  //     tener este archivo.
  const ZONAS_QUE_VISTEN: { zona: Zona; que: string; pide: string }[] = [
    { zona: "torso", que: "nada de la cintura para arriba", pide: "una prenda de torso" },
    { zona: "pierna", que: "nada que cubra las piernas", pide: "un pantalón, falda o short" },
  ];
  const tiposDe = (its: EngineItem[]) => its.map((i) => tipoDePrenda(nombre(i)));
  const tiposLook = tiposDe(items);
  const todoReconocido = tiposLook.every(Boolean);
  const hayBano = tiposLook.some((t) => t?.zona === "no-calle" && t.tipo === "bano");
  if (todoReconocido && items.length > 0) {
    const cubiertas = new Set(tiposLook.flatMap((t) => t!.zonas));
    for (const { zona, que, pide } of ZONAS_QUE_VISTEN) {
      if (cubiertas.has(zona)) continue;
      if (zona === "pierna" && hayBano) continue;
      // Carencia, no fallo: sin clóset que consultar tampoco se acusa.
      const enClosetHay = (ctx.closet ?? []).some((i) =>
        tipoDePrenda(nombre(i))?.zonas.includes(zona)
      );
      if (!enClosetHay) continue;
      v.push({
        regla: "zona-sin-cubrir",
        detalle: `El look sale ${que}: ${items
          .map(nombre)
          .join(", ")}. Añade ${pide} de su clóset, que sí lo tiene.`,
      });
    }
  }

  // 9. EL SUÉTER PIDE ALGO DEBAJO. La observación más repetida de Roberto en
  //    todo el veredicto: SIETE comentarios de "falta t-shirt abajo", en los
  //    dos motores. Y volvió a salir calibrando el eval: "es muy raro que haya
  //    el suéter directo y no haya una playera abajo… esto es recurrente".
  //
  //    SOLO PARA HOMBRE, y esto se investigó antes de escribirlo. En el
  //    guardarropa masculino la base bajo el punto es convención (comodidad —
  //    la lana pica—, absorber el sudor, y que el suéter se lave menos). En el
  //    femenino NO lo es: llevar el punto a piel es una elección normal y el
  //    camisol es opcional. Sin el género, la regla marcaba como error algo
  //    correcto en la mitad de los clósets — el mismo sesgo que ya costó dos
  //    correcciones en alcance.ts, aquí al revés.
  //    Sin género declarado tampoco dispara: en la duda, no inventar el error.
  //
  //    QUÉ VALE COMO BASE (del research): camiseta de cuello redondo, camisa de
  //    cuello, polo, y el cuello tortuga bajo un suéter de pico. Lo que NO
  //    cuenta como suéter-a-piel es el propio cuello tortuga: es cerrado y se
  //    lleva a piel por diseño, así que queda excluido de la regla.
  const esSueter = (i: EngineItem) =>
    /su[eé]ter|sweater|cardigan|c[aá]rdigan|jersey|punto|knit/.test(TIPO(i)) &&
    !/cuello (alto|tortuga)|turtleneck/.test(TIPO(i));
  const esBaseDebajo = (i: EngineItem) =>
    /camiseta|playera|camisa|polo|t-?shirt|blusa|top b[aá]sico|cuello (alto|tortuga)|turtleneck/.test(
      TIPO(i)
    );
  const sueters = items.filter(esSueter);
  if (ctx.gender === "hombre" && sueters.length && !items.some(esBaseDebajo)) {
    v.push({
      regla: "sueter-sin-base",
      detalle: `"${nombre(sueters[0])}" va sobre la piel: un suéter casi siempre pide algo debajo (camiseta, polo o camisa) — se ve mejor y se puede quitar una capa. Añade una base del clóset.`,
    });
  }

  // 9b. EL CUELLO ALTO **DE PUNTO** TAMBIÉN PIDE BASE.
  //
  //     ESTO CORRIGE LA REGLA DE ARRIBA, que excluía el cuello alto a propósito
  //     con este argumento escrito: "es cerrado y se lleva a piel por diseño".
  //     El argumento vale para un cuello alto DELGADO y no para uno de punto, y
  //     lo desmintió Roberto en el veredicto de Gemini 3.7 — tres veces, en
  //     pares distintos y VOTANDO A CIEGAS, que es la evidencia más limpia que
  //     este proyecto puede producir sobre un gusto:
  //
  //         "falta una playera abajo del cuello de tortuga"
  //         "falta algo abajo del cuello de tortuga..."
  //         "falta algo abajo del cuello de tortuga, SOBRE TODO PORQUE ES UN SUÉTER"
  //
  //     Esa última frase es la que fija el alcance y por eso la regla no aplica
  //     a todo cuello alto: la lana pica y se lava peor, y ahí la base hace el
  //     mismo trabajo que bajo cualquier suéter. Un cuello alto fino de algodón
  //     sí está diseñado para ir a piel y se queda fuera.
  //
  //     LA BASE AQUÍ NO PUEDE SER OTRO CUELLO ALTO, a diferencia de la regla 9:
  //     allá el cuello alto es una base válida bajo un suéter de pico (y sigue
  //     siéndolo). Lo que se pide es lo que va DEBAJO del cuello alto mismo.
  const esCuelloAlto = (i: EngineItem) => /cuello (alto|tortuga)|turtleneck/.test(TIPO(i));
  //     Sin material declarado, `familiaMaterial` cae en el nombre y "cuello
  //     alto" ya mapea a punto. Es conservador en la dirección correcta: de las
  //     9 prendas así en la base, todas son de punto ("de lana merino",
  //     "suéter de cuello alto"). Un cuello alto fino declarará su algodón.
  //     CUARTA VEZ (2026-08-22, ronda 08f46d3e): "Cuello tortuga negro" —sin
  //     material y sin 'suéter' en el nombre— pasó sin base y Roberto: "falta
  //     algo abajo del cuello de tortuga, inclusive una playera como ropa
  //     interior… batallamos con esto seguido". El comentario de arriba decía
  //     que el nombre ya mapeaba a punto; no mapeaba. Ahora un cuello alto o
  //     tortuga ES de punto salvo que declare lo contrario (algodón, fino).
  const declaraFino = (i: EngineItem) =>
    /algod[oó]n|fino|delgado|modal|lycra|el[aá]stic/.test(`${TIPO(i)} ${norm(i.attrs.material)}`);
  const esDePunto = (i: EngineItem) =>
    familiaMaterial(i.attrs.material, i.attrs.nombre) === "punto" ||
    /su[eé]ter|lana|merino|cachemir|cashmere|alpaca/.test(TIPO(i)) ||
    (esCuelloAlto(i) && !declaraFino(i));
  const esBaseFina = (i: EngineItem) =>
    /camiseta|playera|camisa|polo|t-?shirt|blusa|top b[aá]sico/.test(TIPO(i));
  const cuellosDePunto = items.filter((i) => esCuelloAlto(i) && esDePunto(i));
  if (ctx.gender === "hombre" && cuellosDePunto.length && !items.some(esBaseFina)) {
    v.push({
      regla: "cuello-alto-sin-base",
      detalle: `"${nombre(cuellosDePunto[0])}" es de punto y va directo sobre la piel: pide una camiseta debajo — la lana pica, y con base se ve mejor y se lava menos. Añade una del clóset.`,
    });
  }

  // 10. MANGA CORTA CON SACO, NUNCA. Roberto, dos veces en el mismo veredicto
  //     y con signos de admiración: "Manga corta con saco jamás!!" y "Camisa
  //     de manga corta en traje jamás!!". Es una regla de código de vestir, no
  //     una preferencia: la manga del saco deja ver que no hay manga debajo.
  const esMangaCorta = (i: EngineItem) =>
    /manga corta|polo de manga corta/.test(TIPO(i)) ||
    (/camisa|camiseta/.test(TIPO(i)) && /manga corta/.test(norm(i.attrs.manga)));
  const conSaco = items.find((i) => esSaco(i) || /esmoquin|smoking|traje/.test(TIPO(i)));
  const mangaCorta = items.find(esMangaCorta);
  if (conSaco && mangaCorta) {
    v.push({
      regla: "manga-corta-con-saco",
      detalle: `"${nombre(mangaCorta)}" es de manga corta y el look lleva "${nombre(conSaco)}": bajo un saco va manga larga siempre — la manga corta se asoma y arruina la línea. Cámbiala por una camisa de manga larga.`,
    });
  }

  // 10b. CAMISA DE MEZCLILLA CON SACO. Roberto, dos veces en la ronda 8559ec99
  //      (2026-08-19): "camisa de mezclilla, blazer marino, pantalón negro —
  //      se ve culerísimo… es como camisa de mezclilla con blazer, hazme el
  //      favor" y "esa camisa de mezclilla no va con ese traje… es algo más
  //      informal, no va con traje". Dos registros que no se hablan: la
  //      mezclilla es tela de trabajo y el saco es sastrería; juntos se leen
  //      como dos looks a medias.
  //
  //      MEDIDA ANTES DE CABLEARLA (scripts/ablacion-votos.ts): 2 de sus 27 👎,
  //      0 de sus 68 👍. Una camisa de mezclilla bajo un suéter o una chaqueta
  //      sí la aprueba — por eso la regla es con SACO, no con cualquier capa.
  {
    const esCamisaMezclilla = (i: EngineItem) =>
      /camisa/.test(TIPO(i)) && /mezclilla|denim|chambray/.test(`${TIPO(i)} ${norm(i.attrs.material)}`);
    const camisa = items.find(esCamisaMezclilla);
    const saco = camisa ? items.find((i) => esSaco(i) || /traje/.test(TIPO(i))) : undefined;
    if (camisa && saco) {
      v.push({
        regla: "mezclilla-con-saco",
        detalle: `"${nombre(camisa)}" bajo "${nombre(
          saco
        )}": la mezclilla es tela de trabajo y el saco es sastrería — juntos se leen como dos looks a medias. Cámbiala por una camisa lisa de manga larga (blanca, azul claro) y deja la de mezclilla para un suéter o una chaqueta.`,
      });
    }
  }

  // 11. MOCASÍN EN FRÍO. Medido sobre los 309 looks marcados de Roberto: el
  //     mocasín en general va bien (16% de 👎, igual que la línea base), pero
  //     EN FRÍO se dispara a 44% contra 6% del resto del calzado en frío
  //     (p = 0.038, repartido en 4 briefs y los dos motores). Es el escote y
  //     la suela fina: el mismo rasgo que lo descalifica en lluvia.
  if (ctx.clima === "frio" && ctx.closet?.length) {
    const esMocasin = (i: EngineItem) => tipoDePrenda(nombre(i))?.tipo === "mocasin";
    const puestos = items.filter(esMocasin);
    if (puestos.length) {
      const esPie = (i: EngineItem) => tipoDePrenda(nombre(i))?.zona === "pie";
      const alternativas = ctx.closet.filter((i) => esPie(i) && !esMocasin(i));
      if (alternativas.length) {
        v.push({
          regla: "mocasin-en-frio",
          detalle: `Hace frío y el look lleva "${puestos
            .map(nombre)
            .join('", "')}": el mocasín es escotado y de suela fina, se siente frío. Cámbialo por algo cerrado: ${alternativas
            .slice(0, 4)
            .map(nombre)
            .join(", ")}.`,
        });
      }
    }
  }

  // 12. EN UN EVENTO FORMAL, EL TRAJE VA COMPLETO. Blazer con pantalón de otro
  //     color son "separates": correctos para la oficina, cortos para una boda
  //     formal. Es la única regla de esta tanda que salió de DOS fuentes
  //     independientes que no se hablan entre sí — Roberto la escribió cuatro
  //     veces en el veredicto ("No mantuvo el traje completo", "a menos que el
  //     pantalón y saco sean del mismo traje, esto está mal") y el juez
  //     automático la levantó solo, en looks distintos: "el blazer marino con
  //     pantalón gris es un combo de separates, no el traje oscuro que pide una
  //     boda formal de noche en salón".
  //
  //     Solo dispara si el clóset TIENE un traje: sin él no es un fallo
  //     reparable sino una carencia, igual que el frío sin abrigo.
  if ((ctx.formality === "formal" || ctx.formality === "gala") && ctx.closet?.length) {
    const esTraje = (i: EngineItem) =>
      /traje|esmoquin|smoking|tuxedo/.test(TIPO(i));
    const saco = items.find(esSaco);
    if (saco && !items.some(esTraje)) {
      const trajes = ctx.closet.filter(esTraje);
      if (trajes.length) {
        v.push({
          regla: "separates-en-evento-formal",
          detalle: `Es un evento formal y el look arma con piezas sueltas ("${nombre(saco)}" con un pantalón de otro juego). Eso son separates: bien para la oficina, cortos para aquí. Su clóset tiene traje completo: ${trajes
            .slice(0, 3)
            .map(nombre)
            .join(", ")}. Úsalo con su propio pantalón.`,
        });
      }
    }
  }

  // 13. EL RELOJ DEPORTIVO NO VA CON SASTRE. Salió del cruce del 2026-08-19:
  //     el juez stylist lo marcó en CUATRO looks y Roberto lo confirmó con la
  //     nota más contundente de la ronda — "Tiene toda la razón el reloj. Este
  //     100% rompe con el look" (un reloj de caucho con traje completo).
  //
  //     EL GATE LLEVA SU EXCEPCIÓN, dicha por él en la misma ronda: "podría
  //     hacer una excepción para temas de smart watch en un día normal". Por
  //     eso dispara SOLO con piezas de sastre en el look o formalidad
  //     formal/gala — en diario, oficina y casual el smart watch pasa.
  //
  //     "Deportivo" se decide por dato, no por adivinanza: la formalidad
  //     `casual` del catálogo, o palabras del nombre/material (caucho,
  //     silicona, smart, garmin, digital). Un reloj sin formalidad ni señas no
  //     se juzga — sin dato no se inventa el error.
  {
    const esReloj = (i: EngineItem) => /reloj|\bwatch/.test(TIPO(i));
    const esDeportivo = (i: EngineItem) =>
      norm(i.attrs.formalidad) === "casual" ||
      /deportiv|smart ?watch|garmin|caucho|silicona|digital/.test(
        `${TIPO(i)} ${norm(i.attrs.material)}`
      );
    const esSastre = (i: EngineItem) => /traje|esmoquin|smoking|tuxedo/.test(TIPO(i));
    const esFormal = ctx.formality === "formal" || ctx.formality === "gala";
    if (esFormal || items.some(esSastre)) {
      for (const r of items.filter((i) => esReloj(i) && esDeportivo(i))) {
        v.push({
          regla: "reloj-deportivo-con-sastre",
          detalle: `"${nombre(r)}" es un reloj deportivo (correa de caucho, caja de uso rudo) y este look es de sastre o de evento formal: desentona con todo lo demás. Cámbialo por un reloj de vestir (piel o metal) o quítalo — la muñeca desnuda es más elegante que la muñeca equivocada.`,
        });
      }
    }
  }

  // 14. LA CORBATA DE PUNTO NO VA A CEREMONIA. Del mismo cruce: el juez la
  //     marcó en una boda elegante de salón y Roberto lo confirmó dos veces
  //     ("Sí, no va la corbata de punto"). La textura tejida y la punta
  //     cuadrada son de registro casual-elegante — cita, oficina con corbata —
  //     no de ceremonia. SOLO dispara en formal/gala: en los demás contextos
  //     la corbata de punto es justo la elección correcta.
  if (ctx.formality === "formal" || ctx.formality === "gala") {
    const esCorbataDePunto = (i: EngineItem) =>
      /corbata/.test(TIPO(i)) && /punto|tejid|knit/.test(TIPO(i));
    for (const c of items.filter(esCorbataDePunto)) {
      v.push({
        regla: "corbata-de-punto-en-ceremonia",
        detalle: `"${nombre(c)}" es de punto: textura tejida y punta cuadrada, registro casual-elegante. Para una ceremonia va una corbata de seda con acabado liso. Cámbiala si el clóset tiene una; la de punto guárdala para una cita u oficina.`,
      });
    }
  }

  // 23. RETIRADA (2026-08-22): `colores-que-no-se-leen`, la regla de armonía
  //     de color de v53. Se midió cinco rondas con su ablación
  //     (sin-coherencia-cromatica) y NUNCA se ganó el lugar: empate, empate,
  //     empate, perdió 3-1, y en la quinta —ya con el clóset de referencia—
  //     el lado sin ella aprobó más (79% contra 64%). Estaba pre-registrado
  //     desde que nació: "si apagarla gana, se revierte". Además vetaba
  //     reparaciones correctas (rechazaba la camisa blanca y el abrigo marino
  //     como arreglos) y no tenía reparador. La medición (lib/engine/
  //     coherencia-cromatica.ts) se queda como biblioteca, por si vuelve con
  //     otra forma; aquí ya no dispara nada.

  if (!ctx.sinReglasV61) {
  // 24. BODA DE NOCHE → CAMISA BLANCA. Roberto, CINCO veces en dos rondas
  //     (075a3f12 y 08f46d3e): "boda de noche no va con camisa azul, sería
  //     mejor blanco", "este es más look para boda de día por el color de la
  //     camisa". La etiqueta le da la razón: de noche el registro sube y la
  //     camisa blanca es el estándar; la de color es de día. Sólo dispara si
  //     el clóset TIENE una camisa blanca (sin recambio es carencia).
  if (ctx.tipoEvento === "boda" && ctx.momento === "noche" && ctx.closet?.length) {
    const esCamisaVestir = (i: EngineItem) =>
      /camisa/.test(TIPO(i)) && !/mezclilla|denim|chambray|lino|manga corta|franela|cuadros/.test(TIPO(i));
    const esBlanca = (i: EngineItem) => /blanc/.test(`${norm(i.attrs.color)} ${TIPO(i)}`);
    const deColor = items.filter((i) => esCamisaVestir(i) && !esBlanca(i));
    const blancas = ctx.closet.filter((i) => esCamisaVestir(i) && esBlanca(i));
    if (deColor.length && blancas.length) {
      v.push({
        regla: "boda-de-noche-camisa-blanca",
        detalle: `"${nombre(deColor[0])}" en una boda de NOCHE: la camisa de color es de día — de noche el registro sube y va camisa blanca (${blancas.slice(0, 2).map(nombre).join(" o ")}). Cámbiala.`,
      });
    }
  }

  // 25. CAMISA DE VESTIR BAJO OVERSHIRT. Tres veces, dos rondas: "camisa
  //     oxford con sobrecamisa? ni al caso", "no va la camisa esa de vestir
  //     abajo de la overshirt, se ve rarísimo". La overshirt ES una camisa:
  //     cuello sobre cuello y registro contra registro. La de mezclilla o
  //     franela (casual, se lleva como capa media) sí pasa — y así votó él.
  {
    const esOvershirt = (i: EngineItem) => /overshirt|sobrecamisa/.test(TIPO(i));
    const esCamisaVestir = (i: EngineItem) =>
      /camisa/.test(TIPO(i)) && !/mezclilla|denim|chambray|franela|cuadros|manga corta/.test(TIPO(i));
    const over = items.find(esOvershirt);
    const camisa = over ? items.find(esCamisaVestir) : undefined;
    if (over && camisa) {
      v.push({
        regla: "camisa-de-vestir-bajo-overshirt",
        detalle: `"${nombre(camisa)}" debajo de "${nombre(over)}": la overshirt ya es una camisa — cuello sobre cuello se ve amontonado y los registros pelean. Debajo va una camiseta o playera lisa; la camisa de vestir, sola o bajo un suéter.`,
      });
    }
  }

  // 26. CALZADO CAFÉ/BURDEOS CON TRAJE NEGRO. Tres veces ("fallan los
  //     mocasines cafés, ya te lo había dicho" — él llama café al burdeos, y
  //     en esto la sastrería le da la razón: el traje NEGRO es el único que no
  //     admite calzado café; con marino o gris el café es correcto y no se
  //     toca). Sólo con SACO de traje negro puesto: pantalón negro suelto es
  //     otra cosa (y botín café con jeans negros casual él lo aprueba).
  {
    const esSacoNegro = (i: EngineItem) =>
      /saco|esmoquin|smoking/.test(TIPO(i)) && /traje|esmoquin|smoking/.test(TIPO(i)) && /negr/.test(`${norm(i.attrs.color)} ${TIPO(i)}`);
    const esPie = (i: EngineItem) => tipoDePrenda(nombre(i))?.zona === "pie";
    const esCalido = (i: EngineItem) =>
      /caf[eé]|marr[oó]n|chocolate|burdeos|cognac|tabaco|miel/.test(`${norm(i.attrs.color)} ${TIPO(i)}`);
    const saco = items.find(esSacoNegro);
    const calzado = saco ? items.filter((i) => esPie(i) && esCalido(i)) : [];
    if (saco && calzado.length && ctx.closet?.length) {
      const negros = ctx.closet.filter((i) => esPie(i) && /negr/.test(`${norm(i.attrs.color)} ${TIPO(i)}`));
      if (negros.length) {
        v.push({
          regla: "calzado-cafe-con-traje-negro",
          detalle: `"${nombre(calzado[0])}" con traje NEGRO: el negro es el único traje que no admite calzado café o burdeos — se lee como error, no como decisión. Va calzado negro (${negros.slice(0, 2).map(nombre).join(" o ")}); con traje marino o gris el café sí es correcto.`,
        });
      }
    }
  }

  // 27. CHAROL SÓLO CON ETIQUETA. Roberto: "el charol según yo va para
  //     jaquet, smoking o frac (investiga)" — y la investigación le da la
  //     razón: el charol es calzado de ETIQUETA. Con un traje de calle, aunque
  //     sea una boda formal, desentona. Pasa sólo si el look trae esmoquin o
  //     la formalidad es gala.
  {
    const esCharol = (i: EngineItem) => /charol|patent/.test(TIPO(i));
    const charol = items.find(esCharol);
    const esEtiqueta = ctx.formality === "gala" || items.some((i) => /esmoquin|smoking|tuxedo|frac|jaquet/.test(TIPO(i)));
    if (charol && !esEtiqueta && ctx.closet?.length) {
      const otros = ctx.closet.filter(
        (i) => tipoDePrenda(nombre(i))?.zona === "pie" && !esCharol(i) && /negr/.test(`${norm(i.attrs.color)} ${TIPO(i)}`) && norm(i.attrs.formalidad) === "formal"
      );
      if (otros.length) {
        v.push({
          regla: "charol-solo-etiqueta",
          detalle: `"${nombre(charol)}" es de charol: calzado de ETIQUETA (smoking, jaquet, frac). Con traje de calle desentona aunque el evento sea formal. Cámbialo por un formal negro liso (${otros.slice(0, 2).map(nombre).join(" o ")}).`,
        });
      }
    }
  }

  // 28. BODA DE NOCHE SIN CORBATA. Por DECRETO de Roberto (2026-08-24), tras
  //     tres menciones: "las bodas de noche deben de ser de corbata… no
  //     necesitas más cosas mías para que la vuelva a cagar para hacerlo
  //     regla". Con SUS dos excepciones de fábrica: si el dress code dice
  //     coctel (semiformal explícito) se relaja, y en etiqueta rigurosa manda
  //     el smoking con moño — el moño cuenta como corbata aquí, y el código
  //     completo del smoking lo vigila su propia regla.
  if (
    ctx.tipoEvento === "boda" &&
    ctx.momento === "noche" &&
    ctx.formality !== "semiformal" &&
    ctx.formality !== "casual" &&
    ctx.formality !== "playa" &&
    ctx.closet?.length
  ) {
    const esCuello = (i: EngineItem) => /corbata|mo[ñn]o|pajarita|corbat[ií]n/.test(TIPO(i));
    const conSaco = items.some((i) => /saco|esmoquin|smoking|blazer/.test(TIPO(i)));
    if (conSaco && !items.some(esCuello)) {
      const corbatas = ctx.closet.filter(esCuello);
      if (corbatas.length) {
        v.push({
          regla: "boda-de-noche-sin-corbata",
          detalle: `Boda de NOCHE con saco y sin corbata: de noche la corbata no es opcional — sólo un dress code de coctel explícito la relaja, y la etiqueta rigurosa pide moño. Ponle una (${corbatas.slice(0, 2).map(nombre).join(" o ")}).`,
        });
      }
    }
  }

  } // fin de las reglas de v61 (ablación: sinReglasV61)

  return v;
}

/** Bloque para el mensaje del juez. Vacío si el look está limpio. */
/**
 * LAS REGLAS DE LA CASA, en una lista que un juez puede leer.
 *
 * VIVE JUNTO AL CÓDIGO QUE LAS EJECUTA a propósito: si agregas o cambias una
 * regla arriba, actualiza su línea aquí EN EL MISMO COMMIT. Es el precio de
 * que los jueces las conozcan — y es barato comparado con lo que costó no
 * pagarlo: el juez stylist recomendó tres veces "quita la camiseta de abajo
 * del suéter" contradiciendo `sueter-sin-base`, Roberto lo calificó de
 * exagerado en cada una ("es de las reglas que hemos puesto"), y el acierto
 * del juez cayó a 47% con el tema de capas dominando los desacuerdos
 * (2026-08-19). Un juez que no conoce las reglas de la casa manda a deshacer
 * lo que la casa decidió.
 *
 * Son PRINCIPIOS con su mecanismo, no incidentes: la línea dice cuándo aplica
 * y cuándo no, porque la mitad de las calificaciones de Roberto fueron
 * excepciones ("en diario el smart watch pasa").
 */
export const REGLAS_DE_LA_CASA = `REGLAS DE LA CASA (ya verificadas en código; el motor las ejecuta y las repara solo):
- En clóset de HOMBRE, un suéter o cuello alto de punto lleva base debajo (camiseta/camisa). Que la traiga NO es un defecto — es la regla; nunca recomiendes quitarla. En mujer, el punto a piel es elección normal.
- Los cueros del look dialogan: café con café, negro con negro. Un cinturón o reloj que choca con el calzado se cambia al color del calzado o se quita. Cinturón negro con mocasín burdeos es un DETALLE (él lo reconoce cuando se lo señalan, y aprueba el look igual): se repara, no tira el look. Y un botín café con jeans negros en un look casual pasa — lo que rompe es el café dentro de un look NEGRO de arriba abajo.
- Con chinos beige, caqui o camel el calzado y el cinturón NO van en negro: van café, marrón, burdeos o ante.
- Camisa de mezclilla con saco, blazer o traje, nunca: bajo un suéter o una chaqueta sí.
- En boda de NOCHE la camisa es blanca; la de color es de día. Y de noche la corbata NO es opcional: sólo un dress code de coctel explícito la relaja (en etiqueta rigurosa, moño).
- La camisa de vestir no va debajo de una overshirt (cuello sobre cuello): ahí va camiseta o playera. La de mezclilla o franela sí pasa.
- Con traje NEGRO el calzado es negro — es el único traje que no admite café ni burdeos. Con marino o gris, el café es correcto.
- El charol es de etiqueta (smoking, jaquet, frac): con traje de calle no va.
- El reloj deportivo (caucho, smart) no va con piezas de sastre ni en formal/gala. En un día casual sí pasa — no lo marques ahí.
- La corbata de punto no va a ceremonia (formal/gala). En cita u oficina es elección correcta.
- En evento formal el traje va completo; saco y pantalón de juegos distintos son separates: bien para oficina, cortos para una boda.
- El smoking es código: su pantalón, camisa blanca, moño. Una pieza suelta no es variedad.
- Manga corta con saco, nunca.
- El mocasín escotado no va en frío ni lluvia; con lluvia manda el calzado que aguanta agua y cubre el tobillo.
- Una prenda por zona, ninguna zona del cuerpo sin cubrir.
- Un blazer no es abrigo: con frío real va un abrigo de verdad encima.
- Lino de pies a cabeza en oficina rompe. Una sola pieza de lino en oficina se sostiene, pero a esta persona ya le incomoda ("habíamos quedado que lino no para el trabajo", cuatro veces): márcala como resta.

Si tu arreglo contradice una de estas, NO lo propongas: propón el que la respete.`;

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
