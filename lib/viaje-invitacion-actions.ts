"use server";

import { createClient } from "@/lib/supabase/server";
import { tokenNuevo } from "@/lib/viaje-invitacion";

/**
 * El link de invitación de un viaje: el mismo cada vez (se crea la primera vez
 * que el dueño toca "invitar"). La RLS de trips sólo deja escribir al dueño,
 * así que un id ajeno no devuelve nada.
 */
export async function linkDeInvitacion(tripId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: trip } = await supabase
    .from("trips")
    .select("id, invitacion")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!trip) return null;
  if (trip.invitacion) return trip.invitacion as string;
  const token = tokenNuevo();
  const { error } = await supabase.from("trips").update({ invitacion: token }).eq("id", tripId).eq("user_id", user.id);
  return error ? null : token;
}
