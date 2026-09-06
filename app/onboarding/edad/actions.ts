"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withDb } from "@/lib/db";
import { routeForStep } from "@/lib/onboarding";
import { isAgeRange, isMinor } from "@/lib/edad";
import { guardarEdad } from "@/lib/edad-guardar";
import { isEmailValido } from "@/lib/valid-email";
import { sendParentConsentEmail } from "@/lib/consentimiento";
import { registrarEvento } from "@/lib/telemetria";

// Guarda el rango de edad (ortogonal al onboarding_step, como el género: no
// avanza el paso, solo desbloquea el flujo). Menor (13-17): además del check,
// pide el correo del tutor, genera el token del link de permiso y se lo manda.
// El envío es best-effort — si falla, el link se reenvía desde Perfil; el
// onboarding NUNCA se bloquea por Postmark.
//
// Escribe por withDb (Postgres directo, sin sesión de usuario) a propósito:
// las columnas de edad/consentimiento están blindadas por trigger contra
// escrituras del cliente (migración 0082) — el único camino es el server.
// Inmutable: una vez puesta la edad, re-enviar NO la cambia (cierra el bypass
// menor→adulto; si alguien se equivoca de rango, se corrige manualmente hasta
// que exista edición en Perfil).
export async function saveAge(formData: FormData) {
  const ageRange = String(formData.get("age_range") ?? "");
  if (!isAgeRange(ageRange)) return;

  const menor = isMinor(ageRange);
  const ackOk = String(formData.get("minor_ack") ?? "") === "1";
  const parentEmail = String(formData.get("parent_email") ?? "").trim();
  // Un menor debe confirmar el check Y dar un correo de tutor válido (el CTA
  // ya lo bloquea en cliente; esto blinda el server).
  if (menor && (!ackOk || !isEmailValido(parentEmail))) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // El SQL vive en lib/edad-guardar.ts, compartido con la edición desde Perfil.
  const resultado = await withDb((c) =>
    guardarEdad(c, { uid: user.id, range: ageRange, parentEmail: menor ? parentEmail : null, soloSiVacia: true })
  );
  const row = resultado ? { onboarding_step: resultado.onboarding_step } : null;
  const token = resultado?.token ?? null;

  if (row && menor && token) {
    const sent = await sendParentConsentEmail(parentEmail, token);
    if (!sent.ok) console.error(`parent_consent_email_failed: ${sent.error}`);
  }

  if (row) {
    await registrarEvento(supabase, {
      user_id: user.id,
      type: "onboarding_step",
      data: { step: 0, paso: "edad", age_range: ageRange },
    });
  }

  let step: number = row?.onboarding_step ?? -1;
  if (step === -1) {
    // Edad ya estaba puesta (o el perfil no existe): redirige a su paso real.
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step")
      .eq("id", user.id)
      .single();
    step = profile?.onboarding_step ?? 0;
  }
  redirect(routeForStep(step));
}
