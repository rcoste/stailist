import type { SupabaseClient } from "@supabase/supabase-js";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";

// La card del último look (zona 1 del home, bajo el CTA). Es el acceso fijo a lo
// último que el motor armó — cubre lo que antes hacían el CTA "ver mi look" y
// los chips de planeados, que murieron con el hero fijo "¿qué look armamos?".
//
// Dos variantes que decide el DATO, no una preferencia: con try-on generado va
// el retrato (el avatar vistiendo el look); sin él, la tira de las prendas.
export type UltimoLook = {
  id: string;
  nombre: string;
  ocasion: string; // clave de occasion ("diario") — el cliente la traduce
  fecha: string | null; // YYYY-MM-DD del look (planned_for si se planeó)
  creadoEn: string; // ISO. "creado hoy" se decide en el CLIENTE: el server es UTC
  retrato: string | null; // try-on firmado — la variante con avatar
  prendas: string[]; // imágenes de prendas firmadas — la variante sin retrato
};

// La tira del canvas trae 5 tiles; más se vuelven confeti a 390px.
const MAX_TILES = 5;

/** Lo mínimo que la regla necesita de una fila de `outfits`. */
export type MarcasDeLook = {
  is_look_of_day?: boolean | null;
  look_date?: string | null;
  planned_for?: string | null;
  favorited_at?: string | null;
  tryon_path?: string | null;
};

/**
 * De las filas más recientes (ya ordenadas por created_at desc), la primera
 * que la persona hizo suya; si ninguna, la más reciente. Pura, para probarla
 * con el trío del wow tal cual salió el 08-09.
 */
export function elegirUltimoLook<T extends MarcasDeLook>(filas: T[]): T | null {
  const esTuyo = (o: MarcasDeLook) =>
    o.is_look_of_day === true ||
    o.look_date != null || // el wow marca así al elegido (sin is_look_of_day, ver outfit-actions)
    o.planned_for != null ||
    o.favorited_at != null ||
    o.tryon_path != null;
  return filas.find(esTuyo) ?? filas[0] ?? null;
}

export async function loadUltimoLook(
  supabase: SupabaseClient,
  userId: string
): Promise<UltimoLook | null> {
  // SOLO `daily`, y la lista blanca es a propósito (un `neq` deja pasar todo lo
  // que se invente después). Las otras tres fuentes no son "el último look que
  // te armé":
  //   · espejo  → lo que YA traías puesto, no una propuesta.
  //   · viaje / capsula → filas fantasma que existen solo para cachear un
  //     try-on; sus dueños las marcan `favorited_at: null` justamente para que
  //     NO salgan en Historial. Colarlas aquí las volvería el titular del home.
  const { data } = await supabase
    .from("outfits")
    .select(
      "id, title, occasion, planned_for, look_date, created_at, tryon_path, item_ids, is_look_of_day, favorited_at"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("source", "daily")
    // gen_status null = look completo de antes de la generación en background.
    .or("gen_status.is.null,gen_status.eq.ready")
    .order("created_at", { ascending: false })
    .limit(5);

  // EL ÚLTIMO LOOK ES EL QUE HICISTE TUYO, no el último que se generó. El wow
  // genera tres en 17 segundos y la persona elige uno; Hoy genera alternos.
  // Ordenar por created_at a secas coronaba al último del trío: Roberto eligió
  // "Sutileza en Burdeos" y el home le enseñó "Negro con Actitud" como "último
  // look · creado hoy" (08-09). Un look es tuyo si es el look del día (Hoy lo
  // marca al generar), si el wow lo marcó al elegirlo (look_date), si lo
  // planeaste para una fecha, si lo guardaste en favoritos o si ya te lo
  // probaste puesto. Lo que no tiene ninguna de esas
  // marcas es una alternativa que nunca elegiste. Si ninguno califica (looks
  // viejos de antes de esta marca), el más reciente, como siempre.
  type Fila = NonNullable<typeof data>[number];
  const look = elegirUltimoLook((data ?? []) as (Fila & MarcasDeLook)[]);
  if (!look) return null;

  const base = {
    id: look.id as string,
    nombre: (look.title as string | null) ?? "tu look",
    ocasion: (look.occasion as string | null) ?? "diario",
    fecha:
      (look.planned_for as string | null) ??
      (look.look_date as string | null)?.slice(0, 10) ??
      null,
    creadoEn: look.created_at as string,
  };

  // Con retrato no hace falta cargar prendas: la variante es una u otra.
  if (look.tryon_path) {
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls([look.tryon_path as string], 3600);
    const url = signed?.[0]?.signedUrl ?? null;
    if (url) return { ...base, retrato: url, prendas: [] };
  }

  const itemIds = ((look.item_ids as string[]) ?? []).slice(0, MAX_TILES);
  if (itemIds.length === 0) return { ...base, retrato: null, prendas: [] };

  // Misma resolución de imagen que el clóset: arquetipo, render o foto propia.
  // Filtra borradas: esta card es la portada del home, y enseñar ahí una prenda
  // que la persona ya borró de su clóset la hace dudar de todo lo demás.
  const { data: items } = await supabase
    .from("items")
    .select("id, photo_path, render_status, render_path, attrs, archetypes(image_path)")
    .in("id", itemIds)
    .is("deleted_at", null);

  const paths = (items ?? [])
    .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
    .filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from("prendas")
      .createSignedUrls(Array.from(new Set(paths)), 3600);
    urls?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  // En el ORDEN del look (item_ids es top→bottom del motor), no el de la query.
  const byId = new Map(
    (items ?? []).map((i) => [
      i.id as string,
      itemImageUrlSync(i as ItemImageRow, (p) => signed.get(p)),
    ])
  );
  const prendas = itemIds
    .map((id) => byId.get(id) ?? null)
    .filter((u): u is string => !!u);

  return { ...base, retrato: null, prendas };
}
