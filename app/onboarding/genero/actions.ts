"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";

// El género filtra los básicos y los looks que verás. Es ortogonal al paso
// del onboarding: no avanza onboarding_step, solo desbloquea el flujo.
export async function saveGender(formData: FormData) {
  const gender = String(formData.get("gender") ?? "");
  if (gender !== "hombre" && gender !== "mujer") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ gender, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  // step 0 + paso: los pre-pasos no avanzan onboarding_step, pero sin huella el
  // tramo "abrió la app → swipes" era un bloque opaco de 143 s de mediana.
  await registrarEvento(supabase, {
    user_id: user.id,
    type: "onboarding_step",
    data: { step: 0, paso: "genero", gender },
  });

  // La edad va justo después del género (antesala del onboarding). El gate de
  // requireStep vuelve a validarla; si ya está puesta, /edad reenvía al paso real.
  redirect("/onboarding/edad");
}
