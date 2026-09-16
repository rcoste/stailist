"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routeForStep } from "@/lib/onboarding";
import { esComoNosConocio } from "@/lib/como-nos-conocio";
import { registrarEvento } from "@/lib/telemetria";

// Guarda la respuesta y sigue al paso real del onboarding. Nunca bloquea: si el
// update falla, la persona sigue igual (perder una respuesta de atribución no
// puede costarle el onboarding — mismo criterio que lib/origen-perfil.ts).
// `is(null)`: no pisa una respuesta ya dada si llega de dos pestañas.
export async function guardarComoNosConocio(formData: FormData) {
  const valor = String(formData.get("como_nos_conocio") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (esComoNosConocio(valor)) {
    const { error } = await supabase
      .from("profiles")
      .update({ como_nos_conocio: valor })
      .eq("id", user.id)
      .is("como_nos_conocio", null);
    if (error) {
      console.error(`[conocio] no se guardó: ${error.message}`);
    } else {
      await registrarEvento(supabase, {
        user_id: user.id,
        type: "onboarding_step",
        data: { paso: "conocio", como_nos_conocio: valor },
      });
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("id", user.id)
    .single();
  redirect(routeForStep(profile?.onboarding_step ?? 0));
}
