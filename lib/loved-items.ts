import type { SupabaseClient } from "@supabase/supabase-js";

// "Prendas queridas": señal derivada (cero trabajo del usuario) — cuántas veces
// aparece cada prenda en outfits FAVORITOS o USADOS ("me lo puse"). Se usa SOLO
// para ordenar listados (clóset, picker de ancla): las queridas a la mano.
// A PROPÓSITO no entra al motor — sesgaría la generación hacia las favoritas y
// se auto-reforzaría (favorita → más sugerida → más favorita).
export async function loadLovedCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number>> {
  const [{ data: outfits }, { data: wornEvents }] = await Promise.all([
    supabase
      .from("outfits")
      .select("id, item_ids, favorited_at")
      .eq("user_id", userId),
    supabase
      .from("events")
      .select("outfit_id")
      .eq("user_id", userId)
      .eq("type", "worn"),
  ]);
  const worn = new Set(
    (wornEvents ?? []).map((e) => e.outfit_id as string | null).filter(Boolean)
  );
  const counts = new Map<string, number>();
  for (const o of outfits ?? []) {
    const loved = !!o.favorited_at || worn.has(o.id as string);
    if (!loved) continue;
    for (const id of (o.item_ids as string[] | null) ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

// Ordena una lista de prendas con las queridas primero (por cuántas veces las
// has favoriteado/usado), conservando el orden original entre iguales.
export function sortLovedFirst<T extends { id?: string | null }>(
  items: T[],
  counts: Map<string, number>
): T[] {
  if (counts.size === 0) return items;
  return items
    .map((it, i) => ({ it, i, n: it.id ? counts.get(it.id) ?? 0 : 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.it);
}
