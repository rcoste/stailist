"use server";

import { createClient } from "@/lib/supabase/server";

// Acciones compartidas sobre un outfit (las usan el wow, el historial y Hoy).

// Voto 👍/👎 persistente. El índice único (user, outfit, type) hace el doble
// tap idempotente; si cambia de opinión, borramos el voto contrario.
export async function voteOutfit(
  outfitId: string,
  up: boolean
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const voteType = up ? "vote_up" : "vote_down";
  const opposite = up ? "vote_down" : "vote_up";

  await supabase
    .from("events")
    .delete()
    .eq("user_id", user.id)
    .eq("outfit_id", outfitId)
    .eq("type", opposite);

  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    outfit_id: outfitId,
    type: voteType,
    data: {},
  });

  // 23505 = ya había votado igual (doble tap) — cuenta como éxito.
  if (error && error.code !== "23505") return { ok: false };
  return { ok: true };
}

// "Me lo puse" — la señal de oro del experimento: alguien usó un outfit en la
// vida real. Idempotente por el índice único (user, outfit, 'worn').
export async function markWorn(
  outfitId: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    outfit_id: outfitId,
    type: "worn",
    data: {},
  });

  if (error && error.code !== "23505") return { ok: false };
  return { ok: true };
}

// Bookmark: guarda/quita un look de favoritos (distinto del 👍). Sella o limpia
// outfits.favorited_at del look del propio usuario (RLS).
export async function toggleFavorite(
  outfitId: string,
  favorite: boolean
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("outfits")
    .update({ favorited_at: favorite ? new Date().toISOString() : null })
    .eq("id", outfitId)
    .eq("user_id", user.id);

  return { ok: !error };
}
