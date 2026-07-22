"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withDb } from "@/lib/db";
import { routeForStep } from "@/lib/onboarding";
import { isAgeRange, isMinor } from "@/lib/edad";
import { isEmailValido } from "@/lib/valid-email";
import { sendParentConsentEmail } from "@/lib/consentimiento";

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

  const token = menor ? randomUUID() : null;
  // `and age_range is null` = inmutabilidad: si ya hay edad, no toca nada
  // (rowCount 0) y solo redirige al paso actual.
  const row = await withDb((c) =>
    c
      .query(
        `update profiles set
           age_range = $2,
           minor_ack_at = case when $3::boolean then now() else null end,
           minor_parent_email = $4,
           minor_consent_token = $5::uuid,
           minor_consent_verified_at = null,
           minor_consent_last_sent_at = case when $3::boolean then now() else null end,
           updated_at = now()
         where id = $1 and age_range is null
         returning onboarding_step`,
        [user.id, ageRange, menor, menor ? parentEmail : null, token]
      )
      .then((r) => r.rows[0] as { onboarding_step: number } | undefined)
  );

  if (row && menor && token) {
    const sent = await sendParentConsentEmail(parentEmail, token);
    if (!sent.ok) console.error(`parent_consent_email_failed: ${sent.error}`);
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
