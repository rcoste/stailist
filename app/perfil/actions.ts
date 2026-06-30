"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Quita el estilo de referencia: borra la foto del bucket y limpia la columna.
export async function removeStyleReference(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: prof } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const path = (prof?.style_reference as { image_path?: string } | null)?.image_path;
  if (path) await supabase.storage.from("prendas").remove([path]);

  const { error } = await supabase
    .from("profiles")
    .update({ style_reference: null })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// Cierra la sesión y manda al login. No es destructivo (se puede volver a entrar
// con el código OTP), por eso no pide confirmación.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
