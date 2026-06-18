import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClosetItemLite } from "@/lib/capsule";

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
    .select("photo_path, attrs, archetypes(name, image_path)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const list = rows ?? [];
  const photoPaths = list
    .map((r) => r.photo_path as string | null)
    .filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(photoPaths, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  const map: Record<string, string> = {};
  for (const r of list) {
    const arch = r.archetypes as { name?: string; image_path?: string | null } | null;
    const attrs = (r.attrs ?? {}) as { nombre?: string; image_path?: string | null };
    const name = arch?.name ?? attrs.nombre ?? "Prenda";
    const img =
      arch?.image_path ??
      (r.photo_path ? signed.get(r.photo_path as string) : null) ??
      attrs.image_path ??
      null;
    if (img && !map[name]) map[name] = img;
  }
  return map;
}
