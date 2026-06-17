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
