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
import { adoptarBorrador } from "@/lib/borrador-adoptar";

// EL CORREO, AL FINAL (ver lib/borrador.ts). Dos pasos, como el login, y con el
// MISMO mecanismo del login (signInWithOtp + verifyOtp): así el correo sale con
// las plantillas de siempre. Al verificar, lo que el borrador contestó se le
// pasa a la cuenta de ese correo (lib/borrador-adoptar.ts, ahí está el porqué).

export type CorreoState =
  | { status: "idle" }
  | { status: "sent"; email: string; message?: string }
  | { status: "error"; message: string; email?: string };

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

  // shouldCreateUser: si el correo es nuevo nace su cuenta (correo de
  // bienvenida); si ya existía, le llega el código de acceso de siempre.
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
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
  // El borrador se lee ANTES de verificar: después la sesión ya es la de la
  // cuenta del correo. Sale de la sesión validada, nunca del formulario.
  const {
    data: { user: antes },
  } = await supabase.auth.getUser();
  const borradorId = antes?.is_anonymous ? antes.id : null;

  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return { status: "sent", email, message: "Código incorrecto o caducado. Pide uno nuevo." };
  }

  let adopcion: Awaited<ReturnType<typeof adoptarBorrador>> = "nada";
  if (borradorId) {
    try {
      adopcion = await adoptarBorrador(borradorId, data.user.id);
    } catch (e) {
      // La cuenta ya existe y ya entró; lo que falló fue traerle lo contestado.
      // Que quede en los registros: es un onboarding perdido, no un login roto.
      console.error(`[borrador] no se pudo pasar ${borradorId} a ${data.user.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Ya tenía cuenta (o no había nada que pasar): "/" sabe a dónde mandarla.
  if (adopcion !== "adoptado") redirect("/");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("age_range")
    .eq("id", data.user.id)
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
