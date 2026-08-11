import type { EngineItem } from "./prompt";
import type { Formalidad } from "@/lib/formalidad";

// ¿EL CLÓSET ALCANZA PARA ESTA FORMALIDAD? — el derecho del motor a decir "no".
//
// EL PROBLEMA, en las palabras de Roberto: "boda de etiqueta y el usuario no
// tiene traje. Debería decir NO y no permitir; no es que 'ok, pues puede con
// unos jeans más un suéter'. Va a haber casos en los que no haya prendas y no
// se pueda."
//
// Tiene razón, y hasta hoy el motor estaba CONSTRUIDO para no poder decirlo. El
// juez sí rechaza un look irreparable, pero el piso de 2 del pipeline lo
// rescata igual — con este comentario escrito al lado: "mejor un look mediocre
// que menos de 2". Esa premisa es verdadera para el día a día (siempre hay algo
// que ponerse) y FALSA para una boda de etiqueta: ahí no hay nada que ponerse,
// y decirlo vale más que inventarlo. Un stylist que te manda de jeans a una
// boda de etiqueta no pierde un punto de rúbrica, pierde toda su credibilidad.
//
// POR QUÉ VA EN CÓDIGO Y NO EN EL PROMPT
// "¿Tiene saco?" es una pregunta con respuesta verificable, no una opinión. Un
// modelo al que se le pide honestidad puede igual armar algo y llamarlo formal
// —es lo que ya hacía—; una consulta al clóset, no. Misma razón que
// reglas-ejecucion.ts.
//
// LO QUE ESTO MIDE Y LO QUE NO
// Mide CARENCIA ESTRUCTURAL: que falte la pieza sin la cual el código de
// vestimenta no existe. No mide si el traje es bonito ni si le queda. Y es
// deliberadamente permisivo en el borde: en la duda, DEJA PASAR y que el motor
// arme — un falso "no puedo" es peor que un look mediocre, porque le niega a la
// persona algo que sí tenía.

/** Qué le falta al clóset para cumplir un código de vestimenta. */
export type Alcance = {
  /** true = con esto no se puede armar el código; el motor debe decirlo. */
  faltaLoEsencial: boolean;
  /** Las piezas que faltan, en palabras de la persona. */
  faltan: string[];
  /** Lo que sí tiene y sirve — para no sonar a que no tiene nada. */
  tiene: string[];
};

const categoria = (i: EngineItem) => (i.attrs.categoria ?? "").toLowerCase();
const formalidadDe = (i: EngineItem) => (i.attrs.formalidad ?? "").toLowerCase();
const texto = (i: EngineItem) =>
  `${i.attrs.nombre ?? ""} ${i.attrs.tipo ?? ""} ${(i.attrs as { subtipo?: string }).subtipo ?? ""}`.toLowerCase();

/** Formal o formal-casual: lo que puede sostener un registro de vestir. */
const deVestir = (i: EngineItem) => /^formal/.test(formalidadDe(i));

const esSaco = (i: EngineItem) =>
  categoria(i) === "saco" || /saco|blazer|americana/.test(texto(i));

const esPantalonDeVestir = (i: EngineItem) =>
  categoria(i) === "bottom" &&
  deVestir(i) &&
  !/jean|mezclilla|denim|short|bermuda|jogger|cargo|chino de algod/.test(texto(i));

const esCamisaDeVestir = (i: EngineItem) =>
  categoria(i) === "top" && deVestir(i) && /camisa|blusa/.test(texto(i));

/**
 * Calzado que NUNCA sostiene un código formal, diga lo que diga su etiqueta.
 *
 * OJO CON LO QUE **NO** ESTÁ AQUÍ: "sandalia". La primera versión la excluía y
 * eso bloqueó el clóset de una usuaria REAL con 82 prendas — sus "Tacones nude
 * de tira" vienen del catálogo con `subtipo: "sandalia"`, que es correcto, y mi
 * regla los tiró. Una sandalia de tacón es calzado de boda; el excluyente sólo
 * valía para calzado masculino. Es el mismo sesgo de género que ya había
 * costado los anclajes de formalidad, cometido otra vez.
 *
 * La lección, generalizable: un excluyente sólo va aquí si es categórico para
 * CUALQUIER persona. En la duda, dejar pasar — un falso "no puedo" le niega a
 * alguien un look que sí podía armar.
 */
const NUNCA_DE_VESTIR = /tenis|sneaker|deportiv|chancla|hu[ai]rache|alpargata|crocs|pantufla/;

const esZapatoDeVestir = (i: EngineItem) =>
  categoria(i) === "calzado" &&
  (deVestir(i) ||
    /derby|oxford|mocas[ií]n|charol|tac[oó]n|zapatilla|brogue|monk|stiletto/.test(texto(i))) &&
  !NUNCA_DE_VESTIR.test(texto(i));

const esVestidoFormal = (i: EngineItem) =>
  categoria(i) === "vestido" && deVestir(i) && !/ba[ñn]o|bikini/.test(texto(i));

const esEsmoquin = (i: EngineItem) => /esmoquin|smoking|tuxedo|gala/.test(texto(i));

