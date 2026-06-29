"use server";

import { createClient } from "@/lib/supabase/server";

export type WaitlistState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "error"; message: string };

// Mismo regex que el prototipo del handoff (y consistente con login).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Alta a la waitlist desde la landing (usuaria deslogueada → cliente anon).
// No dispara OTP ni crea usuario: solo guarda el correo vía la función
// SECURITY DEFINER join_waitlist (la tabla no es legible desde el cliente).
export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const source = String(formData.get("source") ?? "landing");

  if (!EMAIL_RE.test(email)) {
    return {
      status: "error",
      message: "Mmm, ese correo no se ve bien. ¿Lo revisas?",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", {
    signup_email: email,
    signup_source: source,
  });

  if (error) {
    return {
      status: "error",
      message: "Algo se atoró de nuestro lado. Inténtalo de nuevo.",
    };
  }

  return { status: "success", email };
}
