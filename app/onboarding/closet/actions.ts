"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveCloset(
  archetypeIds: number[]
): Promise<{ error: string } | never> {
  const ids = [...new Set(archetypeIds)].filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (ids.length < 3) {
    return {
      error:
        "Con menos de 3 prendas el stylist no tiene con qué jugar — marca al menos 3.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Valida contra el catálogo real y hereda sus atributos.
  const { data: archetypes, error: catError } = await supabase
    .from("archetypes")
    .select("id, name, attrs")
    .in("id", ids);
  if (catError || !archetypes || archetypes.length === 0) {
    return { error: "No pude leer el catálogo — inténtalo otra vez." };
  }

  // Avanza el paso PRIMERO con guard: si esto no afecta filas, otro submit ya
  // pasó por aquí (doble tap) y no hay que duplicar prendas.
  const { data: updated, error: stepError } = await supabase
    .from("profiles")
    .update({ onboarding_step: 4, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("onboarding_step", 3)
    .select("id");
  if (stepError) {
    return { error: "No pude guardar tu clóset — dale otra vez." };
  }

  if (updated && updated.length > 0) {
    const { error: itemsError } = await supabase.from("items").insert(
      archetypes.map((a) => ({
        user_id: user.id,
        source: "archetype",
        archetype_id: a.id,
        attrs: { nombre: a.name, ...(a.attrs as Record<string, unknown>) },
      }))
    );
    if (itemsError) {
      // Revertir el paso para que pueda reintentar sin quedarse atorada.
      await supabase
        .from("profiles")
        .update({ onboarding_step: 3 })
        .eq("id", user.id)
        .eq("onboarding_step", 4);
      return { error: "No pude guardar tus prendas — inténtalo otra vez." };
    }

    await supabase.from("events").insert({
      user_id: user.id,
      type: "onboarding_step",
      data: { step: 4, items: archetypes.length },
    });
  }

  redirect("/onboarding/wow");
}
