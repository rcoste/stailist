"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeTasteTags, LOOK_IDS } from "@/lib/looks";

export type SwipeResult = { id: string; liked: boolean };

export async function saveTastes(
  results: SwipeResult[]
): Promise<{ error: string } | never> {
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

  const { error } = await supabase
    .from("profiles")
    .update({
      taste_tags: tasteTags,
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 1); // no retrocede a quien ya iba más adelante

  if (error) {
    return { error: "No pude guardar tus gustos — dale otra vez." };
  }

  // Los swipes crudos quedan en events: sirven para afinar looks y tags después.
  await supabase.from("events").insert({
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 2, swipes: clean, taste_tags: tasteTags },
  });

  redirect("/onboarding/colorimetria");
}
