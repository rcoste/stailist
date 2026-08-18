// UN TRAJE ES UNA TARJETA, NO DOS.
//
// De dónde sale, en palabras de Roberto probando el flujo desde cero
// (2026-08-17): "está muy extraño que yo tenga que poner saco de traje gris
// carbón y después tendría que encontrar el pantalón del traje gris carbón…
// debería haber una que fuera trajes y, a la hora de añadir el traje, estás
// añadiendo el combo, no el pantalón".
//
// NO ES SÓLO COMODIDAD. Marcarlos por separado también los rompía: al entrar
// como dos prendas sueltas nada decía que son un traje, y la regla
// `traje-desparejado` del motor castiga justo eso —saco y pantalón de vestir
// del mismo tono—, así que el traje de verdad quedaba prohibido. El lazo
// (`attrs.conjunto`, migración 0137) arregla el fondo; esto arregla la puerta.
//
// EL TRAJE SIGUE SIENDO DOS PRENDAS en el clóset, y eso no se toca: guardarlo
// como una sola hacía que el motor armara looks sin pantalón (decisión vieja y
// medida). Lo que se agrupa es la TARJETA con la que se marca, no la prenda.
// Y es lo correcto también para vestirse: el saco de un traje se usa suelto y
// el pantalón también.
//
// AGRUPA SÓLO CON DOS O MÁS PIEZAS PRESENTES, a propósito. La biblioteca quita
// del catálogo lo que ya tienes: si ya marcaste el saco, del traje sólo queda
// el pantalón, y ese pantalón tiene que verse en "Abajo" como cualquier otro —
// una tarjeta de "traje" con una sola pieza mentiría.

export type PiezaDeCatalogo = {
  id: number;
  name: string;
  category: string;
  attrs: { color_hex?: string; conjunto?: string };
  image_path: string | null;
};

export type TrajeDeCatalogo<T extends PiezaDeCatalogo = PiezaDeCatalogo> = {
  /** El lazo — el mismo valor que llevan las dos piezas en `attrs.conjunto`. */
  conjunto: string;
  /** Cómo se llama el traje en la tarjeta ("Traje gris carbón"). */
  nombre: string;
  /** La pieza que da la cara en la tarjeta: el saco si lo hay. */
  portada: T;
  piezas: T[];
};

/**
 * El nombre del traje a partir del de su saco.
 *
 * "Saco de traje gris carbón" → "Traje gris carbón"; "Saco de smoking negro" →
 * "Smoking negro". Se deriva y no se guarda aparte porque un segundo campo con
 * el nombre del traje es una fuente de verdad más que se desincroniza el día
 * que alguien renombre el arquetipo desde /admin/catalogo.
 */
export function nombreDeTraje(nombreDelSaco: string): string {
  const sinPrefijo = nombreDelSaco.replace(/^saco\s+de\s+/i, "").trim();
  const base = sinPrefijo || nombreDelSaco;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Parte el catálogo en trajes (dos o más piezas atadas) y todo lo demás.
 *
 * `sueltas` conserva el orden original y NO incluye las piezas que se fueron a
 * un traje: si aparecieran en las dos partes, la persona podría marcar el mismo
 * pantalón dos veces y el contador de la pestaña mentiría.
 */
export function agruparTrajes<T extends PiezaDeCatalogo>(
  catalogo: T[]
): { trajes: TrajeDeCatalogo<T>[]; sueltas: T[] } {
  const porConjunto = new Map<string, T[]>();
  for (const p of catalogo) {
    const key = p.attrs?.conjunto;
    if (!key) continue;
    const g = porConjunto.get(key);
    if (g) g.push(p);
    else porConjunto.set(key, [p]);
  }

  const trajes: TrajeDeCatalogo<T>[] = [];
  const enTraje = new Set<number>();
  for (const [conjunto, piezas] of porConjunto) {
    if (piezas.length < 2) continue;
    const portada = piezas.find((p) => p.category === "saco") ?? piezas[0];
    trajes.push({
      conjunto,
      nombre: nombreDeTraje(portada.name),
      portada,
      piezas,
    });
    for (const p of piezas) enTraje.add(p.id);
  }

  return { trajes, sueltas: catalogo.filter((p) => !enTraje.has(p.id)) };
}
