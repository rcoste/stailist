import { createClient } from "@/lib/supabase/client";
import { addWishlistItem } from "@/lib/wishlist-actions";
import type { Verdict } from "@/lib/color/match";

// Sube la foto del candidato al bucket privado ({userId}/wishlist/<uuid>.jpg) y
// crea la fila. Ruta con uuid nuevo = INSERT (no choca con la RLS). Lo usan el
// chequeo de color ("guardar en wishlist") y el "agregar" del propio Wishlist.
export async function saveToWishlist(
  file: Blob,
  colorHex: string | null,
  verdict: Verdict | null,
  source: "upload" | "capsule" | "gap" = "upload"
): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const path = `${user.id}/wishlist/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (up.error) {
    console.error("[wishlist] upload falló:", up.error.message);
    return { ok: false };
  }
  return addWishlistItem({ imagePath: path, colorHex, verdict, source });
}
