// La formalidad de un evento: un solo lugar para los cuatro niveles, cómo se le
// enseñan a una persona y qué le dicen al motor.
//
// POR QUÉ EXISTE ESTE ARCHIVO
// Esta tabla vivía escrita CUATRO veces: en el wizard, en el prompt del motor,
// en la rúbrica y —cruda, sin traducir— en la pantalla donde se califica el
// comparador. Cuando el criterio cambió ("formal es traje y corbata, no
// esmoquin") hubo que acordarse de tres, y la cuarta se quedó atrás: Roberto,
// votando el veredicto, vio "Pidió: una boda de noche, en salón · formal" y
// dijo "aquí no está tan claro al decir formal cuál era el dress code".
//
// O sea que el propio evaluador tenía el problema que la app le arregló al
// usuario. Un dato que no se puede leer no se puede calificar.
//
// EL TITULAR ES LA ROPA, LA JERGA ES LA PISTA
// "La mayoría de la gente tiene el problema de que si lee formal, coctel, gala
// o etiqueta, no sepa cuál es el dress code que implica" (Roberto). Y va por
// género porque el ancla concreta lo es: "traje y corbata" no le dice nada a
// una mujer.

/**
 * Los cuatro niveles de la escalera + "playa", que NO es un nivel.
 *
 * "playa" es un código de vestimenta que manda el LUGAR, no el nivel: una boda
 * en la playa pide guayabera o lino y castiga exactamente lo que premia una
 * boda de salón (traje oscuro, corbata, suela de cuero). Por eso no vive en la
 * escalera de formalidadDeEvento —subir o bajar un escalón desde "playa" no
 * significa nada— y solo se ofrece en los planes donde el lugar existe.
 */
export type Formalidad = "casual" | "semiformal" | "formal" | "gala" | "playa";

export const FORMALIDADES: {
  key: Formalidad;
  hombre: string;
  mujer: string;
  neutro: string;
  /** Cómo lo nombra la invitación. */
  jerga: string;
  /** Lo que recibe el motor. Concreto y con su prohibición explícita. */
  paraElMotor: string;
}[] = [
  {
    key: "casual",
    hombre: "sin saco",
    mujer: "sin arreglarte de más",
    neutro: "sin arreglarte de más",
    jerga: "casual · sport",
    paraElMotor: "casual (relajado pero cuidado)",
  },
  {
    key: "semiformal",
    hombre: "saco, sin corbata",
    mujer: "de coctel",
    neutro: "arreglado, sin llegar a traje",
    jerga: "semiformal · coctel · cocktail",
    paraElMotor: "semiformal / coctel (saco sí, corbata opcional)",
  },
  {
    key: "formal",
    hombre: "traje y corbata",
    mujer: "vestido largo o midi",
    neutro: "traje y corbata, o vestido largo",
    jerga: "formal · etiqueta",
    paraElMotor:
      "formal — TRAJE Y CORBATA. En México esto NO es esmoquin: es traje oscuro (marino, gris o negro), camisa lisa y corbata. Si el clóset tiene esmoquin, NO lo uses aquí; el esmoquin es solo para etiqueta rigurosa",
  },
  {
    key: "gala",
    hombre: "esmoquin",
    mujer: "vestido largo de gala",
    neutro: "esmoquin, o vestido largo de gala",
    jerga: "etiqueta rigurosa · black tie · gala",
    paraElMotor:
      "etiqueta rigurosa / black tie — AQUÍ SÍ va el esmoquin, y con su código completo: moño (nunca corbata larga), camisa blanca, pantalón del propio esmoquin y SIN cinturón. Si el clóset no tiene con qué completarlo, arma un traje oscuro impecable en vez de un esmoquin a medias",
  },
  // Va al final a propósito: no es el escalón que sigue de "gala", es otro eje.
  // La boda en la playa es frecuente de verdad en México y hasta hoy no tenía
  // dónde caer: quien la pedía elegía "formal" y recibía traje oscuro y suela
  // de cuero para la arena.
  {
    key: "playa",
    hombre: "guayabera o lino",
    mujer: "vestido fresco, fluido",
    neutro: "lino fresco o vestido fluido",
    jerga: "de playa · beach formal",
    paraElMotor:
      "boda o evento EN LA PLAYA (o jardín de destino, con arena y calor). El código lo manda el lugar: telas frescas y claras —lino, algodón, guayabera— y NADA de traje oscuro, corbata ni esmoquin: ahí es un error de lectura del lugar, no una virtud. El CALZADO tiene que funcionar en arena o pasto: mocasín ligero, alpargata o sandalia de vestir; fuera el zapato de vestir de suela de cuero, y fuera el tacón de aguja (se entierra en la arena) — si hay tacón, que sea cuña o plataforma. Sigue siendo una boda: nada de traje de baño, short de playa, chanclas ni nada de blanco entero",
  },
];

export function formalidadPorClave(k: string | null | undefined) {
  return FORMALIDADES.find((f) => f.key === k) ?? null;
}

/** El ancla concreta según a quién se le pregunta. */
export function ropaDeFormalidad(
  f: (typeof FORMALIDADES)[number],
  gender: string | null
): string {
  return gender === "hombre" ? f.hombre : gender === "mujer" ? f.mujer : f.neutro;
}

/**
 * Cómo se LEE una formalidad ya elegida: la ropa primero, la jerga después.
 * Lo usa la pantalla de votación del comparador — quien califica necesita
 * exactamente lo mismo que quien pide: saber qué implica la palabra.
 */
export function formalidadLegible(
  k: string | null | undefined,
  gender: string | null = null
): string | null {
  const f = formalidadPorClave(k);
  return f ? `${ropaDeFormalidad(f, gender)} (${f.jerga})` : null;
}

/** La línea que va al prompt y a la rúbrica. Vacía si no se eligió. */
export function lineaFormalidad(k: string | null | undefined): string {
  return formalidadPorClave(k)?.paraElMotor ?? "";
}
