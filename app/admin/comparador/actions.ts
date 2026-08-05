"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modeloPorId } from "@/lib/proveedores/catalogo";
import type { Modo, Veredicto } from "@/lib/comparador/tipos";

// Abrir una corrida con fotos subidas, calificar una lectura, cerrarla.

/**
 * Sube las fotos y abre la corrida.
 *
 * LAS FOTOS SE GUARDAN. No hacen falta para la corrida de hoy —se podrían leer
 * y tirar— pero sí para la de dentro de tres meses: cuando salga un modelo
 * nuevo se le puede pasar exactamente el mismo examen sin volver a fotografiar
 * nada. Es justo lo que hoy NO se puede hacer con el historial real, porque el
 * flujo de producción lee la foto y la descarta.
 */
export async function abrirCorrida(
  modo: Modo,
  modelos: string[],
  fotos: { nombre: string; dataUrl: string }[]
): Promise<{ id: string; fotos: { id: string }[] } | { error: string }> {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  const limpios = modelos.filter((m) => modeloPorId(m));
  if (limpios.length < 2) return { error: "Elige al menos dos modelos." };
  if (!fotos.length) return { error: "Sube al menos una foto." };
  if (fotos.length > 12) return { error: "Máximo 12 fotos por corrida." };

  const { data: corrida, error: eCorrida } = await supabase
    .from("comparador_corridas")
    .insert({ user_id: perfil.id, modo, modelos: limpios })
    .select("id")
    .single();
  if (eCorrida || !corrida) return { error: eCorrida?.message ?? "no se pudo crear" };

  const guardadas: { id: string }[] = [];
  for (const [i, f] of fotos.entries()) {
    const m = f.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) continue;
    const [, mediaType, b64] = m;
    const ext = mediaType.split("/")[1] ?? "jpg";
    // Dentro de la carpeta del usuario: es lo que las políticas del bucket
    // esperan, y así una foto de comparador no se distingue en permisos de
    // cualquier otra suya.
    const path = `${perfil.id}/comparador/${corrida.id}/${i}.${ext}`;
    const { error: eSubir } = await supabase.storage
      .from("prendas")
      .upload(path, Buffer.from(b64, "base64"), { contentType: mediaType, upsert: true });
    if (eSubir) return { error: `no se pudo subir la foto ${i + 1}: ${eSubir.message}` };

    const { data: fila } = await supabase
      .from("comparador_fotos")
      .insert({ corrida_id: corrida.id, path, n: i + 1 })
      .select("id")
      .single();
    if (fila) guardadas.push({ id: fila.id as string });
  }

  if (!guardadas.length) return { error: "Ninguna foto se pudo guardar." };
  return { id: corrida.id as string, fotos: guardadas };
}

/**
 * Guarda el juicio sobre una lectura.
 *
 * Se guarda a cada paso, sin botón de guardar: son decenas de juicios seguidos
 * y un botón es una oportunidad más de perderlos.
 */
export async function calificar(
  fotoId: string,
  modeloId: string,
  veredicto: Veredicto
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("comparador_lecturas")
    .update({ veredicto })
    .eq("foto_id", fotoId)
    .eq("modelo_id", modeloId);
  return { ok: !error };
}

export async function cambiarEstado(
  corridaId: string,
  estado: "corriendo" | "juzgando" | "cerrada",
  nota?: string
): Promise<{ ok: boolean }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("comparador_corridas")
    .update({ estado, ...(nota !== undefined ? { nota } : {}) })
    .eq("id", corridaId);
  revalidatePath("/admin/comparador");
  return { ok: !error };
}
