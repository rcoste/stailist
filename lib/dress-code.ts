// El código de vestimenta del trabajo: un solo lugar para las cuatro opciones,
// cómo se le enseñan a la persona y qué le dicen al motor.
//
// POR QUÉ EXISTE ESTE ARCHIVO Y NO TRES COPIAS
// La formalidad del evento vivía escrita en la pantalla, otra vez en el prompt
// y otra vez en la rúbrica, y cuando cambió el criterio ("formal es traje y
// corbata, no esmoquin") hubo que acordarse de los tres. Aquí no: la pantalla
// pinta `ropa`/`ejemplos` y el motor recibe `paraElMotor`.
//
// EL TITULAR ES LA ROPA, NO LA JERGA
// Roberto: "la mayoría de la gente tiene el problema de que si lee formal,
// coctel, gala o etiqueta, no sepa cuál es el dress code que implica". Vale
// igual para el trabajo: "business casual" no le dice nada a mucha gente, y
// "me pongo camisa, sin saco" sí. La jerga queda de pista, para quien la use.
//
// Y VA POR GÉNERO, porque el ancla concreta lo es.

export type WorkDressCode = "formal" | "business_casual" | "casual" | "variable";

export const WORK_DRESS_CODES: {
  key: WorkDressCode;
  hombre: string;
  mujer: string;
  neutro: string;
  /** La pista: dónde se trabaja así, o cómo se le llama. */
  ejemplos: string;
  /** Lo que recibe el motor. Concreto y accionable, no una etiqueta. */
  paraElMotor: string;
}[] = [
  {
    key: "formal",
    hombre: "traje o al menos saco",
    mujer: "traje sastre o blazer",
    neutro: "traje, o al menos saco",
    ejemplos: "corporativo · banca · despachos · legal",
    paraElMotor:
      "Su trabajo es de código FORMAL (banca, despacho, legal): el look de trabajo lleva saco o blazer, pantalón de vestir o equivalente, y calzado de piel. Nada de jeans, tenis ni prendas deportivas.",
  },
  {
    key: "business_casual",
    hombre: "camisa o polo, sin saco",
    mujer: "blusa o camisa, sin blazer",
    neutro: "camisa o blusa, sin saco",
    ejemplos: "business casual · corporativo relajado",
    paraElMotor:
      "Su trabajo es BUSINESS CASUAL: camisa o polo (o blusa) con chino o pantalón de vestir; el saco es opcional, no obligatorio. Jeans oscuros y limpios pasan si el resto sube el registro. Fuera lo deportivo y las bermudas.",
  },
  {
    key: "casual",
    hombre: "jeans y estoy bien",
    mujer: "jeans y estoy bien",
    neutro: "jeans y estoy bien",
    ejemplos: "agencia · tech · creativo · home office",
    paraElMotor:
      "Su trabajo es CASUAL/CREATIVO (agencia, tech): jeans y camiseta limpia son correctos ahí — no lo sobrevistas de oficina corporativa. Lo que se cuida es que se vea intencional, no formal.",
  },
  {
    key: "variable",
    hombre: "depende del día",
    mujer: "depende del día",
    neutro: "depende del día",
    ejemplos: "unos días veo cliente y otros no",
    paraElMotor:
      "Su código de trabajo VARÍA según el día (unos ve cliente y otros no). Sin más señal, arma en business casual —camisa o blusa con pantalón, saco opcional— que funciona en los dos extremos, y menciona en el tip cómo subir o bajar el registro si ese día tiene junta.",
  },
];

/**
 * La línea del caso VARIABLE, ya sabiendo cómo es HOY.
 *
 * Elegir "depende del día" es la persona diciendo que ese dato es del DÍA, no
 * de ella — así que se le pregunta el día, igual que el paraguas. Sin la
 * respuesta el motor tiene que cubrirse en medio, y ahí sale mal por los dos
 * lados: corto el día de cliente, tieso el día que no. Roberto, que es este
 * caso: "trabajo en home office pero cuando veo cliente me visto más formal".
 */
const VARIABLE_HOY: Record<"si" | "no", string> = {
  si: "Su código de trabajo varía según el día, y HOY SÍ VE CLIENTE: sube el registro — saco o blazer sobre camisa (o blusa), pantalón de vestir o chino oscuro, calzado de piel. Hoy NO es día de jeans ni de tenis.",
  no: "Su código de trabajo varía según el día, y HOY NO VE CLIENTE: no lo sobrevistas de junta. Business casual real o incluso jeans oscuros y limpios con una prenda que suba el conjunto; cómodo y cuidado, sin saco obligatorio.",
};

export function dressCodePorClave(k: string | null | undefined) {
  return WORK_DRESS_CODES.find((d) => d.key === k) ?? null;
}

/** El ancla concreta según a quién se le pregunta. */
export function ropaDeDressCode(
  d: (typeof WORK_DRESS_CODES)[number],
  gender: string | null
): string {
  return gender === "hombre" ? d.hombre : gender === "mujer" ? d.mujer : d.neutro;
}

/**
 * La línea que va al prompt. Vacía si no se le ha preguntado.
 *
 * `veCliente` solo aplica al caso "variable" y solo cuando se sabe: en los
 * otros tres el registro no cambia por el día, y preguntarlo sería ruido.
 */
export function lineaDressCode(
  k: string | null | undefined,
  veCliente?: boolean | null
): string {
  if (k === "variable" && (veCliente === true || veCliente === false)) {
    return VARIABLE_HOY[veCliente ? "si" : "no"];
  }
  return dressCodePorClave(k)?.paraElMotor ?? "";
}
