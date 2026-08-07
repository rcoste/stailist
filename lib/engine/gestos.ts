// LOS GESTOS DE STYLING, contados. Aritmética, no opinión.
//
// POR QUÉ EXISTE
// El wow es la nota más baja del eval (2.98) y el diagnóstico salió de contar,
// no de opinar: de 40 tips, 27 decían "deja X abierto", arremangar aparecía una
// vez y un accesorio, ninguna. El motor no carecía de gestos — tenía UNO.
//
// Y ESTA ES LA MÉTRICA QUE NO SE PUEDE ADULAR. El wow lo califica un juez, y en
// cuanto se optimiza el prompt contra ese juez, la nota deja de medir (Goodhart:
// lo que gatea la generación deja de poder evaluarla). La variedad de gestos, en
// cambio, es un conteo sobre el texto que el motor produjo: da igual lo que el
// juez opine. Por eso es la métrica PRIMARIA del wow y la rúbrica es el
// termómetro secundario.
//
// LO QUE ESTA MÉTRICA NO DICE: si el gesto es BUENO. Un motor podría rotar
// gestos absurdos y sacar variedad perfecta. Por eso no decide sola — decide un
// vistazo a ciegas en el comparador. Sirve para saber si vale la pena pedirlo.

export type Gesto =
  | "abrir-capa"
  | "arremangar"
  | "fajar"
  | "cuffear"
  | "proporcion"
  | "cuello"
  | "calzado"
  | "accesorio"
  | "abotonar"
  | "otro";

/**
 * Los patrones, en orden de especificidad: el primero que casa gana.
 *
 * "Abrir la capa" va casi al final a propósito — es el gesto que absorbe todo
 * si se evalúa primero ("deja el cuello por fuera del half-zip" también empieza
 * con "deja"). Y su patrón busca el ESTADO ("abierta", "desabrochado") sin
 * exigir cómo está armada la frase: el primer intento pedía artículo + una
 * palabra + adjetivo, y "deja la chamarra de piel abierta" —un tip literal de
 * la corrida— no casaba. Una métrica que subestima al motor por su propia
 * gramática no sirve para medir si el motor mejoró.
 */
// EL PRINCIPIO, aprendido a golpes: EL GESTO ES EL VERBO, NO EL SUSTANTIVO.
//
// Un tip nombra varias prendas, y solo UNA es sobre la que se actúa. Las demás
// son el efecto ("deja la chamarra abierta para que se vea la camiseta contra
// los botines") o el contexto. Un patrón que busque el sustantivo suelto cuenta
// como gesto cada mención — y entonces la métrica que existe para detectar que
// el motor repite el mismo movimiento reporta una variedad que no existe.
//
// Pasó tres veces antes de escribirlo así: "cuello" cazaba el cuello que ASOMA,
// "calzado" cazaba los botines que se VEN, y "oxford" —que en español es más
// común como tipo de camisa que de zapato— convertía "los botones de la camisa
// oxford" en un gesto de calzado. Cada falso positivo inflaba la mejora.
const CAPAS = "blazer|saco|chamarra|abrigo|cardigan|overshirt|sobrecamisa|puffer|gabardina|bomber|chaleco|kimono";
const PATRONES: { gesto: Gesto; re: RegExp }[] = [
  { gesto: "arremangar", re: /arremang|remang|enrolla|dobla.*(manga|puno)|vuelta.*(manga|puno)|manga.*vuelta/i },
  { gesto: "cuffear", re: /cuffe|dobladillo|remanga.*pantal|dobla.*pantal|vuelta.*(pantal|bajo)|(sube|dobla).*tobillo/i },
  { gesto: "fajar", re: /\bfaj(a|as|ar|ada|ado|ando|alo|ala|ate)|por dentro del pantal|metete/i },
  // El NUDO: gesto propio, y uno que el motor no producía antes de darle el
  // repertorio. No es "accesorio" genérico — es cómo se lleva la corbata.
  { gesto: "accesorio", re: /nudo|corbata|mono\b|reloj|lentes|gafas|bufanda|panuelo|gorra|sombrero|(cinturon|correa)\s+\w*\s*(alinead|del mismo|que hable|a juego)/i },
  {
    gesto: "cuello",
    // El verbo puede venir separado del sustantivo por determinantes y
    // ordinales ("deja los dos primeros botones"): se permiten hasta ~3
    // palabras en medio, no un comodín abierto que se comería media frase.
    re: /(abre|abrir|desabotona|desabrocha|suelta|levanta|sube|saca|deja)\s+(\w+\s+){0,3}(boton|botones|cuello|solapa)|cuello (por fuera|arriba|parado|levantado)|escote/i,
  },
  // El calzado solo cuando se ACTÚA sobre él. Y "oxford" queda fuera salvo que
  // venga con "zapato": la camisa oxford es más frecuente en este clóset.
  {
    gesto: "calzado",
    re: /(ponte|usa|lleva|cambia|elige|luce|alinea)\s+(los?\s+|las?\s+)?(zapatos?|tenis|botines?|botas?|mocasines?|derbys?)|sin calcet|calcetin|zapato oxford/i,
  },
  { gesto: "proporcion", re: /proporci|volumen|holgad|entallad|equilibr|silueta/i },
  // Abrir la capa: el VERBO (abre/deja abierta/desabrocha) sobre una prenda de
  // capa. Antes bastaba el adjetivo "abierto" en cualquier parte de la frase.
  {
    gesto: "abrir-capa",
    re: new RegExp(
      `(abre|abrir|desabroch\\w*|deja\\w*)\\s+(el|la|los|las)?\\s*(${CAPAS})|(${CAPAS})\\s+\\w*\\s*(abiert[oa]|desabroch\\w*|sin abrochar|a medio cerrar|sin cerrar)`,
      "i"
    ),
  },
  { gesto: "abotonar", re: /abotona|abrochate|abrocha|cierra|cerrad[oa]/i },
  // Red de seguridad: un "abierto/desabrochado" que no nombró una capa
  // conocida. Va al final para no comerse los gestos específicos de arriba.
  { gesto: "abrir-capa", re: /abiert[oa]|desabroch|sin abrochar|a medio cerrar/i },
];

