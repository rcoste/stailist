import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClosetItemLite } from "@/lib/capsule";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { tipoDePrenda } from "@/lib/engine/vocabulario";

// Distancia RGB entre dos hex (#rrggbb o #rgb). Infinito si alguno no parsea.
export function hexDistance(a: string, b: string): number {
  const parse = (h: string): [number, number, number] | null => {
    let s = h.replace("#", "").trim();
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    if (s.length !== 6) return null;
    const n = parseInt(s, 16);
    return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return Infinity;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

// El TIPO de prenda de un nombre, con LISTA BLANCA (lib/engine/vocabulario.ts).
//
// Antes esto era una lista negra de palabras a ignorar —colores, materiales,
// cortes— y una lista negra de colores siempre va incompleta. Tenía negro,
// blanco, gris, azul, marino, verde, vino, beige… y NO tenía "esmeralda". Así
// que "Camisa de lino esmeralda" y "Suéter esmeralda" coincidían en la palabra
// "esmeralda", el código las daba por el mismo tipo de prenda, y a la camisa le
// prestaba la foto del suéter.
//
// Lo que costaba: 30 prendas de la base muestran la foto de OTRA prenda. Y no es
// solo cosmético — el try-on genera el look con la prenda equivocada y el motor
// cree que tiene una camisa de lino fresca cuando en la imagen hay un suéter de
// lana. Roberto lo cazó en un look para 30°C.
//
// La lista blanca no tiene ese problema: si el nombre no cae en un tipo
// conocido, devuelve null y NO se presta nada — el caller cae al render limpio
// de la prenda real, que es el resultado correcto.

// Presta el flat-lay de un arquetipo del catálogo para una prenda sin foto propia
// (las de "ya la tengo"), para que no salga como un bloque de color. Exige misma
// categoría, color cercano (umbral RGB estricto) Y que el TIPO coincida por nombre
// (jeans→jeans). El tipo es OBLIGATORIO en TODAS las categorías: sin coincidencia
// no presta nada y el caller cae al render limpio de la prenda real (evita poner
// una t-shirt negra por un suéter negro, o un cinturón por un reloj). null si no
// hay buen match.
export async function borrowArchetypeImage(
  supabase: SupabaseClient,
  category: string,
  targetHex: string,
  gender: "hombre" | "mujer" | null,
  nameHint = ""
): Promise<string | null> {
  const { data } = await supabase
    .from("archetypes")
    .select("name, image_path, attrs, segment")
    .eq("category", category)
    // Una prenda retirada tampoco presta su foto: se retiró justamente porque
    // la foto no está bien (migración 0137).
    .is("deleted_at", null)
    .in("segment", ["unisex", gender ?? "hombre"]);
  if (!data?.length) return null;

  // El tipo de la prenda que busca imagen. Sin tipo reconocible NO se presta
  // nada: mejor el render limpio de la prenda real que la foto de otra cosa.
  const quiero = tipoDePrenda(nameHint)?.tipo ?? null;
  if (!quiero) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const a of data) {
    const img = a.image_path as string | null;
    const hex = (a.attrs as { color_hex?: string } | null)?.color_hex;
    if (!img || !hex) continue;
    const d = hexDistance(targetHex, hex);
    if (d >= 40) continue; // el color debe parecerse
    // MISMO tipo canónico, no "parecido": un suéter no cubre una camisa aunque
    // los dos sean esmeralda. Entre los del tipo correcto gana el color más
    // cercano.
    if (tipoDePrenda(String(a.name ?? ""))?.tipo !== quiero) continue;
    if (d < bestDist) {
      bestDist = d;
      best = img;
    }
  }
  return best;
}

// Carga el clóset del usuario aplanado para el matching de la cápsula: nombre,
// categoría, color y formalidad + los atributos ricos (v25: hex, temporada,
// material, patrón, corte, 2º color) que el match usa para distinguir prendas
// idénticas en el texto viejo. Resuelve categoría/nombre del arquetipo si lo
// hay; los ricos siempre salen de item.attrs (ahí los escribió el backfill v21
// y el análisis de visión, no el arquetipo). Mismo criterio que la pantalla.
export async function loadClosetLite(
  supabase: SupabaseClient,
  userId: string
): Promise<ClosetItemLite[]> {
  const { data: rows } = await supabase
    .from("items")
    .select("id, attrs, archetypes(name, category)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  return (rows ?? []).map((r) => {
    const arch = r.archetypes as { name?: string; category?: string } | null;
    const attrs = (r.attrs ?? {}) as {
      nombre?: string;
      color?: string;
      categoria?: string;
      tipo?: string;
      formalidad?: string;
      color_hex?: string;
      temporada?: string;
      material?: string;
      patron?: string;
      corte?: string;
      color_secundario?: string;
      contexto?: string;
    };
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      category: arch?.category ?? attrs.categoria ?? attrs.tipo ?? "accesorio",
      color: attrs.color ?? "",
      formalidad: attrs.formalidad ?? "casual",
      color_hex: attrs.color_hex ?? null,
      temporada: attrs.temporada ?? null,
      material: attrs.material ?? null,
      patron: attrs.patron ?? null,
      corte: attrs.corte ?? null,
      color_secundario: attrs.color_secundario ?? null,
      contexto: attrs.contexto ?? null,
    };
  });
}

// Mapa nombre-de-prenda → URL de imagen (arquetipo público o foto propia firmada).
// Lo usa la pantalla de cápsula para mostrar la imagen de lo que ya tienes; el
// match devuelve el NOMBRE de la prenda que cubre, así que mapeamos por nombre.
export async function loadClosetImageMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, string>> {
  const { data: rows } = await supabase
    .from("items")
    .select("photo_path, render_status, render_path, attrs, archetypes(name, image_path)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const list = rows ?? [];
  // Firma fotos crudas Y renders limpios (ambos en el bucket privado 'prendas').
  // Sin el render, las prendas que el usuario describió (sin foto) salían vacías
  // en el viaje aunque ya tuvieran su imagen generada.
  const privatePaths = Array.from(
    new Set(
      list
        .flatMap((r) => [r.photo_path as string | null, r.render_path as string | null])
        .filter((p): p is string => !!p)
    )
  );
  const signed = new Map<string, string>();
  if (privatePaths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(privatePaths, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  const map: Record<string, string> = {};
  for (const r of list) {
    const arch = r.archetypes as { name?: string; image_path?: string | null } | null;
    const attrs = (r.attrs ?? {}) as { nombre?: string };
    const name = arch?.name ?? attrs.nombre ?? "Prenda";
    // Resolver único (arquetipo → render limpio → foto cruda → prestada).
    const img = itemImageUrlSync(r as ItemImageRow, (p) => signed.get(p));
    if (img && !map[name]) map[name] = img;
  }
  return map;
}

// Mapa nombre → id del clóset, incluyendo prendas SIN imagen (al revés de
// loadClosetImageMap, que solo lista las que ya tienen imagen). Lo usa la maleta
// para el render bajo demanda: cuando un look sugiere una prenda sin imagen,
// necesitamos su id para pedir el render al tocarla.
export async function loadClosetNameToId(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, string>> {
  const { data: rows } = await supabase
    .from("items")
    .select("id, attrs, archetypes(name)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const map: Record<string, string> = {};
  for (const r of rows ?? []) {
    const arch = r.archetypes as { name?: string } | null;
    const attrs = (r.attrs ?? {}) as { nombre?: string };
    const name = arch?.name ?? attrs.nombre ?? "Prenda";
    if (!map[name]) map[name] = r.id as string;
  }
  return map;
}
