import type { OpcionesGeneracion } from "@/lib/engine/generate";
import type { Modelo } from "@/lib/proveedores";
import type { Weather } from "@/lib/weather";
import { costoUsd } from "@/lib/proveedores/precios";
import { RETADORES_MOTOR } from "@/lib/proveedores/catalogo";
import { JUDGE_MODEL, ENGINE_MODEL } from "@/lib/models";

// Lo puro del comparador de MOTORES: variantes, briefs, ciego, marcador y
// estimado. Sin tocar la base (eso vive en motor-servidor.ts) para que las
// pantallas del cliente puedan importarlo sin arrastrar el servidor.

export type TamanoCorrida = "vistazo" | "veredicto";

/**
 * Una variante del motor: {modelo + reglas encendidas}. El prompt es el
 * vigente (PROMPT_VERSION se congela en la corrida al crearla).
 *
 * `opciones` son los MISMOS flags que ya existen en el motor para el arnés
 * (sinBlueprint, marcarEstilo…): apagar una regla es correr el motor real con
 * ese flag, no una imitación.
 */
export type VarianteMotor = {
  clave: string;
  etiqueta: string;
  /** Qué es esta variante, en una línea, para la pantalla. */
  ayuda: string;
  /** id del catálogo de proveedores. Ausente = el motor de producción. */
  modeloId?: string;
  opciones?: Omit<OpcionesGeneracion, "modelo" | "blueprint" | "congelado"> & {
    /** Resolver el último prompt congelado de este clóset (generar-lado). */
    promptAnterior?: boolean;
  };
};

/**
 * La banca de variantes. "produccion" siempre es el control: el motor tal cual
 * corre hoy. Las demás apagan UNA cosa o cambian SOLO el modelo — una variante
 * que cambiara dos cosas a la vez no diría cuál causó la diferencia.
 */
export const VARIANTES_MOTOR: VarianteMotor[] = [
  {
    clave: "produccion",
    etiqueta: "Producción",
    ayuda: "el motor tal cual corre hoy (control)",
  },
  {
    clave: "sonnet",
    etiqueta: "Sonnet 5",
    ayuda: "misma familia, mismo prompt (2.5× más barato) — la comparación justa",
    modeloId: RETADORES_MOTOR.sonnet,
  },
  // Haiku 4.5 NO está: rechaza el schema del motor (el enum de ~113 UUIDs del
  // clóset excede su compilador — "Schema is too complex"). Cazado por el
  // smoke antes de quemar una corrida; ver lib/proveedores/catalogo.ts.
  {
    clave: "gemini-flash",
    etiqueta: "Gemini 3.5 Flash",
    ayuda: "OTRO proveedor: si pierde, condena al combo modelo+prompt, no al modelo",
    modeloId: RETADORES_MOTOR.geminiFlash,
  },
  {
    clave: "gemini-37",
    etiqueta: "Gemini 3.7 Flash",
    // El retador natural de hoy: producción YA es Gemini 3.5 Flash, así que
    // esto compara generación contra generación del mismo proveedor y con el
    // mismo prompt — la variable queda limpia.
    //
    // OJO CON LO QUE PROMETE EL ANUNCIO (2026-08-14): las mejoras que Google
    // presume son de ingeniería de software, flujos agénticos y fidelidad a
    // mockups. NINGUNA de esas es lo que este motor hace. Lo que sí es
    // verificable y grande es el precio: $0.75/$3.75 contra $1.50/$9 de 3.5
    // —la mitad de entrada y 2.4× menos de salida— pero es INTRODUCTORIO hasta
    // el 31 de diciembre de 2026. Si gana por costo, esa fecha es parte de la
    // decisión.
    ayuda: "la generación siguiente del motor que ya corre (mitad de precio, intro hasta dic-2026)",
    modeloId: RETADORES_MOTOR.gemini37,
  },
  {
    clave: "kimi",
    etiqueta: "Kimi K2.6",
    ayuda: "OTRO proveedor (vía OpenRouter, prepago): misma lectura de traje prestado",
    modeloId: RETADORES_MOTOR.kimi,
  },
  {
    clave: "sin-marca-estilo",
    etiqueta: "Sin marca de estilo",
    ayuda: "el clóset sin marcar qué prendas son del vocabulario de su familia",
    opciones: { marcarEstilo: false },
  },
  {
    clave: "sin-blueprint",
    etiqueta: "Sin estructura de referencia",
    ayuda: "sin el look de calle diseccionado (v35)",
    opciones: { sinBlueprint: true },
  },
  {
    clave: "sin-rotacion",
    etiqueta: "Sin rotación",
    ayuda: "sin el historial por prenda (v36): solo no-repetir combos",
    opciones: { sinRotacion: true },
  },
  {
    clave: "sin-reparar-codigo",
    etiqueta: "Sin reparación en código",
    ayuda:
      "el juez arregla TODO, como antes de v47 — mide si reparar 'te faltó ponerte X' con código ayuda o estorba",
    opciones: { sinRepararEnCodigo: true },
  },
  {
    clave: "sin-neutros",
    etiqueta: "Sin neutros-como-fondo",
    ayuda: "sin la aclaración de que los neutros no compiten con la paleta (v37)",
    opciones: { sinNeutros: true },
  },
  // "sin-coherencia-cromatica" VIVIÓ AQUÍ (v53 → 2026-08-22) y cumplió su
  // trabajo: cinco rondas sin que la regla ganara, y en la quinta el lado sin
  // ella aprobó más. La regla se retiró; las corridas viejas conservan su copia
  // de la variante en la fila, así que siguen leyéndose.
  {
    clave: "sin-reglas-v61",
    etiqueta: "Sin las reglas de v61",
    // LA ABLACIÓN DE v61 — y la lección de la ronda 6868a52b (cerrada sin
    // votar): un cambio de REGLAS no se mide con prompt-anterior, porque el
    // congelado sólo fija el texto del generador y las reglas corren en el
    // pipeline de hoy para los dos lados. Aquí el control es apagarlas: si
    // este lado gana, las reglas estorban y se revierten.
    ayuda:
      "sin las 4 reglas nacidas de los comentarios (boda de noche/overshirt/café con traje negro/charol) — si gana, se revierten",
    opciones: { sinReglasV61: true },
  },
  {
    clave: "sin-reglas-v67",
    etiqueta: "Sin las reglas de v67",
    // Mismo patrón que sin-reglas-v61: un cambio de REGLAS se mide apagándolas,
    // no con prompt-anterior (el congelado sólo fija el texto del generador).
    ayuda:
      "sin las reglas de v67 (chelsea en calor + el tip del saco cruzado que mandaba abrirlo) — si gana, se revierten",
    opciones: { sinReglasV67: true },
  },
  {
    clave: "sin-reglas-v68",
    etiqueta: "Sin las reglas de v68",
    ayuda:
      "sin polo-con-traje-completo ni funeral-camisa-blanca — si gana, se revierten",
    opciones: { sinReglasV68: true },
  },
  {
    clave: "reparar-primero",
    etiqueta: "Código antes que juez",
    // CONVERSACIÓN B, variante 1 (docs §9). El juez de producción reescribe el
    // 75% de los looks y 3 de cada 4 reescrituras responden a una violación
    // que el código ya detectaba: corre ANTES que el reparador y hace a mano
    // lo que el código haría tocando una prenda. Aquí el orden se invierte.
    ayuda:
      "el reparador en código corre ANTES del juez; el juez recibe el look ya reparado y sólo lo que el código no pudo",
    opciones: { repararPrimero: true },
  },
  {
    clave: "juez-solo-repara",
    etiqueta: "El juez sólo repara",
    // CONVERSACIÓN B, variante 2. Además del orden, el juez sólo puede tocar
    // prendas para resolver violaciones verificadas; sin ninguna pendiente,
    // devuelve el look tal cual (candado en código). Mide si el 25% de
    // reescrituras "por criterio propio" suma o resta — con el voto.
    ayuda:
      "código primero, y el juez sólo cambia lo que una violación verificada pide; sin violación, no toca nada",
    opciones: { juezSoloRepara: true },
  },
  {
    clave: "prompt-anterior",
    etiqueta: "Prompt anterior",
    // EL FRENO. La semana del 19 de agosto salieron nueve versiones del motor
    // medidas cada una por su termómetro (reparto de 3, disparos de regla,
    // trajes en cita) y ninguna contra la anterior: la aprobación de Roberto
    // cayó de 91% a 52% sin que nadie lo viera. Esta variante corre la ÚLTIMA
    // versión congelada de este clóset (prompts_congelados) dentro del
    // pipeline de hoy. La regla: ningún cambio del motor sale sin ganarle —o
    // empatarle— a esto. Exige haber congelado ANTES de subir de versión
    // (scripts/prompt-congelar.ts); si no hay congelado o el clóset cambió, el
    // lado falla claro en vez de medir otra cosa.
    ayuda:
      "la última versión congelada del prompt, con el juez y el reparador de hoy — para que lo nuevo tenga que ganarle a lo de ayer",
    opciones: { promptAnterior: true },
  },
];

