// FUENTE ÚNICA DE VERDAD de "¿qué imagen usa una prenda del clóset?".
//
// La imagen de un item puede vivir en 4 lugares según cómo entró: arquetipo del
// catálogo, render limpio (generado por IA), foto propia, o prestada del catálogo
// ("ya lo tengo"). El ORDEN de prioridad para elegir cuál usar estaba COPIADO a
// mano en 6 pantallas. Dos copias quedaron incompletas (el try-on y el pasaporte
// omitían render/prestada) → esas prendas salían sin imagen y el avatar inventaba
// una t-shirt blanca. Centralizar el orden aquí mata esa clase de bug: agregar una
// fuente nueva = cambiar SOLO este archivo y todas las pantallas se enteran.

// `category` del arquetipo va aquí aunque este archivo sea de imágenes: es el
// mismo join y el dato hacía falta. Las prendas del catálogo NO copian la
// categoría a sus attrs (67% de las 967 prendas de la base la tienen vacía), así
// que sin esto el motor no puede saber si algo es un top, un pantalón o un saco
// — lo adivinaba del nombre. Ver categoriaDeItem.
export const ITEM_IMAGE_SELECT =
  "photo_path, render_status, render_path, attrs, certeza, archetypes(name, image_path, category, attrs)";

export type ItemImageRow = {
  /** Cuánto sabemos de verdad de esta prenda (migración 0124). */
  certeza?: "exacta" | "generica" | "asumida" | null;
  photo_path?: string | null;
  render_status?: string | null;
  render_path?: string | null;
  attrs?: {
    image_path?: string | null;
    categoria?: string | null;
    /** "es la misma": tu foto real manda sobre el dibujo de catálogo. */
    preferir_foto?: boolean | null;
  } | null;
  archetypes?: {
    name?: string | null;
    image_path?: string | null;
    category?: string | null;
    attrs?: { subtipo?: string | null } | null;
  } | null;
};

/**
 * La categoría de una prenda: top, bottom, calzado, abrigo, saco, accesorio…
 *
 * POR QUÉ HACE FALTA UNA FUNCIÓN Y NO UN CAMPO
 * El dato vive en DOS lugares según de dónde vino la prenda. Las que la persona
 * describió o fotografió lo guardan en `attrs.categoria`; las que tomó del
 * catálogo lo tienen en el arquetipo y NUNCA se copia a la prenda — por eso 648
 * de las 967 prendas de la base parecen no tener categoría cuando en realidad sí
 * se sabe cuál es.
 *
 * Lo que costaba: el motor no recibía la categoría de NINGUNA prenda (describeItem
 * no la mandaba) y la deducía del nombre. A un ítem llamado "Traje marino de lana"
 * —que en la base es categoría `saco`— lo leyó como traje completo y armó el look
 * SIN pantalón, rompiendo su propia regla de "un bottom siempre". Roberto lo cazó
 * viendo el render, donde el generador de imágenes había inventado un pantalón gris.
 *
 * Prioridad: lo que la prenda declara gana sobre lo que hereda del catálogo —
 * si alguien editó la categoría de su prenda, esa es la buena.
 */
export function categoriaDeItem(item: ItemImageRow): string | null {
  return item.attrs?.categoria?.trim() || item.archetypes?.category?.trim() || null;
}

/**
 * El tipo FINO de la prenda: derby/oxford, cruzado/sencillo, con pinzas.
 *
 * Mismo caso que la categoría y por eso se resuelve igual: las prendas del
 * catálogo lo heredan del arquetipo y NUNCA se copia a la prenda. Son 645 de
 * las 953 de la base, salidas de sólo 176 arquetipos distintos — copiar el dato
 * a cada prenda sería leer la misma imagen 645 veces y, peor, dejaría 645
 * copias que envejecen si alguien corrige el arquetipo.
 *
 * Prioridad: lo que la prenda declara gana sobre lo que hereda. Si la persona
 * corrigió el subtipo de SU prenda, ese es el bueno.
 */
export function subtipoDeItem(item: ItemImageRow): string | null {
  return (
    (item.attrs as { subtipo?: string } | null)?.subtipo?.trim() ||
    item.archetypes?.attrs?.subtipo?.trim() ||
    null
  );
}

