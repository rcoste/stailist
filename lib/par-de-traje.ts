// ¿HAY UN TRAJE ENTRE LO QUE ACABO DE LEER?
//
// De dónde sale: Roberto sube la foto de su traje gris. La visión lo parte en
// "Saco de traje gris oscuro" + "Pantalón de vestir gris oscuro" — y eso está
// BIEN, es una decisión vieja y medida (guardar el traje como una sola prenda
// hacía que el motor armara looks sin pantalón). El problema es lo que pasa
// después: nada dice que ESAS dos piezas van juntas, y la regla
// `traje-desparejado` marca como error justo eso — saco y pantalón de vestir
// del mismo color. O sea que tener un traje de verdad te impedía usarlo.
//
// LA PREGUNTA LA CONTESTA LA PERSONA, y esta función sólo decide cuándo vale la
// pena hacerla. Deducir el traje por parecido sería peor que no hacer nada: un
// blazer con un pantalón del mismo tono que NO son traje es exactamente el
// error que la regla existe para cazar, así que atarlos solos apagaría la regla
// en el único caso donde sirve.

/** Lo mínimo que hace falta de una prenda leída para ver si puede ser traje. */
export type PiezaLeida = {
  id: string;
  categoria?: string;
  formalidad?: string;
  nombre?: string;
  color_hex?: string;
};

/**
 * El par candidato a traje, o null si no hay ninguno.
 *
 * Se pregunta sólo cuando hay EXACTAMENTE un saco y EXACTAMENTE un pantalón
 * formal: con dos sacos la pregunta "¿son traje?" ya no tiene una respuesta,
 * tiene cuatro, y una pregunta ambigua en un flujo de carga se contesta al
 * azar. Ese caso se deja pasar sin preguntar — el lazo se puede poner después
 * desde la ficha; una respuesta al azar, no se puede quitar.
 */
export function parDeTraje(piezas: PiezaLeida[]): { saco: string; pantalon: string } | null {
  const sacos = piezas.filter((p) => (p.categoria ?? "").toLowerCase() === "saco");
  const pantalones = piezas.filter(
    (p) =>
      (p.categoria ?? "").toLowerCase() === "bottom" &&
      // Un traje no lleva jeans. Sin este filtro la pregunta saldría cada vez
      // que alguien suba un blazer y unos pantalones de mezclilla juntos.
      (p.formalidad === "formal" || /de vestir|de traje|formal/i.test(p.nombre ?? ""))
  );
  if (sacos.length !== 1 || pantalones.length !== 1) return null;
  return { saco: sacos[0].id, pantalon: pantalones[0].id };
}