/**
 * Un brief traducido a lo que el motor recibe. UN solo lugar.
 *
 * Vivía copiado en generar-lado.ts y en scripts/ver-prompt.ts, y ya derivó:
 * el script no pasaba `paraguas`, así que imprimía "NO lleva paraguas" para el
 * brief que sí lo lleva. Es exactamente el patrón que lib/engine/contexto.ts
 * existe para matar — un arnés que IMITA al motor en vez de llamarlo — solo
 * que un escalón más arriba.
 */
export function peticionDeBrief(brief: BriefMotor): {
  objective: string;
  momento: "dia" | "noche" | null;
  weather: Weather | null;
  plan: string | null;
  tipoEvento: string | null;
  formality: string | null;
  paraguas: boolean;
  veCliente: boolean | null;
} {
  return {
    objective: brief.objective,
    momento: brief.momento,
    weather: brief.weather,
    plan: brief.plan ?? null,
    tipoEvento: brief.tipoEvento ?? null,
    formality: brief.formality ?? null,
    paraguas: brief.paraguas === true,
    // null (no false) cuando el brief no lo dice: false significaría "hoy no ve
    // cliente" y eso es una afirmación, no la ausencia de una.
    veCliente: typeof brief.veCliente === "boolean" ? brief.veCliente : null,
  };
}

export function variantePorClave(clave: string): VarianteMotor | null {
  return VARIANTES_MOTOR.find((v) => v.clave === clave) ?? null;
}

/** Un brief: el día que las dos variantes tienen que resolver. */
export type BriefMotor = {
  etiqueta: string;
  objective: string;
  momento: "dia" | "noche" | null;
  weather: Weather | null;
  /**
   * Qué evento es, en las palabras de quien pide. Va al motor por el MISMO
   * campo que producción ("Tiene en mente: …") y se muestra al votar.
   *
   * Existe porque "evento" a secas no se puede calificar: una boda y una cena
   * con amigos comparten la etiqueta y no comparten NADA de lo que el motor
   * tiene que acertar. Al votar, "no va para la ocasión" era una marca que no
   * se podía emitir con honestidad sin saber cuál ocasión.
   */
  plan?: string;
  /** QUÉ evento es, del catálogo (lib/eventos.ts). */
  tipoEvento?: string;
  /** Lo que el wizard pregunta para "evento". Los valores viven en Formalidad
   *  (lib/formalidad.ts) — NO se re-enumeran aquí: la lista ya se quedó corta
   *  cuando entró "playa". */
  formality?: string;
  /**
   * Va a llevar paraguas. Solo tiene sentido con lluvia, y ahí lo cambia todo:
   * el paraguas tapa el torso pero no los pies.
   */
  paraguas?: boolean;
  /**
   * Si ese día ve cliente. Solo pesa cuando el código de trabajo del clóset es
   * "variable" — con los otros tres el registro no cambia por el día. Sin él,
   * un dueño de clóset "variable" haría que TODOS los briefs de trabajo
   * corrieran en modo cubrirse-en-medio, midiendo el hedge en vez del criterio.
   */
  veCliente?: boolean;
};

const CLIMAS = {
  frio: { temp_c: 8, condition: "despejado" },
  templado: { temp_c: 18, condition: "nublado" },
  calor: { temp_c: 29, condition: "soleado" },
  lluvia: { temp_c: 17, condition: "lluvia" },
} as const;

