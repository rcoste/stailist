// FUENTE ÚNICA DE VERDAD de "¿qué imagen usa una prenda del clóset?".
//
// La imagen de un item puede vivir en 4 lugares según cómo entró: arquetipo del
// catálogo, render limpio (generado por IA), foto propia, o prestada del catálogo
// ("ya lo tengo"). El ORDEN de prioridad para elegir cuál usar estaba COPIADO a
// mano en 6 pantallas. Dos copias quedaron incompletas (el try-on y el pasaporte
// omitían render/prestada) → esas prendas salían sin imagen y el avatar inventaba
// una t-shirt blanca. Centralizar el orden aquí mata esa clase de bug: agregar una
// fuente nueva = cambiar SOLO este archivo y todas las pantallas se enteran.

export const ITEM_IMAGE_SELECT =
  "photo_path, render_status, render_path, attrs, archetypes(name, image_path)";

export type ItemImageRow = {
  photo_path?: string | null;
  render_status?: string | null;
  render_path?: string | null;
  attrs?: { image_path?: string | null } | null;
  archetypes?: { name?: string | null; image_path?: string | null } | null;
};

export type ItemImagePick =
  | { kind: "public"; path: string } // arquetipo o prestada: ruta pública (sirve el origin)
  | { kind: "private"; path: string } // render limpio o foto: bucket privado, hay que firmar
  | null;

// ORDEN CANÓNICO: arquetipo → render limpio → foto cruda → prestada.
export function pickItemImage(item: ItemImageRow): ItemImagePick {
  const arch = item.archetypes?.image_path;
  if (arch) return { kind: "public", path: arch };
  if (item.render_status === "done" && item.render_path)
    return { kind: "private", path: item.render_path };
  if (item.photo_path) return { kind: "private", path: item.photo_path };
  const borrowed = item.attrs?.image_path;
  if (borrowed) return { kind: "public", path: borrowed };
  return null;
}

// Rutas privadas candidatas de un item — para firmarlas en lote (una sola petición
// a Storage) antes de resolver. Las pantallas que firman en lote usan esto.
export function itemPrivatePaths(item: ItemImageRow): string[] {
  const out: string[] = [];
  if (item.render_status === "done" && item.render_path) out.push(item.render_path);
  if (item.photo_path) out.push(item.photo_path);
  return out;
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
