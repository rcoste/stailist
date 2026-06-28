import { createClient } from "@/lib/supabase/client";
import { saveGeneratedAvatar } from "@/lib/avatar-actions";

type BodyType = "slim" | "athletic" | "average" | "full";

// Guarda el avatar GENERADO por el wizard (base64 que devuelve Gemini → blob →
// {userId}/avatar.jpg). Misma ruta que la foto cruda anterior, así el try-on no
// cambia. Persiste body_type e invalida los try-ons viejos vía
// saveGeneratedAvatar. (El avatar es solo-generado: ya no hay subida cruda.)
export async function uploadGeneratedAvatar(
  base64: string,
  userId: string,
  bodyType: BodyType
): Promise<{ ok: boolean }> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const supabase = createClient();
  const path = `${userId}/avatar.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (up.error) {
    console.error("[avatar] storage upload falló:", up.error.message);
    return { ok: false };
  }
  return saveGeneratedAvatar(path, bodyType);
}
