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

export type Formalidad = "casual" | "semiformal" | "formal" | "gala";

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
