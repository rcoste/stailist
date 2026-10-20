"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { guardarVoto } from "@/lib/evales/vitrina-medicion-datos";

// El voto de Roberto sobre un candidato de la vitrina: sí es la pieza, no lo
// es, o quitar el voto. Se guarda al tocar; la pantalla se refresca sola.
export async function votarCandidato(candidatoId: string, veredicto: "si" | "no" | "quitar"): Promise<void> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(candidatoId)) return;
  await guardarVoto(candidatoId, veredicto === "quitar" ? null : veredicto === "si");
  revalidatePath("/admin/vitrina-medicion");
}
