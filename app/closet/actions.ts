"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

// Guarda una prenda fotografiada por la usuaria. La foto ya está en el bucket
// privado 'prendas' (la subió el cliente con su RLS). attrs lleva los atributos
// confirmados/editados — entran al motor igual que los de un arquetipo.
export async function addPhotoItem(
  photoPath: string,
  attrs: PrendaAnalisis
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // photoPath debe estar dentro de la carpeta del usuario (defensa extra
  // además de la RLS del Storage).
  if (!photoPath.startsWith(`${user.id}/`)) return { ok: false };

  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    source: "photo",
    photo_path: photoPath,
    attrs: {
      nombre: attrs.nombre,
      categoria: attrs.categoria,
      color: attrs.color,
      color_hex: attrs.color_hex,
      formalidad: attrs.formalidad,
      temporada: attrs.temporada,
    },
  });
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}