/**
 * La versión del pool. Se congela en cada corrida al abrirla y sirve para UNA
 * cosa: que la tabla "qué modelo usamos" no sume corridas que resolvieron días
 * distintos. Un retador medido contra el pool v1 y otro contra el v2 se pueden
 * leer cada uno contra SU control (eso siempre es justo, corren el mismo día),
 * pero no entre sí.
 *
 * v1 → v2 (2026-08-06): los dos briefs de "evento" se volvieron eventos
 * concretos (boda / cena con amigos) y entró un tercero de día (comida
 * familiar). Los briefs 1-2 y 4-6 no se movieron.
 *
 * v2 → v3 (2026-08-06): la lluvia se parte en DOS briefs, con paraguas y sin
 * él. No es un refinamiento: el paraguas tapa el torso y no los pies, así que
 * cada caso exige algo distinto y el motor puede fallar de dos maneras que
 * antes se medían como una. Sin paraguas se mide si pone capa que repela agua
 * Y calzado apto; con paraguas, si RELAJA arriba pero sigue acertando abajo —
 * ese segundo caso mide la sobre-aplicación de la regla, que hasta hoy no se
 * medía. Salió del veredicto de Gemini: 4 de sus 6 defectos de clima fueron
 * lluvia, y producción también falló ahí.
 *
 * v7 → v8 (2026-08-18, el mismo día): la CITA entra al vistazo, en el lugar
 * de "diario · templado".
 *
 * POR QUÉ SE PUEDE TOCAR EL VISTAZO Y NO EL VEREDICTO: la comparabilidad
 * histórica que esta versión protege es la de la tabla "qué modelo usamos", y
 * esa la alimenta el veredicto. El vistazo NUNCA declara ganador — existe para
 * encontrar defectos, y un vistazo de hace dos semanas no se compara con uno de
 * hoy. Dejarle un slot muerto por conservadurismo era proteger algo que no
 * existe.
 *
 * Y el slot estaba muerto: de los seis del vistazo, cinco ejercitan algo
 * (oficina, boda, frío, calor, lluvia) y "diario · templado" no ejercitaba
 * nada — sin plan, sin formalidad, sin regla de clima. Baja al 14, donde el
 * veredicto lo sigue corriendo.
 *
 * v6 → v7 (2026-08-18): entran los TRES planes que la app ofrece de un toque y
 * el pool nunca midió — una cita, una fiesta y una comida de trabajo. No es un
 * refinamiento: la pantalla de "¿qué plan tienes?" ofrece seis planes sociales
 * (PLANES_VISIBLES en components/weather-picker) y el pool sólo probaba tres,
 * o sea que la MITAD de lo que se puede pedir con un dedo jamás se había
 * medido. Y el pool sí medía `funeral`, que ni siquiera está en esa pantalla.
 *
 * Los tres que faltaban son además la franja con MÁS margen de error: no hay
 * código de vestimenta duro que proteja al motor, así que un fallo ahí no rompe
 * una regla, entrega algo aburrido — la nota que ya sale más baja (wow).
 *
 * Van al FINAL del pool a propósito: el vistazo toma los primeros 6 y ésos
 * están curados como prueba de humo de los caminos diarios. Estos se miden en
 * el veredicto, que es donde se decide.
 *
 * v5 → v6 (2026-08-07, el mismo día): la boda de noche vuelve a "formal". En
 * v5 la subí a "gala" por el default de subeDeNoche y la primera corrida lo
 * cazó: el juez exigía esmoquin con moño y charol en los DOS looks de boda. En
 * México una boda de noche en salón es traje oscuro y corbata — el black tie
 * se especifica en la invitación. El pool medía un estándar que no es el de
 * aquí, y el motor "fallaba" contra una vara equivocada.
 *
 * v4 → v5 (2026-08-07): los eventos llevan su TIPO del catálogo
 * (lib/eventos.ts), no solo su nivel de formalidad. Es lo mismo que pasó con
 * "evento" a secas en v2, un escalón más fino: una boda y una graduación son
 * las dos "formal" y no se resuelven igual, y hasta v4 el motor no tenía cómo
 * saber la diferencia. Y entra un cuarto evento —un funeral— porque es el
 * único caso del catálogo donde el no-destacar MANDA sobre el estilo y la
 * colorimetría: sin él, esa regla no se mide en ningún lado.
 *
 * v3 → v4 (2026-08-07): el trabajo se parte igual que la lluvia. Con el código
 * "depende del día" el registro cambia por el día, así que los briefs llevan
 * `veCliente` explícito — sin él, un clóset de código variable correría TODOS
 * los briefs de trabajo en modo cubrirse-en-medio y mediríamos el hedge, no el
 * criterio. Y entra un PAR ESPEJO a mismo clima (templado con cliente / sin
 * cliente): solo cambia el flag, así que mide directo si el motor distingue.
 */
/**
 * v8 → v9 (2026-08-22): LOS PLANES DICEN LO QUE DIRÍA UNA PERSONA. Roberto,
 * votando: "pone 'cita' — ¿qué tipo de cita? ¿para cenar o de trabajo? Hay
 * muchísimos contextos que influyen en si el outfit es correcto". Y tenía
 * razón dos veces: él no podía decidir, y el motor recibía exactamente el
 * mismo texto, así que tampoco. El wizard de producción pregunta el detalle
 * ("dime a dónde apunta la cita", "dime cuánto pesa la mesa", "dime qué tipo
 * de fiesta es") y el pool mandaba una etiqueta de catálogo. Ahora cada `plan`
 * es la respuesta que una persona real daría a esa pregunta: con quién, dónde,
 * a qué hora, qué hay en juego. Las etiquetas y el resto del brief no cambian;
 * las rondas de v8 y v9 NO son comparables entre sí en aprobación absoluta.
 */
// v9 → v10 (2026-08-24): +4 briefs al final — boda de día, boda de playa,
// cita de comida cool y cita de drinks (los porqués, en el comentario sobre
// esos briefs). Como todo cambio de pool: las aprobaciones de v9 y v10 NO se
// comparan entre sí, y hay que re-congelar el prompt vigente bajo v10 antes
// de la siguiente ronda con prompt-anterior.
//
// v10 → v11 (2026-08-25): NORMA VS CÓDIGO (docs/designs/norma-vs-codigo.md).
// Los briefs sociales (cita ×3, cena-amigos, fiesta, comida-trabajo,
// comida-familiar) pierden su `formality` estampada: nadie que pide "cena con
// amigos" declara un código de vestimenta, y estamparle el default del
// catálogo le decía al motor "Formalidad del evento: RESPÉTALA" — la misma
// línea que produciría una invitación real. Era la fuente de fondo del
// overdressing (Roberto: "con esas reglas forzamos a que todas las cenas
// sean de saco"). Boda ×3 y funeral la CONSERVAN: ahí sí hay invitación o
// institución — un código, no una norma. Mismas reglas de siempre: v10 y v11
// no se comparan, y re-congelar el prompt vigente bajo v11 antes de la
// siguiente ronda con prompt-anterior.
export const POOL_VERSION = "v11";

/**
 * El pool de briefs, fijo y en este orden a propósito: la misma corrida dentro
 * de tres meses (contra un modelo nuevo) verá los MISMOS días. Los primeros 6
 * son el vistazo; el veredicto cicla el pool completo.
 *
 * Cubre lo que el motor tiene que saber resolver: las tres ocasiones con piso
 * de formalidad distinto (diario sin piso, oficina, evento/noche) por las
 * cuatro bandas de clima que cambian el clóset disponible.
 *
 * LOS EVENTOS VAN CON NOMBRE Y APELLIDO
 * "evento · noche templada" era incalificable: una boda y una cena con amigos
 * caen en esa etiqueta y no comparten piso de formalidad, ni calzado, ni
 * registro. Ahora cada uno lleva su `plan` — y `formality` SOLO los que
 * tienen código real (boda, funeral): desde v11, los sociales viajan sin
 * formalidad, que es exactamente lo que producción manda cuando nadie la
 * declaró. El brief espeja al wizard, no lo mejora.
 *
 * El de día (comida familiar) entró porque no existía: hasta v1, TODO evento
 * era de noche, y pisoDeFormalidad tiene una rama distinta para evento-de-día
 * que nunca se había medido.
 */
