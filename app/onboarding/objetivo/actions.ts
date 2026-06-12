"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OBJECTIVES } from "./objectives";

export async function saveObjective(formData: FormData) {
  const objective = String(formData.get("objective") ?? "");
  if (!(objective in OBJECTIVES)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Persiste el paso ANTES de avanzar: si se interrumpe aquí, retoma en gustos.
  const { error } = await supabase
    .from("profiles")
    .update({
      last_objective: objective,
      onboarding_step: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("onboarding_step", 0); // no retrocede a quien ya iba más adelante

  if (error) redirect("/onboarding/objetivo?error=guardar");

  // Instrumentación: cada paso completado deja huella (mide el TTV real).
  await supabase.from("events").insert({
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 1, objective },
  });

  redirect("/onboarding/gustos");
}
