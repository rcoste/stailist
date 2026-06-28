"use server";

import { createClient } from "@/lib/supabase/server";

type BodyType = "slim" | "athletic" | "average" | "full";

// Guarda el avatar generado por el wizard: avatar_path + body_type, invalida los
// try-ons cacheados (se generaron contra el avatar viejo) y registra el evento
// para medir cuántos completan el wizard.
export async function saveGeneratedAvatar(
  avatarPath: string,
  bodyType: BodyType
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[avatar] save sin sesión");
    return { ok: false };
  }
  if (!avatarPath.startsWith(`${user.id}/`)) {
    console.error("[avatar] path fuera de la carpeta del usuario:", avatarPath);
    return { ok: false };
  }
  if (!["slim", "athletic", "average", "full"].includes(bodyType)) {
    console.error("[avatar] body_type inválido:", bodyType);
    return { ok: false };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_path: avatarPath,
      body_type: bodyType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    console.error("[avatar] update de profiles falló:", error.message);
    return { ok: false };
  }

  await invalidateTryons(supabase, user.id);
  await supabase
    .from("events")
    .insert({ user_id: user.id, type: "avatar_generated", data: { body_type: bodyType } });

  return { ok: true };
}

// Al cambiar el avatar, los try-ons cacheados quedan contra la cara/cuerpo
// viejos (route.ts lee outfits.tryon_path sin revalidar). Limpiarlo fuerza que
// se regeneren con el avatar nuevo. Los archivos viejos se sobreescriben con
// upsert en el próximo try-on.
async function invalidateTryons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  await supabase.from("outfits").update({ tryon_path: null }).eq("user_id", userId);
}
