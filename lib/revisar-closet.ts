import { createClient } from "@/lib/supabase/server";
import {
  ITEM_IMAGE_SELECT,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";

// El clóset, para confirmar prenda por prenda que de verdad existe.
//
// DE DÓNDE SALE
// Roberto, juzgando 40 pares de outfits: "yo no tengo ese suéter esmeralda, ni
// la camisa de lino manga corta esmeralda, ni la overshirt marino manga corta".
// Las tres estaban en su clóset desde junio y julio, y entre las tres salieron
// en más de un tercio de los looks.
//
// POR QUÉ SE COLARON, y NO es lo que primero pensé
// Al principio creí que era un bug de origen: 308 prendas de la base dicen venir
// de una foto y no tienen foto guardada. No es un bug — son dos caminos:
//   foto de UNA prenda      → se guarda la foto
//   foto con VARIAS prendas → cada prenda se queda con su render limpio
// La original no puede ser "la foto de esta prenda" cuando trae cinco.
//
// El problema real es el otro: el análisis de esa foto múltiple puede leer una
// prenda que no está, y una vez guardada NO HAY FORMA de que la persona la
// detecte salvo viéndola aparecer en un outfit. Que es exactamente lo que pasó,
// tres veces, a lo largo de dos meses.
//
// PRIORIDAD POR USO, no alfabética: la prenda que sale en el 15% de los looks y
// no existe hace mucho más daño que una que nunca sale. Se pregunta primero por
// las que más aparecen.

export type PrendaRevisar = {
  id: string;
  url: string | null;
  nombre: string;
  categoria: string | null;
  color: string | null;
  hex: string | null;
  material: string | null;
  /** Cuántos outfits guardados la usan. Ordena la lista. */
  usos: number;
  /** De dónde vino, en palabras. */
  origen: string;
};

type Cruda = ItemImageRow & {
  id: string;
  source: string | null;
  photo_path: string | null;
  archetype_id: string | null;
  attrs: Record<string, unknown> | null;
};

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function origenDe(i: Cruda): string {
  if (i.archetype_id) return "del checklist de básicos";
  if (i.photo_path) return "de una foto tuya";
  return "de una foto con varias prendas";
}

/**
 * Las prendas que faltan por confirmar, las más usadas primero.
 *
 * Se excluyen las que ya confirmaste (`attrs.existe === true`) y las del
 * checklist de básicos: ésas las elegiste tú de una lista, no las leyó un
 * modelo de una foto, así que no hay nada que verificar.
 */
export async function porRevisar(userId: string): Promise<PrendaRevisar[]> {
  const supabase = await createClient();

  const [itemsRes, outfitsRes] = await Promise.all([
    supabase
      .from("items")
      .select(`id, source, photo_path, archetype_id, attrs, ${ITEM_IMAGE_SELECT}`)
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("outfits")
      .select("item_ids")
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);

  const filas = (itemsRes.data ?? []) as unknown as Cruda[];

  const usos = new Map<string, number>();
  for (const o of outfitsRes.data ?? []) {
    for (const id of (o.item_ids as string[]) ?? []) {
      usos.set(id, (usos.get(id) ?? 0) + 1);
    }
  }

  const pendientes = filas.filter(
    (i) => !i.archetype_id && i.attrs?.existe !== true
  );
  if (!pendientes.length) return [];

  const aFirmar = [...new Set(pendientes.flatMap((f) => itemPrivatePaths(f)))];
  const firmadas = new Map<string, string>();
  if (aFirmar.length) {
    const { data: urls } = await supabase.storage
      .from("prendas")
      .createSignedUrls(aFirmar, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
  }

  return pendientes
    .map((i) => ({
      id: i.id,
      url: itemImageUrlSync(i, (p) => firmadas.get(p)),
      nombre: txt(i.attrs?.nombre) ?? "(sin nombre)",
      categoria: txt(i.attrs?.categoria),
      color: txt(i.attrs?.color),
      hex: txt(i.attrs?.color_hex),
      material: txt(i.attrs?.material),
      usos: usos.get(i.id) ?? 0,
      origen: origenDe(i),
    }))
    .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre));
}
