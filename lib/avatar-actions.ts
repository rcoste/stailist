"use server";

import { createClient } from "@/lib/supabase/server";
import { bodyTypeToBuild, isBuild, type Build, type Gender } from "@/lib/silueta";
import { registrarEvento } from "@/lib/telemetria";

type BodyType = "slim" | "athletic" | "average" | "full";

// Guarda el avatar generado por el wizard: avatar_path + body_type, invalida los
// try-ons cacheados (se generaron contra el avatar viejo) y registra el evento
// para medir cuántos completan el wizard.
// `build` (A3): la complexión EXACTA que eligió en el picker visual (taxonomía
// de silueta) — siembra body_build sin el redondeo de bodyTypeToBuild.
// `heightCm` (A3): altura opcional → profiles.height_cm.
// `bodyType` es null cuando se representó con FOTOS de su cuerpo en vez de una
// silueta de referencia: ahí no hay categoría que guardar (las fotos ya
// hicieron su trabajo en la generación) y body_type/body_build quedan como
// estaban, sin inventar un valor.
export async function saveGeneratedAvatar(
  avatarPath: string,
  bodyType: BodyType | null,
  build?: Build | null,
  heightCm?: number | null
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
  if (bodyType !== null && !["slim", "athletic", "average", "full"].includes(bodyType)) {
    console.error("[avatar] body_type inválido:", bodyType);
    return { ok: false };
  }

  // Morfología unificada: si la silueta del perfil aún no tiene complexión,
  // la respuesta del wizard la siembra (una sola pregunta, dos usos). Nunca
  // pisa una silueta ya definida — esa es la fuente de verdad. Con el picker
  // visual (A3) llega el `build` exacto; el fallback legacy redondea desde
  // bodyType.
  const { data: prof } = await supabase
    .from("profiles")
    .select("gender, body_build")
    .eq("id", user.id)
    .single();
  const seedBuild =
    prof && !prof.body_build && (prof.gender === "mujer" || prof.gender === "hombre")
      ? build && isBuild(build)
        ? build
        : // Sin bodyType (método por foto) no hay de dónde derivar complexión:
          // se queda null en vez de sembrar una inventada.
          bodyType
          ? bodyTypeToBuild(bodyType, prof.gender as Gender)
          : null
      : null;
  const alturaOk =
    typeof heightCm === "number" && Number.isInteger(heightCm) && heightCm >= 100 && heightCm <= 230;

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_path: avatarPath,
      // Solo se escribe si hay valor: con el método por foto (bodyType null)
      // NO se pisa con null lo que la usuaria ya tenía guardado.
      ...(bodyType ? { body_type: bodyType } : {}),
      ...(seedBuild ? { body_build: seedBuild } : {}),
      ...(alturaOk ? { height_cm: heightCm } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    console.error("[avatar] update de profiles falló:", error.message);
    return { ok: false };
  }

  await invalidateTryons(supabase, user.id);
  await registrarEvento(supabase, { user_id: user.id, type: "avatar_generated", data: { body_type: bodyType } });

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
