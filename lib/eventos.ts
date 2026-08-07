import type { Formalidad } from "@/lib/formalidad";

// LOS TIPOS DE EVENTO: un solo lugar para qué eventos existen, qué formalidad
// implica cada uno y qué le dicen al motor.
//
// POR QUÉ EXISTE
// Hasta hoy "evento" preguntaba SOLO el nivel de formalidad (4 opciones) y
// dejaba el resto a un campo de texto libre. Roberto: "podríamos tener ya
// opciones: una comida, cena, cita, boda, cosas así — y sobre eso vamos
// afinando más". Tiene razón y el veredicto lo probó: "evento · noche
// templada" era incalificable porque una boda y una cena con amigos comparten
// la etiqueta y no comparten nada de lo que el motor tiene que acertar.
//
// SUSTITUYE A LA PREGUNTA DE FORMALIDAD, NO SE SUMA A ELLA. Cada tipo trae su
// formalidad por defecto —que es lo que la gente NO sabe traducir ("si lee
// formal, coctel, gala o etiqueta no sabe cuál es el dress code que implica")—
// y se puede corregir si el caso es raro. Si se sumara, "evento" pasaría de una
// pregunta a dos y la promesa de <2 minutos se erosiona un poco cada vez.
//
// EL DEFAULT NO ES UNA LEY. Roberto: "si es una comida familiar, pues quién
// sabe; por alguna razón rara requiero traje sin corbata, pero no debería". Por
// eso el ajuste existe y por eso está detrás de un "no es tan formal / es más
// formal" en vez de la lista cruda de cuatro niveles.

export type TipoEvento = {
  key: string;
  /** Cómo lo llama la persona. */
  label: string;
  /** El default: qué formalidad implica normalmente. */
  formalidad: Formalidad;
  /**
   * Qué es este evento, para el motor y para el juez. NO es la formalidad (esa
   * ya viaja aparte): es lo que el nivel de formalidad NO captura — dónde te
   * sientas, cuánto caminas, si hay foto, qué se ve mal ahí.
   */
  paraElMotor: string;
  /**
   * Si de noche sube un escalón de formalidad.
   *
   * SOLO la cena con amigos, y esa restricción salió de una corrida: la primera
   * versión también subía boda y fiesta, y el eval lo cazó de inmediato — la
   * boda de noche pasaba a "etiqueta rigurosa" y el juez exigía esmoquin con
   * moño y charol en los dos looks. En México eso es falso: una boda de noche
   * en salón es traje oscuro y corbata; el black tie se especifica en la
   * invitación y se elige a mano (para eso está el ajuste). Subirlo por default
   * habría hecho que el motor pidiera un esmoquin que casi nadie tiene.
   *
   * Lo de la cena sí se sostiene: la diferencia entre comer y cenar con los
   * mismos amigos en el mismo lugar es real y es de un escalón.
   */
  subeDeNoche?: boolean;
};

export const TIPOS_EVENTO: TipoEvento[] = [
  {
    key: "comida-familiar",
    label: "comida familiar",
    formalidad: "casual",
    paraElMotor:
      "una comida en casa de familia: cómodo y presentable a la vez, se está sentado mucho rato y probablemente hay fotos. Nada de ropa de gimnasio ni de playa, pero tampoco traje",
  },
  {
    key: "cena-amigos",
    label: "cena con amigos",
    formalidad: "casual",
    paraElMotor:
      "una cena con amigos en un restaurante: casual pero con intención — es la ocasión donde más se nota si te arreglaste. Un escalón arriba de lo diario, sin llegar a saco obligatorio",
    subeDeNoche: true,
  },
  {
    key: "cita",
    label: "una cita",
    formalidad: "semiformal",
    paraElMotor:
      "una cita: se está cerca y de frente, así que lo que toca la cara y las texturas pesan más que de costumbre. Arreglado sin verse disfrazado — que se note el esfuerzo, no el intento",
  },
  {
    key: "comida-trabajo",
    label: "comida de trabajo",
    formalidad: "semiformal",
    paraElMotor:
      "una comida o cena con clientes o colegas: el registro es el de trabajo subido un escalón. Tiene que verse serio sin verse rígido, y aguantar que te vean sentado varias horas",
  },
  {
    key: "fiesta",
    label: "una fiesta",
    formalidad: "semiformal",
    paraElMotor:
      "una fiesta: se está de pie y se baila, así que el calzado tiene que aguantar. Es la ocasión con más permiso para arriesgar en color y textura",
  },
  {
    key: "boda",
    label: "una boda",
    formalidad: "formal",
    paraElMotor:
      "una boda: hay fotos, hay ceremonia y se está de pie y sentado por turnos. NUNCA de blanco entero (es de quien se casa) y nada que compita con el protagonismo de los novios",
  },
  {
    key: "graduacion",
    label: "una graduación",
    formalidad: "formal",
    paraElMotor:
      "una graduación: acto con público y fotos. Registro formal pero de día — se puede respirar más que en una boda de noche",
  },
  {
    key: "funeral",
    label: "un funeral",
    formalidad: "formal",
    paraElMotor:
      "un funeral o misa: sobrio y discreto. Tonos oscuros o apagados, nada llamativo, nada que pida atención. Aquí la regla de no destacar MANDA sobre cualquier preferencia de estilo o de colorimetría",
  },
];

export function tipoEventoPorClave(k: string | null | undefined): TipoEvento | null {
  return TIPOS_EVENTO.find((t) => t.key === k) ?? null;
}

/**
 * La formalidad que implica un tipo de evento, ya considerando el momento.
 * Solo sube un escalón, nunca dos: una cena con amigos no llega a formal por
 * ser de noche.
 */
export function formalidadDeEvento(
  k: string | null | undefined,
  momento: "dia" | "noche" | null
): Formalidad | null {
  const t = tipoEventoPorClave(k);
  if (!t) return null;
  if (momento !== "noche" || !t.subeDeNoche) return t.formalidad;
  const ESCALERA: Formalidad[] = ["casual", "semiformal", "formal", "gala"];
  const i = ESCALERA.indexOf(t.formalidad);
  return ESCALERA[Math.min(i + 1, ESCALERA.length - 1)];
}

/** La línea que va al prompt y a la rúbrica. Vacía si no se eligió un tipo. */
export function lineaTipoEvento(k: string | null | undefined): string {
  return tipoEventoPorClave(k)?.paraElMotor ?? "";
}
