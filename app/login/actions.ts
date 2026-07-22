"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_RE } from "@/lib/valid-email";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "not_allowed" }
  | { status: "error"; message: string };

export type VerifyState =
  | { status: "idle"; email: string }
  | { status: "error"; email: string; message: string };


// Paso 1: valida correo + allowlist y dispara el código de 6 dígitos.
// signInWithOtp genera el OTP; el template del correo lo muestra ({{ .Token }}).
// Sin emailRedirectTo: ya no hay link, solo código.
export async function sendCode(
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

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return {
      status: "error",
      message: "No pude mandar el código. Dale a reenviar en unos segundos.",
    };
  }

  return { status: "sent", email };
}

// Paso 2: valida el código tecleado. verifyOtp deja la sesión en cookies y
// "/" decide a qué paso del onboarding mandarte.
export async function verifyCode(
  _prev: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");

  if (token.length !== 6) {
    return { status: "error", email, message: "El código son 6 dígitos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return {
      status: "error",
      email,
      message: "Código incorrecto o caducado. Pide uno nuevo.",
    };
  }

  redirect("/");
}
