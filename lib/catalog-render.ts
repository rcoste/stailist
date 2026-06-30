import type { SupabaseClient } from "@supabase/supabase-js";
import { generateArchetypeImage } from "@/lib/archetype-image";
import { catalogStorageKey } from "@/lib/capsule-images";

const BUCKET = "catalog";

export function catalogPublicUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Biblioteca general compartida: genera (si no existe) la imagen ideal de un combo
// tipo+color+género y la registra para que TODOS los usuarios la reusen. Idempotente
// (si ya está en el registro, devuelve esa). La escritura usa el cliente del usuario
// logueado contra el bucket público `catalog` (política acotada, sin service-role).
export async function ensureCatalogRender(
  supabase: SupabaseClient,
  args: {
    tipo: string;
    colorFamilia: string;
    nombre: string;
    categoria: string;
    gender: "hombre" | "mujer" | null;
  }
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const key = catalogStorageKey(args.tipo, args.colorFamilia, args.gender);

  const { data: existing } = await supabase
    .from("catalog_renders")
    .select("path")
    .eq("key", key)
    .maybeSingle();
  if (existing?.path) return { ok: true, url: catalogPublicUrl(supabase, existing.path) };

  // Descripción para el generador (mismo patrón que el render del clóset).
  const lower = args.nombre.toLowerCase();
  const desc =
    args.colorFamilia && !lower.includes(args.colorFamilia.toLowerCase())
      ? `${args.nombre} en color ${args.colorFamilia}`
      : args.nombre;
  const type = args.categoria === "calzado" ? "shoes" : "flat";
  const bytes = await generateArchetypeImage(desc, type, args.gender ?? undefined);
  if (!bytes) return { ok: false, error: "render_fallo" };

  const path = `${key}.jpg`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  // Carrera: si otro usuario subió el mismo combo en paralelo, el objeto ya existe
  // → no es error, seguimos a registrar.
  if (up.error && !/exist|dupl/i.test(up.error.message)) {
    return { ok: false, error: up.error.message };
  }
  await supabase.from("catalog_renders").upsert({ key, path }, { onConflict: "key" });
  return { ok: true, url: catalogPublicUrl(supabase, path) };
}