const POOL_BRIEFS: BriefMotor[] = [
  {
    // EN EL LUGAR 1 A PROPÓSITO (v8), o sea DENTRO del vistazo: este slot lo
    // ocupaba "diario · templado", el único de los seis que no ejercitaba nada.
    // Los otros cinco sí ganan su lugar (oficina, boda, frío, calor, lluvia) y
    // las otras dos ranuras de diario del vistazo siguen intactas.
    //
    // La cita es la más valiosa de las que nunca se medían: arreglarse ES el
    // punto y no hay código de vestimenta duro que proteja al motor. Si falla
    // aquí no rompe una regla, entrega algo aburrido.
    // LOS TRES PLANES QUE LA APP OFRECE DE UN TOQUE Y EL POOL NUNCA MIDIÓ (v7).
    // La pantalla de "¿qué plan tienes?" ofrece seis planes sociales y el pool
    // sólo probaba tres. Los otros tres no son un hueco cualquiera: son la
    // franja donde el motor tiene MÁS margen de error, porque no hay código de
    // vestimenta duro que lo proteja. Si se equivoca aquí no rompe una regla —
    // entrega algo aburrido, que es justo la nota que sale más baja (wow).
    //
    // Y al revés: el pool sí medía `funeral`, que ni siquiera está en esa
    // pantalla (sólo se alcanza escribiéndolo). Se queda, porque su valor está
    // escrito arriba y es real, pero deja de ser el único evento raro medido
    // mientras tres de un toque no lo estaban.
    //
    // SIN `formality` desde v11: nadie declara un código para una cita. El
    // default del catálogo viajaba estampado como si la invitación existiera
    // ("semiformal — RESPÉTALA") y era la fuente de fondo del overdressing.
    etiqueta: "cita · noche templada",
    objective: "evento",
    momento: "noche",
    weather: CLIMAS.templado,
    plan: "una cita para cenar con alguien que me gusta — es la segunda vez que salimos; restaurante de mantel, viernes a las 9",
    tipoEvento: "cita",
  },
  {
    etiqueta: "trabajo · templado, día normal",
    objective: "oficina",
    momento: "dia",
    weather: CLIMAS.templado,
    veCliente: false,
  },
  {
    etiqueta: "boda · noche templada",
    objective: "evento",
    momento: "noche",
    weather: CLIMAS.templado,
    plan: "la boda de un amigo cercano, de noche en un salón; la invitación no trae dress code; voy como invitado, no de la familia",
    tipoEvento: "boda",
    formality: "formal",
  },
  { etiqueta: "diario · frío", objective: "diario", momento: "dia", weather: CLIMAS.frio },
  { etiqueta: "trabajo · calor, día normal", objective: "oficina", momento: "dia", weather: CLIMAS.calor, veCliente: false },
  {
    etiqueta: "diario · lluvia sin paraguas",
    objective: "diario",
    momento: "dia",
    weather: CLIMAS.lluvia,
    paraguas: false,
  },
  {
    etiqueta: "cena con amigos · noche fría",
    objective: "evento",
    momento: "noche",
    weather: CLIMAS.frio,
    plan: "cena con mis amigos de siempre en un restaurante casual, sábado en la noche; nadie a quien impresionar",
    tipoEvento: "cena-amigos",
  },
  { etiqueta: "diario · calor", objective: "diario", momento: "dia", weather: CLIMAS.calor },
  { etiqueta: "trabajo · frío, con cliente", objective: "oficina", momento: "dia", weather: CLIMAS.frio, veCliente: true },
  { etiqueta: "aeropuerto · templado", objective: "viaje", momento: "dia", weather: CLIMAS.templado },
  {
    // EL ESPEJO DEL TRABAJO: mismo clima que "trabajo · templado, día normal",
    // y lo ÚNICO que cambia es que hoy ve cliente. Un motor que arme lo mismo
    // en los dos falló — y ese fallo no se veía en ningún lado hasta ahora.
    etiqueta: "trabajo · templado, con cliente",
    objective: "oficina",
    momento: "dia",
    weather: CLIMAS.templado,
    veCliente: true,
  },
  {
    // El caso que mide la SOBRE-aplicación: con paraguas, la capa de arriba se
    // elige por estilo. Un motor que igual te encaja la impermeable falla aquí.
    etiqueta: "diario · lluvia con paraguas",
    objective: "diario",
    momento: "dia",
    weather: CLIMAS.lluvia,
    paraguas: true,
  },
  {
    // El funeral: el ÚNICO caso donde el no-destacar manda sobre el estilo y
    // la colorimetría. Un motor que aquí saque su verde esmeralda falló, y ese
    // fallo no se veía en ningún brief del pool.
    etiqueta: "funeral · templado",
    objective: "evento",
    momento: "dia",
    weather: CLIMAS.templado,
    plan: "el funeral del papá de un amigo: misa y velorio por la tarde",
    tipoEvento: "funeral",
    formality: "formal",
  },
  {
    // Bajó del lugar 1 al 14 (v8). Era el único de los seis del vistazo que no
    // ejercitaba NADA: sin plan, sin formalidad y sin regla de clima que
    // morder. Sigue en el pool porque el caso sin restricciones es donde el
    // estilo tiene que hablar solo — pero ese es trabajo del veredicto, no de
    // una prueba de humo de seis pares.
    etiqueta: "diario · templado",
    objective: "diario",
    momento: "dia",
    weather: CLIMAS.templado,
  },
  {
    // La fiesta es el permiso para arriesgar, y por eso mide lo contrario que
    // el funeral: ahí se castiga destacar, aquí se castiga no atreverse.
    etiqueta: "fiesta · noche fría",
    objective: "evento",
    momento: "noche",
    weather: CLIMAS.frio,
    plan: "la fiesta de cumpleaños de un amigo en su casa; gente de mi edad, música y baile hasta tarde",
    tipoEvento: "fiesta",
  },
  {
    // La frontera exacta entre oficina y social: el registro de trabajo subido
    // un escalón. Un motor que aquí entregue el mismo look que en "trabajo ·
    // templado" no entendió el escalón.
    etiqueta: "comida de trabajo · templado",
    objective: "evento",
    momento: "dia",
    weather: CLIMAS.templado,
    plan: "comida con un cliente importante en el restaurante de un hotel, entre semana a las 2; él siempre va de traje",
    tipoEvento: "comida-trabajo",
  },
  {
    etiqueta: "comida familiar · calor",
    objective: "evento",
    momento: "dia",
    weather: CLIMAS.calor,
    plan: "comida en casa de mis papás",
    tipoEvento: "comida-familiar",
  },
  // ── v10 (2026-08-24): los cuatro de abajo, VAN AL FINAL a propósito (el
  // orden del pool es fijo; el vistazo sigue siendo los primeros 6). Dos
  // observaciones de Roberto calificando el eval de v67:
  //
  // (1) "Nunca ponemos bodas de día o boda en la playa." Tenía razón, y era
  // grave: boda-de-noche-camisa-blanca y boda-de-noche-sin-corbata disparan
  // sólo de noche — el comportamiento DIURNO (camisa de color pasa, corbata
  // se relaja) era una decisión real del motor que ninguna medición ejercitó
  // jamás. Y el código de vestimenta "de playa" existe desde v51 y nunca
  // apareció en un brief; cruza con lino, sandalias y mocasín sin calcetín.
  //
  // (2) "La cita siempre es 'restaurante de mantel' — ¿si voy al Contramar a
  // comer, cómo voy?" El pool sólo probaba la cita MÁS formal que existe, y
  // Roberto llevaba tres rondas marcando "el traje es too much para una
  // date" — contra el único registro de cita que medíamos. Entran los dos
  // registros que faltaban: la comida en lugar cool (día, casual) y los
  // drinks en un bar (noche, casual). Con el de mantel, el espectro queda
  // completo: bar → comida cool → mantel.
  {
    etiqueta: "boda · día templado",
    objective: "evento",
    momento: "dia",
    weather: CLIMAS.templado,
    plan: "la boda de mi prima, ceremonia en el jardín de una hacienda a mediodía; la invitación dice formal",
    tipoEvento: "boda",
    formality: "formal",
  },
  {
    etiqueta: "boda · playa, calor",
    objective: "evento",
    momento: "dia",
    weather: CLIMAS.calor,
    plan: "boda en la playa en Cancún; la invitación dice 'formal de playa' y la ceremonia es en la arena a las 5 de la tarde",
    tipoEvento: "boda",
    formality: "playa",
  },
  {
    etiqueta: "cita · comida, calor",
    objective: "evento",
    momento: "dia",
    weather: CLIMAS.calor,
    plan: "voy a comer con alguien que me gusta a un restaurante padre pero relajado, de mariscos, de esos con fila — sábado a las 2; es la tercera vez que salimos",
    tipoEvento: "cita",
  },
  {
    etiqueta: "cita · drinks, noche templada",
    objective: "evento",
    momento: "noche",
    weather: CLIMAS.templado,
    plan: "unos drinks en un bar el jueves en la noche — apenas nos estamos conociendo; quiero verme bien sin que se note que me esforcé",
    tipoEvento: "cita",
  },
];