export type ItemImagePick =
  | { kind: "public"; path: string } // arquetipo o prestada: ruta pública (sirve el origin)
  | { kind: "private"; path: string } // render limpio o foto: bucket privado, hay que firmar
  | null;

// ORDEN CANÓNICO: arquetipo → render limpio → foto cruda → prestada.
export function pickItemImage(item: ItemImageRow): ItemImagePick {
  // TU FOTO MANDA SOBRE EL DIBUJO, si dijiste "es la misma".
  //
  // Del handoff de carga: al resolver un duplicado con "sí, es la misma", la
  // foto real de la persona sustituye al dibujo de catálogo. La forma obvia
  // sería borrar el vínculo al arquetipo — y es justo la que no se hizo: eso es
  // irreversible, y un "es la misma" mal picado dejaría la prenda sin su ficha
  // de catálogo para siempre.
  //
  // En vez de eso, una bandera invierte la prioridad. No se borra NADA:
  // archetype_id sigue ahí, y deshacer es quitar la bandera.
  if (item.attrs?.preferir_foto && item.photo_path)
    return { kind: "private", path: item.photo_path };
  const arch = item.archetypes?.image_path;
  if (arch) return { kind: "public", path: arch };
  if (item.render_status === "done" && item.render_path)
    return { kind: "private", path: item.render_path };
  if (item.photo_path) return { kind: "private", path: item.photo_path };
  const borrowed = item.attrs?.image_path;
  if (borrowed) return { kind: "public", path: borrowed };
  return null;
}

// Rutas privadas de un item — para firmarlas en lote (una sola petición a
// Storage) antes de resolver. Las pantallas que firman en lote usan esto.
//
// ES EXACTAMENTE LA QUE pickItemImage VA A ELEGIR, ni una más. Antes devolvía
// las dos candidatas, y mientras sólo 5 prendas en toda la base tenían foto
// original eso no costaba nada. Desde hoy TODA prenda que entra por el carrete
// guarda las dos —render y foto— así que firmar las dos significa pedirle a
// Storage el doble de URLs por cada clóset que se abre, y la mitad son de
// imágenes que nadie va a mostrar (el render siempre gana sobre la foto).
//
// Se deriva de pickItemImage en vez de repetir su orden: si mañana cambia la
// preferencia, esto no se puede desincronizar.
export function itemPrivatePaths(item: ItemImageRow): string[] {
  const pick = pickItemImage(item);
  return pick?.kind === "private" ? [pick.path] : [];
}

// Resuelve la URL final con un firmador SÍNCRONO (un Map pre-firmado en lote).
// publicPrefix: "" para usar la ruta tal cual (<Image src>), o el origin para
// fetch desde el server. Devuelve null si la prenda no tiene ninguna imagen.
export function itemImageUrlSync(
  item: ItemImageRow,
  signed: (path: string) => string | null | undefined,
  publicPrefix = ""
): string | null {
  const pick = pickItemImage(item);
  if (!pick) return null;
  if (pick.kind === "public") return publicPrefix + pick.path;
  return signed(pick.path) ?? null;
}

/**
 * Las filas del clóset como las quiere el motor, con la categoría YA resuelta.
 *
 * Es el puente que faltaba: la prenda del catálogo hereda su categoría del
 * arquetipo y nadie la copiaba a `attrs`, así que el motor recibía 2 de cada 3
 * prendas sin saber qué eran. Se hace al leer y no con un backfill porque el
 * dato de origen puede cambiar (alguien reclasifica un arquetipo) y una copia
 * quedaría vieja en silencio.
 */
export function conCategoria<T extends ItemImageRow>(rows: T[]): T[] {
  return rows.map((r) => {
    const cat = categoriaDeItem(r);
    // El SUBTIPO se completa igual y por lo mismo (v38): el tipo fino vive en
    // el arquetipo y no se copia a la prenda. Sin esto el motor no vería
    // "derby" ni "cruzado" en 645 de las 953 prendas de la base — que es
    // exactamente el hueco que el subtipo vino a tapar.
    const sub = subtipoDeItem(r);
    if (!cat && !sub) return r;
    return {
      ...r,
      attrs: {
        ...(r.attrs ?? {}),
        ...(cat ? { categoria: cat } : {}),
        ...(sub ? { subtipo: sub } : {}),
      },
    } as T;
  });
}
