import type { SupabaseClient } from "@supabase/supabase-js";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { loadLovedCounts, sortLovedFirst } from "@/lib/loved-items";
import type { ClosetPick } from "@/components/weather-picker";

// Clóset como "picks" para los pickers de ancla (Hoy: "¿algo que te quieras
// poner hoy?"; Viaje: "¿algo que quieras llevar sí o sí?"). Misma resolución de
// imagen que el clóset (arquetipo / render / foto propia, con URLs firmadas) y
// con las QUERIDAS primero (outfits favoritos/usados) — orden solo visual.
export async function loadClosetPicks(
  supabase: SupabaseClient,
  userId: string
): Promise<ClosetPick[]> {
  const [{ data: closetRows }, loved] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, photo_path, render_status, render_path, attrs, archetypes(name, image_path, category)"
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    loadLovedCounts(supabase, userId),
  ]);

  const closetPaths = (closetRows ?? [])
    .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
    .filter((p): p is string => !!p);
  const closetSigned = new Map<string, string>();
  if (closetPaths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(Array.from(new Set(closetPaths)), 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) closetSigned.set(s.path, s.signedUrl);
    });
  }

  return sortLovedFirst(closetRows ?? [], loved).map((i) => {
    const arch = i.archetypes as {
      name?: string;
      image_path?: string | null;
      category?: string | null;
    } | null;
    const attrs = (i.attrs ?? {}) as {
      nombre?: string;
      color_hex?: string;
      image_path?: string | null;
      category?: string | null;
    };
    return {
      id: i.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      swatch: attrs.color_hex ?? "#E5E1DD",
      imagen: itemImageUrlSync(i as ItemImageRow, (p) => closetSigned.get(p)),
      category: arch?.category ?? attrs.category ?? "otros",
    };
  });
}