/**
 * Cuántos días trae UNA vuelta al pool. Exportado porque el eval lo necesita
 * para "n vueltas": estaba escrito a mano como 13 en tres archivos y el pool
 * acaba de crecer a 14 — la clase de número que se queda atrás en silencio y
 * deja un brief sin medir sin que nadie lo note.
 */
export const N_POOL = POOL_BRIEFS.length;

/** El pool, expuesto SÓLO para el candado de cobertura (pool-cobertura.test).
 *  No lo consumas en producción: los briefs se piden con `briefsPara`, que es
 *  quien sabe cuántos van y cómo se etiquetan las vueltas. */
export const POOL_BRIEFS_PARA_TEST: readonly BriefMotor[] = POOL_BRIEFS;

export const N_VISTAZO = 6;
export const MIN_VEREDICTO = 20;
export const MAX_VEREDICTO = 40;

export function briefsPara(tamano: TamanoCorrida, n: number): BriefMotor[] {
  const total = tamano === "vistazo" ? N_VISTAZO : n;
  return Array.from({ length: total }, (_, i) => {
    const b = POOL_BRIEFS[i % POOL_BRIEFS.length];
    const vuelta = Math.floor(i / POOL_BRIEFS.length);
    return vuelta === 0 ? b : { ...b, etiqueta: `${b.etiqueta} (${vuelta + 1}ª)` };
  });
}

/**
 * Cuántos pares espejo lleva un veredicto (~10%, mínimo 2). Repiten looks ya
 * generados con el orden invertido: miden si el voto sobrevive al espejo, y
 * cuestan $0 porque no generan nada.
 */
export function nRepetidos(tamano: TamanoCorrida, n: number): number {
  if (tamano === "vistazo") return 0;
  return Math.max(2, Math.round(n * 0.1));
}

/**
 * Los defectos que se pueden marcar por lado al votar. Es la cosecha del
 * vistazo: cada tag confirmado es candidato a regla comprobable en código
 * (lib/engine/reglas-ejecucion.ts) — el camino nota→regla que hasta hoy se
 * quedaba en la cabeza de quien califica.
 */
export const DEFECTOS_MOTOR = [
  { clave: "clima", label: "rompe el clima" },
  { clave: "ocasion", label: "mal para la ocasión" },
  { clave: "color", label: "color que choca" },
  { clave: "proporcion", label: "proporción rara" },
  { clave: "capas", label: "capas que nadie usa" },
  { clave: "repetido", label: "repetitivo entre sí" },
  { clave: "plano", label: "correcto pero plano" },
] as const;

/**
 * EL CIEGO. Determinista por par (recargar no cambia columnas): decide si el
 * par muestra [variante0, variante1] o al revés. Mismo hash FNV que el
 * comparador de visión.
 */
export function ladoInvertido(parId: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < parId.length; i++) {
    h ^= parId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return (h & 1) === 1;
}

/**
 * El orden en que la pantalla muestra las variantes de UN par — y el ÚNICO
 * lugar donde se calcula. La pantalla lo usa para pintar y votarParMotor para
 * deshacer el ciego: si vivieran como dos copias (así nació) y una cambiara,
 * los votos se atribuirían a la variante equivocada en silencio.
 *
 * El espejo va SIEMPRE al revés que su original — no un sorteo nuevo: si se
 * sorteara, la mitad de los espejos quedarían en el mismo orden y no medirían
 * nada.
 */
/**
 * ¿Los dos lados armaron EL MISMO look? (mismo conjunto de prendas).
 *
 * Es la excepción del empate forzado (ver `empateDisponible`): cuando las dos
 * variantes entregan exactamente las mismas prendas, pedirle a alguien que
 * elija una es pedirle que invente una diferencia que no existe.
 *
 * Compara CONJUNTOS de ids, no listas: el orden dentro del look es del modelo
 * y no significa nada. Sin prendas en algún lado devuelve false — no se puede
 * afirmar una igualdad que no se pudo mirar.
 */
export function mismasPrendas(
  a: { id: string }[] | null | undefined,
  b: { id: string }[] | null | undefined
): boolean {
  if (!a?.length || !b?.length) return false;
  const A = new Set(a.map((p) => p.id));
  const B = new Set(b.map((p) => p.id));
  if (A.size !== B.size) return false;
  for (const id of A) if (!B.has(id)) return false;
  return true;
}

