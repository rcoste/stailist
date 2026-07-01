"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Source = "upload" | "capsule" | "gap";

// Inserta un candidato al Wishlist (la imagen ya se subió al bucket privado).
export async function addWishlistItem(input: {
  imagePath: string;
  colorHex: string | null;
  verdict: string | null;
  source?: Source;
  name?: string | null;
}): Promise<{ ok: boolean; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  // La imagen debe vivir en la carpeta del propio usuario.
  if (!input.imagePath.startsWith(`${user.id}/`)) return { ok: false };

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      user_id: user.id,
      image_path: input.imagePath,
      color_hex: input.colorHex,
      verdict: input.verdict,
      source: input.source ?? "upload",
      name: input.name ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[wishlist] insert falló:", error.message);
    return { ok: false };
  }
  return { ok: true, id: data.id as string };
}

// Toggle in-situ desde la cápsula: una prenda que TE FALTA se manda/quita de la
// wishlist sin sacarla de su sección. Sin foto propia — guarda la referencia
// pública (render de catálogo) + el porqué. Deduplica por `capsule_key` (faltaKey).
export async function toggleWishlistFromCapsule(input: {
  capsuleKey: string;
  name: string;
  colorHex: string | null;
  imageUrl: string | null;
  porque: string | null;
}): Promise<{ ok: boolean; saved: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: false };

  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("source", "capsule")
    .eq("capsule_key", input.capsuleKey)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", existing.id as string)
      .eq("user_id", user.id);
    if (error) {
      console.error("[wishlist] toggle delete falló:", error.message);
      return { ok: false, saved: true };
    }
    revalidatePath("/wishlist");
    return { ok: true, saved: false };
  }

  const { error } = await supabase.from("wishlist_items").insert({
    user_id: user.id,
    image_path: null,
    image_url: input.imageUrl,
    color_hex: input.colorHex,
    capsule_key: input.capsuleKey,
    source: "capsule",
    name: input.name,
    porque: input.porque,
  });
  if (error) {
    console.error("[wishlist] toggle insert falló:", error.message);
    return { ok: false, saved: false };
  }
  revalidatePath("/wishlist");
  return { ok: true, saved: true };
}

export async function removeWishlistItem(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Recupera las rutas para limpiar storage y no dejar huérfanos (foto + try-on).
  const { data: row } = await supabase
    .from("wishlist_items")
    .select("image_path, tryon_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[wishlist] delete falló:", error.message);
    return { ok: false };
  }

  const paths = [row?.image_path, row?.tryon_path].filter(
    (p): p is string => !!p
  );
  if (paths.length) await supabase.storage.from("prendas").remove(paths);
  return { ok: true };
}
