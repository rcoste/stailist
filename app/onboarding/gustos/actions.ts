"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeTasteTags, LOOKS, LOOK_IDS } from "@/lib/looks";
import { generateArchetype, type StyleArchetype } from "@/lib/engine/archetype";

export type SwipeResult = { id: string; liked: boolean };

// Devuelve el arquetipo para revelarlo en pantalla (no redirige: el reveal
// vive en el paso de gustos, como el de colorimetría). Error → string.
export async function saveTastes(
  results: SwipeResult[]
): Promise<{ archetype: StyleArchetype } | { error: string }> {
  const clean = results.filter(
    (r) => LOOK_IDS.has(r.id) && typeof r.liked === "boolean"
  );
  if (clean.length === 0) {
    return { error: "No me llegó ningún swipe — inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tasteTags = computeTasteTags(clean);

  // Arquetipo a partir de los looks con ❤️. Si la IA falla, seguimos sin
  // arquetipo (no bloquea el onboarding) con un fallback neutro.
  const likedLooks = LOOKS.filter(
    (l) => clean.find((r) => r.id === l.id)?.liked
  );
  let archetype: StyleArchetype;
  try {
    archetype = await generateArchetype(likedLooks);
  } catch {
    archetype = {
      nombre: "Tu estilo",
      descripcion: "te gustan las cosas que se sienten tuyas.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      taste_tags: tasteTags,
      style_archetype: archetype,
      onboarding_step: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 0); // no retrocede a quien ya iba más adelante

  if (error) {
    return { error: "No pude guardar tus gustos — dale otra vez." };
  }

  // Los swipes crudos quedan en events: sirven para afinar looks y tags después.
  await supabase.from("events").insert({
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 1, swipes: clean, taste_tags: tasteTags, archetype },
  });

  return { archetype };
}
