"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { modeloPorId } from "@/lib/proveedores/catalogo";
import type { Modo, Veredicto } from "@/lib/comparador/tipos";

// Abrir una corrida con fotos subidas, calificar una lectura, cerrarla.

/**
 * Abre la corrida vacía. Las fotos entran después, una por una.
 *
 * POR QUÉ SEPARADO Y NO TODO DE UN GOLPE
 * Las acciones de servidor de Next cortan el cuerpo de la petición en 1 MB.
 * Doce fotos, aun comprimidas a 1280px, pesan varios megas en base64 y la
 * petición ni siquiera llega al servidor: el navegador recibe un error de
 * servidor a secas, sin pista de qué pasó. Una foto por llamada mantiene cada
 * envío bien por debajo del límite y de paso deja mostrar el avance.
 */
export async function abrirCorrida(
  modo: Modo,
  modelos: string[]
): Promise<{ id: string } | { error: string }> {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  const limpios = modelos.filter((m) => modeloPorId(m));
  if (limpios.length < 2) return { error: "Elige al menos dos modelos." };

  const { data: corrida, error } = await supabase
    .from("comparador_corridas")
    .insert({ user_id: perfil.id, modo, modelos: limpios })
    .select("id")
    .single();
  if (error || !corrida) return { error: error?.message ?? "no se pudo crear" };
  return { id: corrida.id as string };
}

/**
 * Sube UNA foto a la corrida.
 *
 * LAS FOTOS SE GUARDAN. No hacen falta para la corrida de hoy —se podrían leer
 * y tirar— pero sí para la de dentro de tres meses: cuando salga un modelo
 * nuevo se le puede pasar exactamente el mismo examen sin volver a fotografiar
 * nada. Es justo lo que hoy NO se puede hacer con el historial real, porque el
 * flujo de producción lee la foto y la descarta.
 */
export async function subirFoto(
  corridaId: string,
  n: number,
  dataUrl: string
): Promise<{ id: string } | { error: string }> {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return { error: "esa foto no se pudo leer" };
  const [, mediaType, b64] = m;
  const ext = mediaType.split("/")[1] ?? "jpg";

  // Dentro de la carpeta del usuario: es lo que las políticas del bucket
  // esperan, y así una foto de comparador no se distingue en permisos de
  // cualquier otra suya.
  const path = `${perfil.id}/comparador/${corridaId}/${n}.${ext}`;
  const { error: eSubir } = await supabase.storage
    .from("prendas")
    .upload(path, Buffer.from(b64, "base64"), { contentType: mediaType, upsert: true });
  if (eSubir) return { error: eSubir.message };

  const { data: fila, error } = await supabase
    .from("comparador_fotos")
    .insert({ corrida_id: corridaId, path, n })
    .select("id")
    .single();
  if (error || !fila) return { error: error?.message ?? "no se pudo guardar" };
  return { id: fila.id as string };
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
