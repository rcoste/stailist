"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { withDb } from "@/lib/db";

// Marcar un tipo de error: visto (ya sé qué es), arreglado (salió el fix) o
// de vuelta a sin revisar. La nota dice qué se hizo ("maxDuration a 300").
const ESTADOS = new Set(["sin_revisar", "visto", "arreglado"]);

export async function marcarError(formData: FormData) {
  await requireAdmin();
  const clave = String(formData.get("clave") ?? "").slice(0, 120);
  const estado = String(formData.get("estado") ?? "");
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 300) || null;
  if (!clave || !ESTADOS.has(estado)) return;
  await withDb((c) =>
    c.query(
      `insert into public.errores_estado (clave, estado, nota, actualizado) values ($1, $2, $3, now())
       on conflict (clave) do update set estado = excluded.estado,
         nota = coalesce(excluded.nota, public.errores_estado.nota), actualizado = now()`,
      [clave, estado, nota]
    )
  );
  revalidatePath("/admin/errores");
}
