"use server";

import { createClient } from "@/lib/supabase/server";

// Guarda la foto de avatar (cuerpo completo) ya subida al bucket privado.
// Reutilizada para todos los try-ons.
export async function saveAvatar(
  avatarPath: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!avatarPath.startsWith(`${user.id}/`)) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  return { ok: !error };
}
