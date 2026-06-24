import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClosetItemLite } from "@/lib/capsule";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";

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

// Palabras que NO sirven para identificar el TIPO de prenda (colores, materiales,
// cortes) — se filtran del hint para quedarnos con el tipo ("jeans", "reloj").
const TYPE_STOPWORDS = new Set([
  "negro", "negra", "negros", "blanco", "blanca", "gris", "azul", "marino", "cafe",
  "verde", "vino", "beige", "camel", "crema", "rojo", "rosa", "oliva", "mostaza",
  "lana", "algodon", "seda", "piel", "ante", "mezclilla", "cashmere", "merino",
  "corte", "recto", "estructurado", "oxford", "claro", "oscuro", "del", "con", "las",
  "los", "una", "para",
]);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const typeTokens = (s: string) =>
  norm(s)
    .split(/[\s-]+/)
    .filter((w) => w.length > 3 && !TYPE_STOPWORDS.has(w));

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
    .in("segment", ["unisex", gender ?? "hombre"]);
  if (!data?.length) return null;

  const want = new Set(typeTokens(nameHint));
  let best: string | null = null;
  let bestOverlap = -1;
  let bestDist = Infinity;
  for (const a of data) {
    const img = a.image_path as string | null;
    const hex = (a.attrs as { color_hex?: string } | null)?.color_hex;
    if (!img || !hex) continue;
    const d = hexDistance(targetHex, hex);
    if (d >= 40) continue; // el color debe parecerse
    const at = new Set(typeTokens(String(a.name ?? "")));
    let overlap = 0;
    for (const t of want) if (at.has(t)) overlap++;
    // Tipo OBLIGATORIO: sin coincidencia de nombre NO se presta — ni en tops
    // (suéter ≠ t-shirt) ni en accesorios (cinturón ≠ reloj). Mejor render limpio.
    if (overlap === 0) continue;
    // Prefiere mayor coincidencia de tipo; a igualdad, el color más cercano.
    if (overlap > bestOverlap || (overlap === bestOverlap && d < bestDist)) {
      bestOverlap = overlap;
      bestDist = d;
      best = img;
    }
  }
  return best;
}

// Carga el clóset del usuario aplanado a {id, nombre, category, color, formalidad}
// para el matching de la cápsula. Resuelve categoría/nombre del arquetipo si lo
// hay, o de attrs (fotos propias). Mismo criterio que la pantalla del clóset.
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
    };
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      category: arch?.category ?? attrs.categoria ?? attrs.tipo ?? "accesorio",
      color: attrs.color ?? "",
      formalidad: attrs.formalidad ?? "casual",
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
