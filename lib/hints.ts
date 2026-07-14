"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Hints contextuales: descubrimiento just-in-time de los módulos. Cada hint se
// muestra UNA vez (la primera vez que pisas la superficie donde es relevante) y
// se persiste en profiles.hints_seen — cross-device, no por navegador.

export type HintId =
  | "hoy-casa" // Hoy: "esta es tu casa"
  | "fab-generar" // el ✨ genera desde cualquier pantalla
  | "closet-tabs" // el clóset también tiene cápsula y wishlist
  | "historial-worn" // di "me lo puse" para que aprenda
  | "wishlist-cartera" // la cartera de colores antes de comprar
  | "viaje"; // te armo la maleta

// Marca el hint como visto (lo llama la burbuja al cerrarse) + evento para
// medir en el admin si los tips llevan gente a los módulos.
export async function dismissHint(id: HintId): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("hints_seen")
    .eq("id", user.id)
    .single();
  const seen = ((profile?.hints_seen as Record<string, string> | null) ?? {});
  if (seen[id]) return; // idempotente
  seen[id] = new Date().toISOString();

  await supabase.from("profiles").update({ hints_seen: seen }).eq("id", user.id);
  await supabase
    .from("events")
    .insert({ user_id: user.id, type: "hint_seen", data: { id } });
}

// "Volver a ver los tips" (Perfil): resetea todos los hints.
export async function resetHints(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ hints_seen: {} }).eq("id", user.id);
  revalidatePath("/hoy");
  revalidatePath("/closet");
  revalidatePath("/historial");
  revalidatePath("/wishlist");
}
