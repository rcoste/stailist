import { TIPOS_EVENTO } from "@/lib/eventos";

// EL REGISTRO: lo mínimo que hay que saber para contestar "¿me veo bien?".
//
// POR QUÉ EXISTE. El fit check contestaba cinco cosas sin saber a dónde vas.
// Cuatro de ellas no lo necesitan —qué traes puesto, qué le hace el color a tu
// cara, si el clima te va a agarrar mal, cómo se llama el look— pero la quinta
// sí, y es justo por la que alguien abre la app: ¿voy de más? ¿voy de menos?
// Esa pregunta la app NO PODÍA contestar, y el modelo la rellenaba solo: en las
// lecturas reales tituló "Lino y domingo" y "Café en el jardín" sin que nadie
// le dijera qué día era ni dónde estaba. O sea que el contexto ya se estaba
// usando; lo único que faltaba era que fuera verdad y se pudiera corregir.
//
// POR QUÉ CUATRO Y NO LOS OCHO PLANES DEL WIZARD. El wizard pregunta para
// ARMAR un look y ahí la ocasión fina paga (una boda no es una cena). Aquí ya
// estás vestida en la puerta: lo único que mueve la respuesta es el REGISTRO,
// que es una escala de tres escalones más una salida. Preguntar más sería
// cobrarle al momento que hace que este módulo funcione.

export type Registro = "normal" | "trabajo" | "especial" | "rapido";

export const REGISTROS: { key: Registro; label: string }[] = [
  { key: "normal", label: "un día normal" },
  { key: "trabajo", label: "trabajo" },
  { key: "especial", label: "algo especial" },
  { key: "rapido", label: "gym o un mandado" },
];

const CLAVES = new Set<string>(REGISTROS.map((r) => r.key));

/** ¿Es uno de los cuatro? Para no confiar en lo que llegue por el request. */
export function esRegistro(v: unknown): v is Registro {
  return typeof v === "string" && CLAVES.has(v);
}

// Los planes del wizard que significan trabajo. `comida-trabajo` está en el
// catálogo de eventos pero su registro es el de la oficina, no el de una cena:
// es la excepción y por eso se nombra.
const DE_TRABAJO = new Set(["oficina", "comida-trabajo"]);

/**
 * De la ocasión con la que pidió un look, a registro.
 *
 * Se deriva del CATÁLOGO de eventos y no de una lista escrita a mano: cuando
 * alguien agregue "bautizo" a lib/eventos, este mapa ya lo trata como especial
 * en vez de dejarlo caer en "normal" sin que nadie se entere.
 */
export function registroDeOcasion(ocasion: string | null | undefined): Registro | null {
  if (!ocasion) return null;
  if (DE_TRABAJO.has(ocasion)) return "trabajo";
  if (ocasion === "evento") return "especial";
  if (TIPOS_EVENTO.some((t) => t.key === ocasion)) return "especial";
  if (ocasion === "diario" || ocasion === "viaje" || ocasion === "refrescar") return "normal";
  // Una ocasión que no conocemos NO inventa registro: devuelve null y manda el
  // siguiente indicio. Adivinar aquí es exactamente el error que este módulo
  // existe para no cometer.
  return null;
}

/**
 * Qué chip llega encendida.
 *
 * EL ORDEN ES POR CALIDAD DE LA EVIDENCIA, y el corte está puesto donde
 * equivocarse cuesta caro:
 *
 *   1. Lo que ELLA dijo hoy. Si ya pidió un look para la oficina, la app no
 *      está adivinando: se lo está acordando.
 *   2. El reloj, PERO SOLO PARA "trabajo" Y SOLO si su último objetivo ya era
 *      la oficina. Un martes a las 9am de alguien que trabaja en oficina es
 *      una apuesta razonable; el mismo martes de quien no, no lo es.
 *   3. "un día normal", que es el default honesto: no afirma nada.
 *
 * NUNCA se enciende "algo especial" ni "gym o un mandado" por corazonada. Las
 * dos son afirmaciones fuertes —una sube la vara y la otra la quita— y una
 * corazonada equivocada ahí da un consejo con toda la seguridad y todo mal,
 * que es peor que no tener contexto. Esas dos se encienden sólo si ella las
 * toca, o si hay un look de hoy que lo diga.
 */
export function registroSugerido(args: {
  /** La ocasión del último look, SI ese look es de hoy. null si no hay. */
  ocasionDeHoy: string | null;
  /** `profiles.last_objective` — para qué suele pedir looks. */
  lastObjective: string | null;
  /** Ahora, en hora LOCAL del dispositivo. El server corre en UTC. */
  ahora: Date;
}): Registro {
  const deHoy = registroDeOcasion(args.ocasionDeHoy);
  if (deHoy) return deHoy;

  const dia = args.ahora.getDay(); // 0 = domingo
  const hora = args.ahora.getHours();
  const enSemana = dia >= 1 && dia <= 5;
  const horarioDeOficina = hora >= 6 && hora < 18;
  if (enSemana && horarioDeOficina && DE_TRABAJO.has(args.lastObjective ?? "")) {
    return "trabajo";
  }
  return "normal";
}

/**
 * Si el look que tenemos a mano es de HOY, en calendario local.
 *
 * Va aquí y no en el server a propósito: el server corre en UTC y a las 6pm de
 * CDMX ya cree que es mañana — la misma trampa que ya mordió a `look_date`.
 */
export function esDeHoy(creadoEn: string, ahora: Date): boolean {
  const d = new Date(creadoEn);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ahora.getFullYear() &&
    d.getMonth() === ahora.getMonth() &&
    d.getDate() === ahora.getDate()
  );
}

/**
 * Lo que el registro le dice al modelo. Una línea, en el mismo tono del resto
 * del contexto del espejo.
 *
 * Cada una carga la VARA, no sólo la etiqueta: "trabajo" sin decir contra qué
 * se mide deja al modelo inventando el dress code, que es de donde venimos.
 */
export const LINEA_REGISTRO: Record<Registro, string> = {
  normal:
    "A dónde va: un día normal (calle, pendientes, ver gente). La vara es verse bien sin esfuerzo aparente: si va cómoda y armada, va bien. NO le pidas más formalidad de la que un día normal necesita.",
  trabajo:
    "A dónde va: a trabajar. La vara es verse profesional sin disfraz. Si algo de lo que trae desentona en una oficina —demasiado informal, demasiado de fiesta, demasiado revelador para su entorno— díselo AHORA, es el momento en que aún puede cambiarlo.",
  especial:
    "A dónde va: algo especial (una cena, una cita, una fiesta, un evento). La vara sube: aquí sí importa verse arreglada. Si lo que trae se queda corto para la ocasión, dilo claro y directo — quedarse corta en un evento es justo lo que vino a evitar preguntándote.",
  rapido:
    "A dónde va: al gym o a un mandado rápido. AQUÍ NO HAY VARA QUE CUMPLIR: no la juzgues por informal ni le sugieras arreglarse, sería no haber entendido la pregunta. Contesta corto y sin ceremonia; si algo de verdad estorba (le va a dar frío, el zapato no le sirve para eso), eso sí.",
};
