import { createClient } from "@/lib/supabase/client";
import { saveGeneratedAvatar } from "@/lib/avatar-actions";

type BodyType = "slim" | "athletic" | "average" | "full";

// Guarda el avatar GENERADO por el wizard (base64 que devuelve Gemini → blob →
// {userId}/avatar.jpg). Misma ruta que la foto cruda anterior, así el try-on no
// cambia. Persiste body_type e invalida los try-ons viejos vía
// saveGeneratedAvatar. (El avatar es solo-generado: ya no hay subida cruda.)
// `faceB64` (opcional): el retrato APROBADO de la etapa cara — se guarda por
// convención en {userId}/avatar-face.jpg como ancla de identidad (lo usará el
// try-on multi-vista). Best-effort: si falla, el avatar se guarda igual.
export async function uploadGeneratedAvatar(
  base64: string,
  userId: string,
  bodyType: BodyType,
  faceB64?: string | null
): Promise<{ ok: boolean }> {
  const toBlob = (b64: string) =>
    new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/jpeg" });
  const supabase = createClient();
  const path = `${userId}/avatar.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, toBlob(base64), { contentType: "image/jpeg", upsert: true });
  if (up.error) {
    console.error("[avatar] storage upload falló:", up.error.message);
    return { ok: false };
  }
  if (faceB64) {
    const upFace = await supabase.storage
      .from("prendas")
      .upload(`${userId}/avatar-face.jpg`, toBlob(faceB64), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (upFace.error) console.error("[avatar] face upload falló:", upFace.error.message);
  }
  return saveGeneratedAvatar(path, bodyType);
}
