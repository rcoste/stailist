"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateArchetypeImage, type ImageType } from "@/lib/archetype-image";

// Edita los atributos de un básico (no la imagen).
export async function updateArchetypeAttrs(
  id: number,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const attrs = {
    color: String(formData.get("color") ?? "").trim(),
    color_hex: String(formData.get("color_hex") ?? "").trim(),
    formalidad: String(formData.get("formalidad") ?? "").trim(),
    temporada: String(formData.get("temporada") ?? "").trim(),
  };

  if (!name || !category || !segment) {
    return { ok: false, error: "Nombre, categoría y segmento son obligatorios." };
  }

  const { error } = await supabase
    .from("archetypes")
    .update({ name, category, segment, sort_order, attrs })
    .eq("id", id);
  if (error) return { ok: false, error: "No pude guardar." };

  revalidatePath(`/admin/catalogo/${id}`);
  revalidatePath("/admin/catalogo");
  return { ok: true };
}

// Regenera la imagen con IA y la sube a Storage (bucket público). Actualiza
// image_path a la URL pública. `desc` es la descripción en inglés para Gemini.
export async function regenerateArchetypeImage(
  id: number,
  slug: string,
  desc: string,
  type: ImageType
): Promise<{ ok: boolean; image?: string; error?: string }> {
  await requireAdmin();
  if (!desc.trim()) return { ok: false, error: "Escribe una descripción." };

  const bytes = await generateArchetypeImage(desc, type);
  if (!bytes) return { ok: false, error: "La IA no devolvió imagen. Reintenta." };

  const supabase = await createClient();
  // Versionamos por timestamp en el nombre para romper la caché del CDN.
  const path = `${slug}-${Date.now()}.jpg`;
  const up = await supabase.storage
    .from("archetypes")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (up.error) return { ok: false, error: "No pude guardar la imagen." };

  const { data: pub } = supabase.storage.from("archetypes").getPublicUrl(path);
  const image_path = pub.publicUrl;

  const { error } = await supabase
    .from("archetypes")
    .update({ image_path })
    .eq("id", id);
  if (error) return { ok: false, error: "Subí la imagen pero no pude enlazarla." };

  revalidatePath(`/admin/catalogo/${id}`);
  revalidatePath("/admin/catalogo");
  return { ok: true, image: image_path };
}
