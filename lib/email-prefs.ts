"use server";

import { createClient } from "@/lib/supabase/server";

// Guarda la preferencia del correo semanal. 'semanal' = opt-in explícito;
// 'off' = no recibir. Lo llama el prompt tras "me lo puse".
export async function setEmailSemanal(
  pref: "semanal" | "off"
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ email_semanal: pref })
    .eq("id", user.id);

  return { ok: !error };
}
