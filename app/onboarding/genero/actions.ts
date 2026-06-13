"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routeForStep } from "@/lib/onboarding";

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

  const { data: profile } = await supabase
    .from("profiles")
    .update({ gender, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("onboarding_step")
    .single();

  redirect(routeForStep(profile?.onboarding_step ?? 0));
}
