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
  /** Análisis completo de la foto. Lo usa "ya la compré" para crear la prenda
   *  en el clóset sin volver a analizarla. */
  attrs?: Record<string, unknown> | null;
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
      attrs: input.attrs ?? null,
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

// Toggle desde la biblioteca (#3): manda/quita un básico del catálogo a la
// wishlist. Sin foto propia — guarda la referencia pública del arquetipo
// (image_path público). Deduplica por `capsule_key` = "biblio-<archetypeId>".
export async function toggleWishlistArchetype(input: {
  archetypeId: number;
  name: string;
  imageUrl: string | null;
  colorHex: string | null;
}): Promise<{ ok: boolean; saved: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, saved: false };

  const key = `biblio-${input.archetypeId}`;
  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("source", "biblioteca")
    .eq("capsule_key", key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", existing.id as string)
      .eq("user_id", user.id);
    if (error) {
      console.error("[wishlist] biblio delete falló:", error.message);
      return { ok: false, saved: true };
    }
    revalidatePath("/wishlist");
    revalidatePath("/closet/biblioteca");
    return { ok: true, saved: false };
  }

  const { error } = await supabase.from("wishlist_items").insert({
    user_id: user.id,
    image_path: null,
    image_url: input.imageUrl,
    color_hex: input.colorHex,
    capsule_key: key,
    source: "biblioteca",
    name: input.name,
  });
  if (error) {
    console.error("[wishlist] biblio insert falló:", error.message);
    return { ok: false, saved: false };
  }
  revalidatePath("/wishlist");
  revalidatePath("/closet/biblioteca");
  return { ok: true, saved: true };
}

// "Ya la compré": la prenda deja la wishlist y entra al clóset de verdad, para
// que el motor pueda armar looks con ella. Sin este atajo, comprar algo que
// guardaste obligaba a volver a fotografiarlo y volver a analizarlo.
//
// La foto NO se re-sube ni se borra: la fila del clóset apunta al MISMO objeto
// de storage. Por eso el borrado de aquí es directo y no pasa por
// removeWishlistItem, que sí limpia el storage — usarlo dejaría la prenda recién
// creada apuntando a una imagen borrada.
//
// El try-on cacheado sí se borra: era "tú con una prenda que no tenías", y una
// vez en el clóset los try-ons se generan por outfit, no por prenda suelta.
export async function moveWishlistItemToCloset(
  id: string
): Promise<{ ok: boolean; reason?: "sin_attrs" | "sin_foto" }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: row } = await supabase
    .from("wishlist_items")
    .select("image_path, tryon_path, attrs, name, color_hex")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!row) return { ok: false };

  const imagePath = row.image_path as string | null;
  // Solo las que subiste por foto: las de la cápsula y la biblioteca son
  // referencias a catálogo, y para ésas el camino es "ya la tengo" en su propia
  // pantalla (que ya existe y hace el match correcto).
  if (!imagePath) return { ok: false, reason: "sin_foto" };
  const attrs = row.attrs as Record<string, unknown> | null;
  if (!attrs?.categoria) return { ok: false, reason: "sin_attrs" };

  const { error: insErr } = await supabase.from("items").insert({
    user_id: user.id,
    source: "photo",
    certeza: "exacta",
    photo_path: imagePath,
    attrs: { ...attrs, nombre: (row.name as string | null) ?? attrs.nombre },
  });
  if (insErr) {
    console.error("[wishlist] pasar al clóset falló:", insErr.message);
    return { ok: false };
  }

  await supabase.from("wishlist_items").delete().eq("id", id).eq("user_id", user.id);
  if (row.tryon_path) {
    await supabase.storage.from("prendas").remove([row.tryon_path as string]);
  }

  revalidatePath("/wishlist");
  revalidatePath("/closet");
  return { ok: true };
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
