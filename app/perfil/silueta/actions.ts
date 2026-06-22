"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isBuild, isVolume, type Build, type Volume } from "@/lib/silueta";

// Guarda la silueta autoseleccionada (complexión + dónde carga volumen). Ambos
// opcionales: se puede guardar solo lo que eligió. Valida contra los enums.
export async function saveSilueta(
  build: Build | null,
  volume: Volume | null
): Promise<{ ok: boolean }> {
  if (build !== null && !isBuild(build)) return { ok: false };
  if (volume !== null && !isVolume(volume)) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ body_build: build, body_volume: volume })
    .eq("id", user.id);
  if (error) return { ok: false };

  revalidatePath("/perfil");
  return { ok: true };
}