/**
 * ¿Este clóset da para este código de vestimenta?
 *
 * Solo se pronuncia sobre FORMAL y GALA. Casual y semiformal se resuelven con
 * casi cualquier clóset, y un "no puedo" ahí sería falso — es justo el error
 * que haría este chequeo dañino.
 *
 * Las dos vías valen: la sastrería (saco + pantalón de vestir + zapato) o el
 * vestido formal. Con una basta; exigir las dos negaría el código a media
 * población por su forma de vestirlo.
 */
export function alcanceDeFormalidad(
  items: EngineItem[],
  formalidad: Formalidad | null | undefined,
  /**
   * Para quién. Cambia UNA cosa y es importante: el saco es indispensable en el
   * formal MASCULINO ("traje y corbata" sin saco no existe), pero no en el
   * femenino — blusa de vestir + pantalón de vestir + tacón es un look formal
   * completo. Sin este parámetro la regla le exigiría un blazer a una mujer que
   * no lo necesita, que es el mismo sesgo que ya tiró los tacones de tira.
   *
   * Sin género declarado se usa el criterio PERMISIVO (el femenino): en la duda,
   * dejar pasar.
   */
  gender?: string | null
): Alcance {
  const nada: Alcance = { faltaLoEsencial: false, faltan: [], tiene: [] };
  // "playa" NO se gatea, y es una decisión, no un olvido: el hueco que abre es
  // que la boda de destino antes se pedía como "formal" y sí pasaba por aquí.
  // Se deja pasar porque este chequeo mide CARENCIA ESTRUCTURAL —falta el saco
  // sin el cual el código no existe— y en playa no hay una pieza así: casi
  // cualquier clóset tiene algo fresco, y un falso "no puedo" le niega a
  // alguien un look que sí podía armar. Si algún día se gatea, que sea con el
  // mismo criterio permisivo del resto del archivo.
  if (formalidad !== "formal" && formalidad !== "gala") return nada;

  const saco = items.filter(esSaco);
  const pantalon = items.filter(esPantalonDeVestir);
  const camisa = items.filter(esCamisaDeVestir);
  const zapato = items.filter(esZapatoDeVestir);
  const vestido = items.filter(esVestidoFormal);
  const sacoEsIndispensable = gender === "hombre";

  // Los atajos solo cierran FORMAL. En gala hay que seguir hasta el chequeo del
  // esmoquin: salir antes se comía ese aviso (lo cazó su propio test).
  if (formalidad === "formal") {
    // La vía del vestido cierra el código por sí sola (con calzado que acompañe).
    if (vestido.length > 0 && zapato.length > 0) return nada;
    // La vía sin saco: solo cuando el saco no es indispensable para este código.
    if (!sacoEsIndispensable && camisa.length > 0 && pantalon.length > 0 && zapato.length > 0) {
      return nada;
    }
  } else if (vestido.length > 0 && zapato.length > 0) {
    // Gala con vestido largo: el código se cierra por esa vía y el esmoquin no
    // aplica — pedirlo aquí sería el sesgo de siempre.
    return nada;
  }

  const faltan: string[] = [];
  const tiene: string[] = [];
  (saco.length ? tiene : faltan).push("un saco o blazer");
  (pantalon.length ? tiene : faltan).push("un pantalón de vestir");
  (zapato.length ? tiene : faltan).push("zapatos de vestir");
  // La camisa casi nunca falta y por eso NO cuenta para el veredicto: pedirla
  // convertiría este chequeo en un colador. Se nombra solo si falta.
  if (!camisa.length) faltan.push("una camisa de vestir");

  // Etiqueta rigurosa: además del traje completo pide el esmoquin. Se avisa
  // aparte —no como carencia estructural— porque un traje oscuro impecable es
  // una respuesta legítima cuando no hay esmoquin, y el prompt ya lo dice.
  const esencialesQueFaltan = faltan.filter((f) => f !== "una camisa de vestir");

  if (formalidad === "gala" && esencialesQueFaltan.length === 0 && !items.some(esEsmoquin)) {
    return { faltaLoEsencial: false, faltan: ["un esmoquin"], tiene };
  }

  return {
    faltaLoEsencial: esencialesQueFaltan.length > 0,
    faltan,
    tiene,
  };
}

/**
 * Lo que el motor debe decirle a la persona cuando no alcanza. Va en la voz del
 * producto —directa, sin disculpas— porque esto NO es un error: es la
 * información más útil que la app puede dar ese día.
 */
export function mensajeDeAlcance(a: Alcance, queEs: string): string {
  const falta = a.faltan.join(", ");
  return `Para ${queEs} te falta ${falta}. No te voy a armar algo que no va a funcionar ahí — mejor lo sabes hoy y no en la puerta.`;
}

/**
 * La línea para el PROMPT cuando el clóset da JUSTO (no falta lo esencial pero
 * sí algo). No bloquea: avisa, igual que el aviso de cobertura del estilo.
 */
export function lineaAlcance(a: Alcance): string {
  if (a.faltaLoEsencial || a.faltan.length === 0) return "";
  return `OJO — para este código de vestimenta le falta ${a.faltan.join(", ")}. Arma lo más cercano con lo que SÍ tiene y dilo en la explicación, en una frase y sin disculpas: qué le falta para cerrarlo del todo. No bautices el look como si cumpliera el código si no lo cumple.`;
}
