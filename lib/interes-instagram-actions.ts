"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { datosDeInteres } from "@/lib/interes-instagram";

/** Las tres huellas de la prueba (lib/interes-instagram.ts). Nunca falla hacia la pantalla. */
export async function registrarInteresIg(
  tipo: "visto" | "si" | "no",
  extra?: { usuario?: string; consiente?: boolean }
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await registrarEvento(supabase, {
    user_id: user.id,
    type: `ig_interes_${tipo}`,
    data: tipo === "si" ? datosDeInteres(extra?.usuario, extra?.consiente) : {},
  });
}
