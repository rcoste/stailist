"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { alcanzaParaLooks, queFalta } from "@/lib/onboarding-variante";

// EL CIERRE DE LAS 3 FOTOS (variante 'fotos', lib/onboarding-variante.ts).
//
// Las prendas ya entraron al clóset por el carrete (components/import-carrete-
// flow.tsx guarda cada una); aquí sólo se decide a dónde sigue: si con lo que
// sacó alcanza para looks distintos, al objetivo (paso 3, como la lista); si
// no, a la lista de básicos para completar lo que falte, sin avanzar el paso.
// Mismo guard que la lista: el update sólo afecta filas en el paso 2, así que
// un doble tap no duplica el evento.
export async function terminarFotos(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deFoto } = await supabase
    .from("items")
    .select("attrs")
    .eq("user_id", user.id)
    .eq("source", "photo")
    .is("deleted_at", null);
  const categorias = (deFoto ?? []).map((i) => (i.attrs as { categoria?: string } | null)?.categoria ?? null);

  if (!alcanzaParaLooks(categorias)) {
    await registrarEvento(supabase, {
      user_id: user.id,
      type: "onboarding_step",
      data: { step: 2, paso: "fotos-incompletas", prendas: categorias.length, falta: queFalta(categorias) },
    });
    redirect(`/onboarding/closet?complemento=${encodeURIComponent(queFalta(categorias).join(" y "))}`);
  }

  const { data: updated } = await supabase
    .from("profiles")
    .update({ onboarding_step: 3, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("onboarding_step", 2)
    .select("id");
  if (updated && updated.length > 0) {
    await registrarEvento(supabase, {
      user_id: user.id,
      type: "onboarding_step",
      data: { step: 3, paso: "fotos", prendas: categorias.length },
    });
  }
  redirect("/onboarding/objetivo");
}
