// QUÉ PRENDAS PUEDEN FIJARSE JUNTAS PARA UN MISMO LOOK.
//
// Con una sola ancla esto no existía: cualquier prenda era fijable. Con varias
// aparece una pregunta nueva —¿y si elige dos pantalones?— y hay dos formas de
// contestarla: dejar que el motor se las arregle, o no dejar que la combinación
// imposible se arme siquiera.
//
// Se elige lo segundo, y no por purismo: el motor tiene ORDEN DE NO SOLTAR
// NINGUNA ancla (regla dura del prompt + dos redes en código). Si le llegan dos
// pantalones, va a obedecer y va a devolver un look con dos pantalones. El
// único lugar donde eso se puede evitar sin romper esa promesa es antes, al
// elegir — y ahí es gratis e instantáneo.

/** Cuántas se pueden fijar a la vez. */
export const MAX_ANCLAS = 3;

/**
 * Por qué NO se explica en la UI: el tope existe para que "arma un look" siga
 * significando algo. Un outfit son 5 prendas; con 4 fijas el motor deja de
 * estilizar y se vuelve un validador. Con 3 todavía elige dos de cinco.
 *
 * Y hay salida para quien quiere decidirlo todo: el probador, que dibuja
 * exactamente las prendas que elijas sin opinar. Son dos deseos distintos y
 * ahora cada uno tiene su pantalla.
 */
export const RAZON_TOPE = `puedes fijar hasta ${MAX_ANCLAS} — si quieres armarlo entero, usa "pruébate un look"`;

/** Cuántas de cada categoría caben en un mismo cuerpo. */
const CUPO: Record<string, number> = {
  bottom: 1,
  calzado: 1,
  vestido: 1,
};

// LOS TOPS NO TIENEN CUPO, y es deliberado: camisa + suéter es un look en
// capas, no un error. Lo mismo un saco bajo un abrigo. La regla sólo caza lo
// que es físicamente imposible, no lo que se ve raro — de eso opina el motor.
const ETIQUETA: Record<string, string> = {
  bottom: "un pantalón",
  calzado: "unos zapatos",
  vestido: "un vestido",
};

/**
 * Por qué esta prenda no puede sumarse a las ya fijadas. `null` = sí puede.
 *
 * Devuelve el motivo en palabras y no un booleano porque la UI lo enseña: un
 * chip que simplemente no responde al tap se lee como que la app está rota.
 */
export function motivoBloqueo(
  categoria: string | null | undefined,
  yaElegidas: (string | null | undefined)[]
): string | null {
  const cats = yaElegidas.filter((c): c is string => !!c);
  if (cats.length >= MAX_ANCLAS) return RAZON_TOPE;

  const cat = categoria ?? "";
  // Un vestido ya viste el cuerpo entero: no convive con un pantalón, en
  // ninguno de los dos órdenes.
  if (cat === "vestido" && cats.includes("bottom")) {
    return "ya elegiste un pantalón — un vestido no va encima";
  }
  if (cat === "bottom" && cats.includes("vestido")) {
    return "ya elegiste un vestido — no lleva pantalón";
  }

  const cupo = CUPO[cat];
  if (cupo && cats.filter((c) => c === cat).length >= cupo) {
    return `ya elegiste ${ETIQUETA[cat] ?? "una prenda así"}`;
  }
  // Categoría desconocida o sin cupo (tops, abrigos, accesorios): pasa.
  return null;
}
