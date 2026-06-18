import { createClient } from "@/lib/supabase/client";
import { toUsableImage } from "@/lib/image-file";
import { comprimir } from "@/lib/image-compress";
import { saveAvatar } from "@/lib/avatar-actions";

// Sube/reemplaza la foto de avatar (la base del try-on): normaliza HEIC, comprime,
// la guarda en el bucket privado en {userId}/avatar.jpg (upsert) y persiste
// avatar_path. Cliente. Compartido por el try-on y el perfil.
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<{ ok: boolean }> {
  const blob = await comprimir(await toUsableImage(file));
  const supabase = createClient();
  const path = `${userId}/avatar.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (up.error) return { ok: false };
  return saveAvatar(path);
}
