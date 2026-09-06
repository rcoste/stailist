"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { EMAIL_RE } from "@/lib/valid-email";
import { MENSAJE_RITMO, anotarIntento, intentosUltimaHora, ipDe, permitirCodigo } from "@/lib/ritmo-login";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export type VerifyState =
  | { status: "idle"; email: string }
  | { status: "error"; email: string; message: string };


// Paso 1: valida el correo, revisa el ritmo y dispara el código de 6 dígitos.
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

  // Registro ABIERTO desde la apertura (B5, 2026-09-06): ya no hay allowlist
  // que consultar. El freno es el ritmo: 3 códigos por correo y hora, 10 por
  // IP y hora (lib/ritmo-login). Sin esto, este formulario es una máquina de
  // mandar correos a quien sea desde stailist.co.
  const ip = ipDe(await headers());
  const intentos = await intentosUltimaHora(email, ip);
  if (!permitirCodigo(intentos)) {
    return { status: "error", message: MENSAJE_RITMO };
  }
  await anotarIntento(email, ip);

  const supabase = await createClient();
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
