"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "not_allowed" }
  | { status: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return {
      status: "error",
      message: "Ese correo no se ve completo — revísalo y va de nuevo.",
    };
  }

  const supabase = await createClient();

  // Allowlist server-side: la función SECURITY DEFINER corre en la DB,
  // el cliente nunca ve la lista ni puede saltársela.
  const { data: allowed, error: rpcError } = await supabase.rpc(
    "is_email_allowed",
    { check_email: email }
  );
  if (rpcError) {
    return {
      status: "error",
      message: "Algo se atoró de nuestro lado. Inténtalo de nuevo.",
    };
  }
  if (!allowed) return { status: "not_allowed" };

  const h = await headers();
  const origin = h.get("origin") ?? `http://${h.get("host")}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    return {
      status: "error",
      message: "No pude mandar el link. Dale a reenviar en unos segundos.",
    };
  }

  return { status: "sent", email };
}
