"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withDb } from "@/lib/db";
import { sendParentConsentEmail } from "@/lib/consentimiento";
import { isMinor, type AgeRange } from "@/lib/edad";

// Reenvía el correo de permiso al tutor (card de Perfil de un menor). Reusa el
// MISMO token — el link viejo sigue siendo válido, solo se re-manda.
// Cooldown server-side de 10 min entre envíos (anti spam a terceros y cuidado
// de la reputación del dominio); el sello va por withDb, el mismo canal
// protegido que el resto del estado de consentimiento.
const COOLDOWN_MS = 10 * 60 * 1000;

export async function resendParentConsent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: p } = await supabase
    .from("profiles")
    .select(
      "age_range, minor_parent_email, minor_consent_token, minor_consent_verified_at, minor_consent_last_sent_at"
    )
    .eq("id", user.id)
    .single();
  if (
    !p ||
    !isMinor((p.age_range as AgeRange | null) ?? null) ||
    p.minor_consent_verified_at ||
    !p.minor_parent_email ||
    !p.minor_consent_token
  ) {
    return;
  }
  const last = p.minor_consent_last_sent_at
    ? new Date(p.minor_consent_last_sent_at as string).getTime()
    : 0;
  if (Date.now() - last < COOLDOWN_MS) {
    // Muy pronto: la card muestra "enviado hace X min" — no re-mandamos.
    return;
  }

  await withDb((c) =>
    c.query(`update profiles set minor_consent_last_sent_at = now() where id = $1`, [user.id])
  );
  const sent = await sendParentConsentEmail(
    p.minor_parent_email as string,
    p.minor_consent_token as string
  );
  if (!sent.ok) console.error(`parent_consent_resend_failed: ${sent.error}`);
  revalidatePath("/perfil");
}