/**
 * Sin tildes y en minúsculas, para que los patrones se escriban una sola vez.
 *
 * Las tildes rompieron DOS patrones distintos antes de esto ("Fájala" contra
 * `faj`, "Métete" contra `met[eé]te` — la tilde estaba en otra vocal de la que
 * yo suponía). Parchear cada regex con clases `[aá]` es interminable y falla en
 * silencio: un patrón que no casa no truena, solo cuenta el gesto como "otro" y
 * hace que el motor parezca más variado de lo que es. Normalizar una vez mata
 * la clase entera. Mismo helper que ya usa el buscador del clóset.
 */
const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Qué gesto es este tip. "otro" cuando no casa ninguno conocido. */
export function gestoDeTip(tip: string | null | undefined): Gesto | null {
  const t = tip?.trim();
  if (!t) return null;
  const plano = sinTildes(t);
  for (const p of PATRONES) if (p.re.test(plano)) return p.gesto;
  return "otro";
}

export type VariedadGestos = {
  /** Tips no vacíos. */
  conTip: number;
  /** Looks totales mirados (con y sin tip). */
  total: number;
  /** Cuántos gestos DISTINTOS aparecieron. */
  distintos: number;
  /** Cuántas veces cada gesto. */
  porGesto: Record<string, number>;
  /**
   * Qué tan concentrado está el repertorio en su gesto favorito: la proporción
   * del más frecuente sobre el total. 1.00 = un solo truco.
   *
   * Es la cifra que importa. En la línea base v44 (corrida 7e10d12b) daba
   * 0.60: "abrir la capa" 24 veces de 40, seis veces más que el siguiente.
   *
   * OJO CON ESTE NÚMERO, que cambió dos veces antes de asentarse — y las dos
   * por defectos del clasificador, no del motor. El grep de reconocimiento dijo
   * 27/40 (patrón laxo); la primera versión del clasificador dijo 18/40 (falsos
   * positivos hacia "calzado" y "cuello" que repartían gestos que no existían);
   * con el principio del verbo aplicado, 24/40. La moraleja va aquí porque es
   * la trampa de esta métrica: **un clasificador con falsos positivos hace que
   * el motor parezca más variado de lo que es**, y esta métrica existe justo
   * para detectar lo contrario. Cualquier cambio a los patrones obliga a
   * re-medir TODAS las corridas que se vayan a comparar, no solo la nueva.
   */
  dominancia: number;
  /**
   * Índice de Shannon normalizado (0-1) sobre la distribución de gestos: 1 =
   * perfectamente repartido entre los gestos usados, 0 = todo en uno. Va junto
   * a `dominancia` porque las dos fallan en casos distintos: dominancia no ve
   * la cola (dos gestos al 50% se ven igual de bien que cinco al 20%), y
   * Shannon sí.
   */
  equilibrio: number;
};

export function variedadDeGestos(
  tips: (string | null | undefined)[]
): VariedadGestos {
  const porGesto: Record<string, number> = {};
  let conTip = 0;
  for (const t of tips) {
    const g = gestoDeTip(t);
    if (!g) continue;
    conTip++;
    porGesto[g] = (porGesto[g] ?? 0) + 1;
  }
  const cuentas = Object.values(porGesto);
  const distintos = cuentas.length;
  const dominancia = conTip ? Math.max(0, ...cuentas) / conTip : 0;
  // Shannon normalizado por log(distintos): con un solo gesto da 0 por
  // definición, que es justo lo que queremos leer como "sin variedad".
  let h = 0;
  for (const c of cuentas) {
    const p = c / conTip;
    h -= p * Math.log(p);
  }
  const equilibrio = distintos > 1 ? h / Math.log(distintos) : 0;
  return {
    conTip,
    total: tips.length,
    distintos,
    porGesto,
    dominancia: Math.round(dominancia * 100) / 100,
    equilibrio: Math.round(equilibrio * 100) / 100,
  };
}
