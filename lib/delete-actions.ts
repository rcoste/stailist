"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Borrado suave de outfits y viajes. La fila se queda con deleted_at; todas las
// lecturas de producto filtran `deleted_at is null`.
//
// Por qué no se borra de verdad: un borrado es la señal de rechazo más fuerte
// que da una usuaria (más que un 👎: significa "no lo quiero ni ver"). Con el
// experimento por delante, esa fila es justo el dato que fuimos a buscar.
//
// Cada borrado deja su evento (item_deleted / outfit_deleted / trip_deleted)
// para poder leer QUÉ se borró y cuándo. Los tipos están en el CHECK de events
// (migración 0078) — si algún día agregas otro, va ahí o el insert falla mudo.

async function marcarBorrado(
  tabla: "outfits" | "trips",
  id: string,
  evento: "outfit_deleted" | "trip_deleted"
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // `is deleted_at null` hace la acción idempotente: doble tap no re-escribe la
  // fecha ni duplica el evento. Verifica propiedad además de la RLS.
  const { data, error } = await supabase
    .from(tabla)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false };

  await supabase.from("events").insert({
    user_id: user.id,
    type: evento,
    outfit_id: tabla === "outfits" ? id : null,
    data: tabla === "trips" ? { trip_id: id } : {},
  });

  return { ok: true };
}

export async function deleteOutfit(id: string): Promise<{ ok: boolean }> {
  const res = await marcarBorrado("outfits", id, "outfit_deleted");
  if (res.ok) {
    revalidatePath("/historial");
    revalidatePath("/hoy"); // si era el look del día, la pantalla vuelve a idle
    revalidatePath("/perfil/pasaporte");
  }
  return res;
}

export async function deleteTrip(id: string): Promise<{ ok: boolean }> {
  const res = await marcarBorrado("trips", id, "trip_deleted");
  if (res.ok) {
    revalidatePath("/viaje/lista");
    revalidatePath("/hoy"); // la card contextual y el aviso de "Más" lo leen
  }
  return res;
}
