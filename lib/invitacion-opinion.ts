"use server";

import { createClient } from "@/lib/supabase/server";

// LA INVITACIÓN A OPINAR (migración 0190): a las personas que más usan la app,
// una tarjeta en Inicio que les pide su opinión. Quién está invitado lo decide
// Roberto en la base; aquí sólo se lee y se marca lo que la persona hizo.

export type AccionInvitacion = "vista" | "respondida" | "descartada";

const COLUMNA: Record<AccionInvitacion, string> = {
  vista: "vista_at",
  respondida: "respondida_at",
  descartada: "descartada_at",
};

/** Marca lo que hizo con la tarjeta. "vista" sólo cuenta la primera vez. */
export async function marcarInvitacion(accion: AccionInvitacion): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  let q = supabase
    .from("invitaciones_opinion")
    .update({ [COLUMNA[accion]]: new Date().toISOString() })
    .eq("user_id", user.id);
  if (accion === "vista") q = q.is("vista_at", null);
  await q;
}
