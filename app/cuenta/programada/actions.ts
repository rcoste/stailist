"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { RUTA_CUENTA_PROGRAMADA } from "@/lib/borrado-programado";

// Las dos salidas de la pantalla de cuenta programada (lib/borrado-programado.ts).

/** Cancela el borrado: la cuenta vuelve tal cual estaba. */
export async function recuperarCuenta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("profiles")
    .update({ borrado_programado_para: null, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    // Sólo mientras el plazo no haya pasado. Después, la limpieza diaria puede
    // estar a media tarea (archivos borrados, filas todavía no): recuperar
    // devolvería un clóset sin fotos, o uno que se borra igual minutos después.
    .gt("borrado_programado_para", new Date().toISOString())
    .select("id");
  if (error) {
    console.error(`[borrado-programado] no se pudo recuperar ${user.id}: ${error.message}`);
    redirect(`${RUTA_CUENTA_PROGRAMADA}?error=1`);
  }
  // Nada que recuperar: o ya no estaba programada (la página manda a "/") o
  // el plazo ya pasó (la página lo dice).
  if (!data?.length) redirect(RUTA_CUENTA_PROGRAMADA);
  await registrarEvento(supabase, { user_id: user.id, type: "cuenta_recuperada" });
  redirect("/");
}

/** Deja el borrado como estaba y cierra la sesión. */
export async function seguirConElBorrado() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?adios=1");
}