/**
 * ¿Se le puede ofrecer "empate" en este look, o hay que forzar una preferencia?
 *
 * POR QUÉ EXISTE, con el número que lo motivó (2026-08-26). Roberto: "sería
 * interesante que ante dos thumbs up, forzar a que yo escoja una posición y no
 * poder poner empate, a menos que las prendas que ambos lados tienen sean
 * iguales, que pasa seguido".
 *
 * Su diagnóstico era correcto y la frecuencia que suponía, no. Medido sobre
 * las 6 rondas votadas (78 empates):
 *   - por prendas IDÉNTICAS ................  5 (6%)  ← su excepción
 *   - con looks genuinamente DISTINTOS .....  65
 *   - solape medio de prendas entre lados ..  28%
 *   - empates entre looks SIN una sola prenda en común .. 27
 * O sea: el empate se estaba usando para outfits completamente diferentes, y
 * con eso se tiraba más de la mitad de la señal de cada ronda (62 observaciones
 * decididas contra 78 empatadas). Forzar la elección donde hay diferencia real
 * lleva la muestra útil de 62 a ~135 sin gastar un dólar más en generación.
 *
 * EL RIESGO QUE SE ACEPTA, dicho en voz alta: forzar donde no hay preferencia
 * genuina produce volados. Eso NO sesga (se reparten 50/50 y el agregado sigue
 * diciendo "empate"), pero suma varianza. Se acepta porque con 28% de solape
 * los looks no son variaciones del mismo outfit, y "¿cuál te pondrías?" siempre
 * tiene respuesta. El comentario sigue siendo OPCIONAL a propósito: es lo que
 * se convierte en regla, y una justificación obligada sería una racionalización
 * inventada contaminando la cosecha.
 *
 * Las dos excepciones donde el empate SÍ se ofrece:
 *  1. mismas prendas — no hay nada que preferir;
 *  2. los DOS con 👎 — "cuál te pondrías" no aplica si no te pondrías ninguno.
 *     (Marginal: 26 de los 27 empates de la última ronda eran con ambos 👍.)
 */
export function empateDisponible(estado: {
  mismasPrendas: boolean;
  marcaA: "arriba" | "abajo" | undefined;
  marcaB: "arriba" | "abajo" | undefined;
}): boolean {
  if (estado.mismasPrendas) return true;
  return estado.marcaA === "abajo" && estado.marcaB === "abajo";
}

/**
 * El voto del PAR, derivado de los votos por look.
 *
 * Se vota look contra look (comparar dos es mucho más fácil que sostener seis
 * en la cabeza), pero la unidad de la prueba sigue siendo el par: los 2-3 looks
 * de un lado salen de UNA llamada al motor, así que contarlos como votos
 * independientes inflaría la significancia del sign test.
 *
 * Mayoría simple; empate entre las dos variantes → "empate". Los looks votados
 * "empate" no cuentan para ninguna, pero tampoco anulan al par: un par donde A
 * gana uno y los otros dos empatan, lo gana A.
 */
