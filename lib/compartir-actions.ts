"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { datosDeCompartido } from "@/lib/compartir";

/**
 * Deja el rastro de que alguien compartió algo (ver lib/compartir.ts). Nunca
 * falla hacia la pantalla: la imagen ya salió, un renglón perdido no puede
 * costarle nada a la persona.
 */
export async function registrarCompartido(que: string, como: string): Promise<void> {
  const data = datosDeCompartido(que, como);
  if (!data) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await registrarEvento(supabase, { user_id: user.id, type: "compartido", data });
}
