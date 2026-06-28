"use server";

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

export async function removeWishlistItem(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("[wishlist] delete falló:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