export function votoDelPar(
  votosLook: Record<string, string> | null | undefined
): string | null {
  const cuenta = new Map<string, number>();
  for (const v of Object.values(votosLook ?? {})) {
    if (!v || v === "empate") continue;
    cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  if (cuenta.size === 0) {
    // Sin votos decisivos: si hubo al menos un look votado, es empate; si no
    // se votó nada, el par sigue pendiente.
    return Object.keys(votosLook ?? {}).length > 0 ? "empate" : null;
  }
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  if (orden.length > 1 && orden[0][1] === orden[1][1]) return "empate";
  return orden[0][0];
}

export function ordenDelPar(
  parId: string,
  repiteDe: string | null,
  claves: [string, string]
): [string, string] {
  const invertido = repiteDe ? !ladoInvertido(repiteDe) : ladoInvertido(parId);
  return invertido ? [claves[1], claves[0]] : claves;
}

/**
 * Traduce una variante congelada a las opciones reales de armarLooks.
 * null si su modeloId ya no existe en el catálogo (corrida vieja contra un
 * catálogo que cambió — mejor un error claro que caer a producción en
 * silencio). Compartida por la ruta de generación y el smoke: dos copias de
 * este spread es exactamente la deriva de arnés que este proyecto ya pagó.
 */
export function opcionesDeVariante(
  v: VarianteMotor,
  modeloPorId: (id: string) => Modelo | null
): OpcionesGeneracion | null {
  const modelo = v.modeloId ? modeloPorId(v.modeloId) : null;
  if (v.modeloId && !modelo) return null;
  // `promptAnterior` no es una opción del motor: es una instrucción para
  // generar-lado, que la cambia por el `congelado` ya resuelto.
  const { promptAnterior: _pa, ...opciones } = v.opciones ?? {};
  return {
    ...opciones,
    ...(modelo ? { modelo } : {}),
  };
}

// ── Lo guardado ────────────────────────────────────────────────────────────

export type LookMotor = {
  nombre: string;
  item_ids: string[];
  explicacion: string;
  tip?: string | null;
  /**
   * El NOMBRE de cada prenda, congelado al generar (mismo orden que item_ids).
   *
   * Existe desde el 2026-08-22, el día que se descubrió que el clóset de
   * Roberto se había recreado el 08-18 y que los 393 votos de las rondas
   * anteriores apuntaban a ids que ya no resolvían: el voto sobrevivió, el look
   * que lo motivó no. Un look que sólo guarda ids muere con la siguiente
   * limpieza de cuentas; uno que guarda nombres sigue siendo legible para un
   * juez o para una persona. Ausente en lados anteriores a esa fecha.
   */
  prendas?: { id: string; nombre: string }[];
};

export type LadoMotor = {
  variante: string;
  looks: LookMotor[] | null;
  reviews: unknown;
  /** Las notas de la rúbrica, una por look (scripts/comparador-juzgar.ts).
   * null = esta corrida todavía no se juzgó automáticamente. */
  notas?: import("@/lib/engine/rubrica").NotaRubrica[] | null;
  /** Lo mismo, de la rúbrica que MIRA las fotos (rv3). */
  notasVision?: import("@/lib/engine/rubrica").NotaRubrica[] | null;
  /** Los hallazgos del juez stylist (js1): qué pieza falla y qué cambiarías. */
  criticas?: import("@/lib/engine/juez-stylist").CriticaStylist[] | null;
  error: string | null;
  costoUsd: number | null;
  ms: number | null;
};

export type ParMotor = {
  id: string;
  n: number;
  brief: BriefMotor;
  repiteDe: string | null;
  voto: string | null; // clave de variante o 'empate'
  defectos: Record<string, string[]> | null;
  /** Diagnóstico por look: {variante: {índice: "arriba"|"abajo"}}. */
  marcasLook: Record<string, Record<string, string>> | null;
  /** Defectos POR LOOK: {variante: {índice: ["clave"]}}. Reemplaza a `defectos`. */
  defectosLook: Record<string, Record<string, string[]>> | null;
  /** El porqué de cada look: {variante: {índice: "texto"}}. */
  comentariosLook: Record<string, Record<string, string>> | null;
  /**
   * Preferencia por look anotada DESPUÉS del voto, al completar las marcas.
   * No deriva `voto` ni entra en la regla pre-registrada: se emitió con el
   * marcador global ya alcanzable. Se lee aparte, etiquetada.
   */
  prefsLook: Record<string, Record<string, string>> | null;
  /** La calificación AL JUEZ por look (migración 0142): mide al juez, no al
   *  look. {"<variante>": {"<índice>": {v, nota}}} */
  veredictosJuez: Record<
    string,
    Record<string, { v?: "acuerdo" | "exagero"; nota?: string }>
  > | null;
  nota: string | null;
  lados: LadoMotor[];
};

// ── El marcador ────────────────────────────────────────────────────────────

export type ResultadoVariante = {
  clave: string;
  etiqueta: string;
  victorias: number;
  defectos: Record<string, number>;
  costoPromedio: number | null;
  msPromedio: number | null;
  errores: number;
  /** Looks marcados 👍 y 👎 (diagnóstico, NO votos: ver marcas_look). */
  looksArriba: number;
  looksAbajo: number;
  /**
   * Cuántos looks GENERÓ esta variante. Sin este denominador, "0 👎" se lee
   * como "nada salió mal" cuando puede significar "nadie los miró" — que fue
   * exactamente lo que pasó en el primer veredicto: 20 marcas sobre 119 looks.
   */
  looksTotales: number;
  /**
   * Lados que ENTREGARON looks (sin error). Con looksTotales da el promedio de
   * looks por par: el prompt pide "2 o 3", así que entregar 2 es legal — pero
   * un motor que da 2 te está dando menos que uno que da 3, y eso no se veía
   * en ningún lado. Roberto lo descubrió abriendo una pestaña vacía.
   */
  ladosConLooks: number;
};

/**
 * La preferencia look por look anotada DESPUÉS del voto. Se cuenta y se
 * reporta APARTE del marcador: nació con el marcador global ya alcanzable, así
 * que es evidencia más débil que el voto ciego y mezclarla sería lavarle esa
 * diferencia.
 *
 * Sirve para una pregunta concreta que el veredicto no contestó: los primeros
 * pares se votaron mirando solo el primer look, y esto dice si la preferencia
 * sobre los looks 2 y 3 apuntaba al mismo lado.
 */
export function preferenciasPorLook(
  variantes: { clave: string; etiqueta: string }[],
  pares: ParMotor[]
): { clave: string; etiqueta: string; gana: number }[] & { empates?: number } {
  const acc = new Map(variantes.map((v) => [v.clave, { ...v, gana: 0 }]));
  let empates = 0;
  for (const par of pares) {
    for (const [clave, porIndice] of Object.entries(par.prefsLook ?? {})) {
      const n = Object.keys(porIndice).length;
      if (clave === "empate") empates += n;
      else {
        const a = acc.get(clave);
        if (a) a.gana += n;
      }
    }
  }
  const filas = [...acc.values()] as ReturnType<typeof preferenciasPorLook>;
  filas.empates = empates;
  return filas;
}

export type MarcadorMotor = {
  variantes: ResultadoVariante[];
  empates: number;
  votados: number; // pares reales (sin espejos) con voto
  /** p del sign test (dos colas) sobre victorias A vs B. null si no hay votos. */
  p: number | null;
  /** Espejos votados y cuántos coincidieron con su original. */
  consistencia: { espejos: number; coinciden: number };
};

/** Sign test exacto de dos colas: ¿este marcador puede ser puro azar? */
export function pBinomial(a: number, b: number): number | null {
  const n = a + b;
  if (n === 0) return null;
  const k = Math.max(a, b);
  // P(X >= k) con X ~ Bin(n, 0.5), por coeficientes exactos.
  let cola = 0;
  for (let i = k; i <= n; i++) cola += binom(n, i);
  const p = 2 * cola * Math.pow(0.5, n);
  return Math.min(1, p);
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export function marcadorMotor(
  variantes: { clave: string; etiqueta: string }[],
  pares: ParMotor[]
): MarcadorMotor {
  const acc = new Map<string, ResultadoVariante & { costoSuma: number; costoN: number; msSuma: number; msN: number }>();
  for (const v of variantes) {
    acc.set(v.clave, {
      clave: v.clave,
      etiqueta: v.etiqueta,
      victorias: 0,
      defectos: {},
      costoPromedio: null,
      msPromedio: null,
      errores: 0,
      looksArriba: 0,
      looksAbajo: 0,
      looksTotales: 0,
      ladosConLooks: 0,
      costoSuma: 0,
      costoN: 0,
      msSuma: 0,
      msN: 0,
    });
  }

  let empates = 0;
  let votados = 0;
  const reales = pares.filter((p) => !p.repiteDe);
  const porId = new Map(pares.map((p) => [p.id, p]));

  for (const par of reales) {
    for (const lado of par.lados) {
      const a = acc.get(lado.variante);
      if (!a) continue;
      if (lado.error) a.errores++;
      if (lado.costoUsd != null) {
        a.costoSuma += lado.costoUsd;
        a.costoN++;
      }
      if (lado.ms != null) {
        a.msSuma += lado.ms;
        a.msN++;
      }
      // El denominador de las marcas: cuántos looks generó de verdad.
      a.looksTotales += lado.looks?.length ?? 0;
      if ((lado.looks?.length ?? 0) > 0) a.ladosConLooks++;
    }
    if (par.voto == null) continue;
    votados++;
    if (par.voto === "empate") empates++;
    else acc.get(par.voto) && acc.get(par.voto)!.victorias++;
  }

  // Los defectos se cosechan de TODOS los pares votados, espejos incluidos:
  // un espejo no suma victorias (repite looks), pero lo que Roberto marcó ahí
  // es una observación tan válida como cualquiera — tirarla sería perder ~10%
  // del etiquetado del veredicto en silencio.
  for (const par of pares) {
    if (par.voto == null) continue;
    // Las dos formas: `defectos` era por lado (corridas viejas) y
    // `defectosLook` es por look. Sumarlas juntas evita perder la cosecha de
    // la primera corrida solo porque el formato mejoró después.
    for (const [clave, tags] of Object.entries(par.defectos ?? {})) {
      const a = acc.get(clave);
      if (!a) continue;
      for (const t of tags) a.defectos[t] = (a.defectos[t] ?? 0) + 1;
    }
    for (const [clave, porIndice] of Object.entries(par.defectosLook ?? {})) {
      const a = acc.get(clave);
      if (!a) continue;
      for (const tags of Object.values(porIndice)) {
        for (const t of tags) a.defectos[t] = (a.defectos[t] ?? 0) + 1;
      }
    }
    // Las marcas por look, igual: diagnóstico de CUÁL look arrastró el voto.
    for (const [clave, porIndice] of Object.entries(par.marcasLook ?? {})) {
      const a = acc.get(clave);
      if (!a) continue;
      for (const m of Object.values(porIndice)) {
        if (m === "arriba") a.looksArriba++;
        else if (m === "abajo") a.looksAbajo++;
      }
    }
  }

  // Los espejos: ¿el voto sobrevivió a invertir el orden?
  let espejos = 0;
  let coinciden = 0;
  for (const par of pares) {
    if (!par.repiteDe || par.voto == null) continue;
    const original = porId.get(par.repiteDe);
    if (!original || original.voto == null) continue;
    espejos++;
    if (original.voto === par.voto) coinciden++;
  }

  const [va, vb] = [...acc.values()];
  return {
    variantes: [...acc.values()].map((a) => ({
      clave: a.clave,
      etiqueta: a.etiqueta,
      victorias: a.victorias,
      defectos: a.defectos,
      costoPromedio: a.costoN ? a.costoSuma / a.costoN : null,
      msPromedio: a.msN ? Math.round(a.msSuma / a.msN) : null,
      errores: a.errores,
      looksArriba: a.looksArriba,
      looksAbajo: a.looksAbajo,
      looksTotales: a.looksTotales,
      ladosConLooks: a.ladosConLooks,
    })),
    empates,
    votados,
    p: va && vb ? pBinomial(va.victorias, vb.victorias) : null,
    consistencia: { espejos, coinciden },
  };
}

// ── El resumen entre corridas ──────────────────────────────────────────────

/** Lo que Vercel corta. Un generador que lo pase no puede ir a producción
 * aunque gane la votación: el juez todavía tiene que correr detrás. */
export const LIMITE_VERCEL_MS = 60_000;

export type FilaResumen = {
  clave: string;
  etiqueta: string;
  corridas: number;
  paresVotados: number;
  ganaControl: number;
  ganaRetador: number;
  empates: number;
  /** Costo y tiempo por lado, del retador y del control de SUS corridas. */
  costoRetador: number | null;
  costoControl: number | null;
  msRetador: number | null;
  msControl: number | null;
  errores: number;
  /** Versiones del pool de briefs que resolvió este retador, ordenadas. */
  pools: string[];
};

/**
 * Cada retador contra el control, leyendo TODAS sus corridas juntas.
 *
 * Existe porque la decisión ("qué modelo usamos") no vive en ninguna corrida
 * sola: hay que comparar Sonnet, Gemini y Kimi entre sí, y cada uno tiene su
 * propia corrida contra producción. Sin esta vista había que abrir tres
 * marcadores y sostenerlos en la cabeza.
 *
 * Se apoya en que el pool de briefs está CONGELADO: las corridas son
 * comparables entre sí porque resolvieron los mismos días. Cuando el pool
 * cambia de versión eso deja de ser cierto ENTRE retadores, así que cada fila
 * arrastra en qué pool se midió y la pantalla avisa si se están mezclando.
 */
export function resumenPorRetador(input: {
  corridas: {
    id: string;
    variantes: { clave: string; etiqueta: string }[];
    /** Ausente en corridas anteriores al versionado: son del pool v1. */
    pool?: string | null;
  }[];
  pares: { corrida_id: string; voto: string | null }[];
  lados: {
    corrida_id: string;
    variante: string;
    costo_usd: number | null;
    ms: number | null;
    error: string | null;
  }[];
}): FilaResumen[] {
  const CONTROL = "produccion";
  const acc = new Map<string, FilaResumen & { cR: number; cRn: number; cC: number; cCn: number; mR: number; mRn: number; mC: number; mCn: number; poolSet: Set<string> }>();
  // De cada corrida, quién es el retador (la variante que no es el control).
  const retadorDe = new Map<string, { clave: string; etiqueta: string }>();

  for (const c of input.corridas) {
    const r = c.variantes.find((v) => v.clave !== CONTROL);
    if (!r || !c.variantes.some((v) => v.clave === CONTROL)) continue;
    retadorDe.set(c.id, r);
    if (!acc.has(r.clave)) {
      acc.set(r.clave, {
        clave: r.clave,
        etiqueta: r.etiqueta,
        corridas: 0,
        paresVotados: 0,
        ganaControl: 0,
        ganaRetador: 0,
        empates: 0,
        costoRetador: null,
        costoControl: null,
        msRetador: null,
        msControl: null,
        errores: 0,
        pools: [],
        cR: 0, cRn: 0, cC: 0, cCn: 0, mR: 0, mRn: 0, mC: 0, mCn: 0,
        poolSet: new Set<string>(),
      });
    }
    acc.get(r.clave)!.corridas++;
    acc.get(r.clave)!.poolSet.add(c.pool || "v1");
  }

  for (const p of input.pares) {
    const r = retadorDe.get(p.corrida_id);
    if (!r || p.voto == null) continue;
    const a = acc.get(r.clave)!;
    a.paresVotados++;
    if (p.voto === "empate") a.empates++;
    else if (p.voto === CONTROL) a.ganaControl++;
    else a.ganaRetador++;
  }

  for (const l of input.lados) {
    const r = retadorDe.get(l.corrida_id);
    if (!r) continue;
    const a = acc.get(r.clave)!;
    if (l.error) {
      // Solo cuentan como error del RETADOR los suyos: que el control falle en
      // su corrida no dice nada del que se está midiendo.
      if (l.variante === r.clave) a.errores++;
      continue;
    }
    const esRetador = l.variante === r.clave;
    if (l.costo_usd != null) {
      if (esRetador) { a.cR += l.costo_usd; a.cRn++; } else { a.cC += l.costo_usd; a.cCn++; }
    }
    if (l.ms != null) {
      if (esRetador) { a.mR += l.ms; a.mRn++; } else { a.mC += l.ms; a.mCn++; }
    }
  }

  return [...acc.values()]
    .map((a) => ({
      clave: a.clave,
      etiqueta: a.etiqueta,
      corridas: a.corridas,
      paresVotados: a.paresVotados,
      ganaControl: a.ganaControl,
      ganaRetador: a.ganaRetador,
      empates: a.empates,
      costoRetador: a.cRn ? a.cR / a.cRn : null,
      costoControl: a.cCn ? a.cC / a.cCn : null,
      msRetador: a.mRn ? Math.round(a.mR / a.mRn) : null,
      msControl: a.mCn ? Math.round(a.mC / a.mCn) : null,
      errores: a.errores,
      pools: [...a.poolSet].sort(),
    }))
    // Primero quien más veces le ganó al control: es el orden de la decisión.
    .sort((x, y) => y.ganaRetador - x.ganaRetador || x.ganaControl - y.ganaControl);
}

// ── El estimado ────────────────────────────────────────────────────────────

/**
 * Lo que costaría la corrida ANTES de lanzarla. Tamaños MEDIDOS de una corrida
 * real del pipeline completo sobre el clóset de Roberto (113 prendas,
 * 2026-08-05): ~82k tokens repartidos en 4 llamadas — el prompt del motor y el
 * del juez entran en ~20k cada uno. Se toma el caso caro (3 jueces, salida
 * llena) para que el estimado nunca quede corto: el real de esa corrida fue
 * $0.25/lado con Opus contra $0.31 estimado.
 *
 * Los pares espejo no se cuentan: reusan looks ya generados.
 */
export function estimadoMotor(
  claves: string[],
  nPares: number
): number | null {
  let porPar = 0;
  for (const clave of claves) {
    const v = variantePorClave(clave);
    if (!v) return null;
    const gen = costoUsd(v.modeloId ?? ENGINE_MODEL, { entrada: 20000, salida: 2500 });
    const juez = costoUsd(JUDGE_MODEL, { entrada: 20000, salida: 800 });
    if (gen === null || juez === null) return null;
    porPar += gen + 3 * juez;
  }
  return porPar * nPares;
}
