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
 * El par candidato a traje DENTRO DE UN GRUPO, o null si no hay ninguno.
 *
 * Exige exactamente un saco y exactamente un pantalón formal: con dos sacos en
 * el mismo grupo la pregunta "¿son traje?" ya no tiene una respuesta, tiene
 * cuatro, y una pregunta ambigua en un flujo de carga se contesta al azar. Ese
 * caso se deja pasar; el lazo se puede poner después desde la ficha, y una
 * respuesta al azar no se puede quitar.
 *
 * OJO CON EL "GRUPO": llamar a esto con la tanda entera es lo que rompió el
 * caso real de Roberto — ver paresDeTraje abajo.
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

/** Una pieza leída, sabiendo de QUÉ FOTO salió. */
export type PiezaConFoto = PiezaLeida & { foto: string };

/**
 * Los pares candidatos de una tanda: uno por foto, no uno por tanda.
 *
 * EL BUG QUE ARREGLA, reportado por Roberto y diagnosticado por él mismo:
 * subió en la misma tanda una foto con una chamarra de cuero, otra con su
 * esmoquin y otra con su traje gris cruzado, y **no le preguntó nada**. Su
 * sospecha —"no sé si el bug fue que se cargaron dos cosas con conjunto en la
 * misma tanda"— era exactamente eso.
 *
 * La causa es una frase que escribí yo: `parDeTraje` corría sobre la tanda
 * COMPLETA, veía dos sacos (el del esmoquin y el gris), decidía que la pregunta
 * era ambigua y se callaba. Con lo cual, entre más trajes subes de una vez,
 * menos te pregunta — justo al revés de lo que debería.
 *
 * Y la ambigüedad que yo temía nunca existió: cada prenda sabe de qué foto
 * salió, y **un traje se lleva puesto en UNA foto**. Dentro de su foto, el saco
 * del esmoquin y el pantalón del esmoquin son el único par posible. Agrupar por
 * foto no relaja la guarda: la aplica donde de verdad significa algo. Dos sacos
 * en la MISMA foto siguen sin preguntarse, que es el caso genuinamente ambiguo.
 *
 * El orden de salida sigue el de las piezas, para que las casillas aparezcan en
 * el mismo orden en que se ven las prendas.
 */
export function paresDeTraje(
  piezas: PiezaConFoto[]
): { foto: string; saco: string; pantalon: string }[] {
  const porFoto = new Map<string, PiezaConFoto[]>();
  for (const p of piezas) {
    const g = porFoto.get(p.foto);
    if (g) g.push(p);
    else porFoto.set(p.foto, [p]);
  }
  const out: { foto: string; saco: string; pantalon: string }[] = [];
  for (const [foto, grupo] of porFoto) {
    const par = parDeTraje(grupo);
    if (par) out.push({ foto, ...par });
  }
  return out;
}
