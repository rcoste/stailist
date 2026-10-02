"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_RE } from "@/lib/valid-email";
import { MENSAJE_RITMO, anotarIntento, intentosUltimaHora, ipDe, permitirCodigo } from "@/lib/ritmo-login";
import { COOKIE_ORIGEN } from "@/lib/origen";
import { contarPeticionDeCodigo } from "@/lib/campana-codigos";
import { COOKIE_CONVERSION } from "@/lib/publicidad";
import { isMinor, type AgeRange } from "@/lib/edad";
import { registrarEvento } from "@/lib/telemetria";

// EL CORREO, AL FINAL (ver lib/borrador.ts). Dos pasos, como el login: pedir el
// código y teclearlo. La diferencia es que aquí YA hay sesión (el borrador), así
// que no se crea una cuenta nueva: se le pone correo a la que ya existe
// (`updateUser`) y Supabase manda el código de "cambio de correo".

export type CorreoState =
  | { status: "idle" }
  | { status: "sent"; email: string; message?: string }
  | { status: "error"; message: string; email?: string }
  /** Ese correo ya es de una cuenta: se le manda a entrar por /login. */
  | { status: "existe"; email: string };

export async function pedirCodigo(_prev: CorreoState, formData: FormData): Promise<CorreoState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Ese correo no se ve completo — revísalo y va de nuevo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Ya tiene correo (recargó, volvió atrás): no hay nada que pedir.
  if (!user.is_anonymous) redirect("/onboarding/objetivo");

  // El mismo ritmo que el login: 3 códigos por correo y hora, 10 por dirección.
  const ip = ipDe(await headers());
  const intentos = await intentosUltimaHora(email, ip);
  if (!permitirCodigo(intentos)) return { status: "error", message: MENSAJE_RITMO, email };
  // Primero el conteo de la campaña y después el intento (ver app/login/actions.ts).
  await contarPeticionDeCodigo(email, (await cookies()).get(COOKIE_ORIGEN)?.value);
  await anotarIntento(email, ip);

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    // Ese correo ya tiene cuenta: su clóset está allá, no en este borrador.
    if (error.code === "email_exists" || /already|registered|exists/i.test(error.message)) {
      return { status: "existe", email };
    }
    return { status: "error", message: "No pude mandar el código. Inténtalo en unos segundos.", email };
  }
  return { status: "sent", email };
}

export async function verificarCodigo(_prev: CorreoState, formData: FormData): Promise<CorreoState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length !== 6) {
    return { status: "sent", email, message: "El código son 6 dígitos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email_change" });
  if (error || !data.user) {
    return { status: "sent", email, message: "Código incorrecto o caducado. Pide uno nuevo." };
  }

  // El correo ya está en auth.users y el trigger de la 0167 lo copia al perfil;
  // se escribe también aquí por si el trigger no corrió (cinturón y tirantes: el
  // perfil con correo NULL seguiría viéndose como borrador en los paneles).
  const { data: perfil } = await supabase
    .from("profiles")
    .update({ email, updated_at: new Date().toISOString() })
    .eq("id", data.user.id)
    .select("age_range")
    .maybeSingle();

  await registrarEvento(supabase, {
    user_id: data.user.id,
    type: "onboarding_step",
    data: { step: 3, paso: "correo" },
  });

  // EL REGISTRO SE LE AVISA A GOOGLE Y TIKTOK AHORA, que es cuando de verdad
  // existe: hay correo verificado. La cookie espera a la siguiente pantalla
  // medida (el objetivo, a donde va este redirect). Nunca para menores. La que
  // dejó la pantalla de edad pudo haber caducado si la persona tardó un día.
  if (!isMinor((perfil?.age_range ?? null) as AgeRange | null)) {
    (await cookies()).set(COOKIE_CONVERSION, "registro", {
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  redirect("/onboarding/objetivo");
}
