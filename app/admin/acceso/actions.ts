"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { withDb } from "@/lib/db";
import { isEmailValido } from "@/lib/valid-email";
import { sendInviteEmail } from "@/lib/invitacion";

// Agrega un correo a la allowlist Y le manda la invitación. Antes esto era un
// upsert mudo: la persona nunca recibía nada y había que decirle por WhatsApp
// "entra a stailist.co y haz X". Ahora el correo es esa instrucción, con el
// deep-link que cae en login con su correo puesto.
//
// Escribe por withDb (Postgres directo) a propósito: la allowlist tiene policy
// de INSERT/DELETE de admin pero NO de UPDATE (migración 0015) — el upsert que
// setea el token necesita update. El acceso ya está protegido por requireAdmin.
export async function addToAllowlist(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!isEmailValido(email)) return;

  const token = await withDb((c) =>
    c
      .query(
        `insert into public.allowlist (email, invite_token, invite_sent_at)
           values ($1, $2, now())
         on conflict (email) do update set
           invite_token = coalesce(public.allowlist.invite_token, excluded.invite_token),
           invite_sent_at = now()
         returning invite_token`,
        [email, randomUUID()]
      )
      .then((r) => r.rows[0]?.invite_token as string)
  );

  // Best-effort: si Postmark falla, la fila queda invitada y se puede reenviar.
  const sent = await sendInviteEmail(email, token);
  if (!sent.ok) console.error(`invite_email_failed: ${email} · ${sent.error}`);

  // Refresca las dos listas de la pantalla: la de espera deriva su badge
  // "ya invitado" de la allowlist.
  revalidatePath("/admin/acceso");
}

// Reenvía la invitación a un correo que ya está en la allowlist (si el link se
// perdió o cayó en spam). Reusa el token existente; si por lo que sea falta,
// genera uno. Refresca invite_sent_at para el estado en admin.
export async function resendInvite(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!isEmailValido(email)) return;

  const token = await withDb((c) =>
    c
      .query(
        `update public.allowlist set
           invite_token = coalesce(invite_token, $2),
           invite_sent_at = now()
         where email = $1
         returning invite_token`,
        [email, randomUUID()]
      )
      .then((r) => r.rows[0]?.invite_token as string | undefined)
  );

  if (!token) return; // el correo no estaba en la allowlist — nada que reenviar
  const sent = await sendInviteEmail(email, token);
  if (!sent.ok) console.error(`invite_resend_failed: ${email} · ${sent.error}`);

  revalidatePath("/admin/acceso");
}

export async function removeFromAllowlist(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  if (!email) return;

  const supabase = await createClient();
  await supabase.from("allowlist").delete().eq("email", email);
  revalidatePath("/admin/acceso");
}
