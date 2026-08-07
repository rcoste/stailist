"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { RUBRICA_VERSION, tieneEstilo } from "@/lib/engine/rubrica";
import { RUBRICA_VISION_VERSION } from "@/lib/engine/rubrica-vision";
import { MODELO_MOTOR, MODELO_JUEZ } from "@/lib/models";
import { briefsPara, POOL_VERSION } from "@/lib/comparador/motor";
import { briefCompleto, estiloDelPerfil, type EvalBriefFila } from "@/lib/evales/evales";

// Abrir una corrida de eval, sellarla como lista, cerrarla, y guardar la
// calibración humana.

/**
 * Abre la corrida completa: la corrida (con TODO lo congelado: prompt, pool,
 * modelo, rúbricas) + sus briefs. El pool es el MISMO del comparador
 * (briefsPara), a propósito: la banda de medir y la balanza tienen que medir
 * los mismos días o sus números no se hablan.
 */
export async function abrirEvalCorrida(input: {
  /** Cuántas vueltas al pool de 13 briefs (1-3). */
  vueltas: number;
}): Promise<{ id: string } | { error: string }> {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  const vueltas = Math.max(1, Math.min(3, Math.round(input.vueltas || 1)));
  // "veredicto" cicla el pool completo n veces; 13 briefs por vuelta.
  const briefs = briefsPara("veredicto", vueltas * 13);

  // Si el perfil trae señal de estilo, la dimensión "estilo" mide; si no, el
  // juez la deja neutra y el marcador no la promedia. Se congela AQUÍ para que
  // editar el perfil a media corrida no la deje midiendo a medias.
  const { data: p } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", perfil.id)
    .single();
  const conEstilo = tieneEstilo(estiloDelPerfil((p ?? {}) as Record<string, unknown>));

  const { data: corrida, error } = await supabase
    .from("eval_corridas")
    .insert({
      user_id: perfil.id,
      closet_user_id: perfil.id,
      prompt_version: PROMPT_VERSION,
      pool_version: POOL_VERSION,
      modelo_generador: MODELO_MOTOR.id,
      modelo_juez: MODELO_JUEZ.id,
      rubrica_version: RUBRICA_VERSION,
      rubrica_vision_version: RUBRICA_VISION_VERSION,
      con_estilo: conEstilo,
    })
    .select("id")
    .single();
  if (error || !corrida) return { error: error?.message ?? "no se pudo crear" };

  const { error: eBriefs } = await supabase
    .from("eval_briefs")
    .insert(briefs.map((brief, i) => ({ corrida_id: corrida.id, n: i + 1, brief })));
  if (eBriefs) {
    // Una corrida sin briefs es un cascarón: mejor no dejarla nacer.
    await supabase.from("eval_corridas").delete().eq("id", corrida.id);
    return { error: eBriefs.message };
  }

  revalidatePath("/admin/evales");
  return { id: corrida.id as string };
}

/**
 * Marca la corrida como lista — pero verificando por los DATOS, no porque la
 * pantalla lo diga: si algún brief sigue pendiente, se queda corriendo.
 */
export async function marcarEvalLista(
  corridaId: string
): Promise<{ ok: boolean; pendientes?: number; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: briefs } = await supabase
    .from("eval_briefs")
    .select("*")
    .eq("corrida_id", corridaId);
  const filas = (briefs ?? []) as unknown as Record<string, unknown>[];
  const pendientes = filas.filter(
    (b) =>
      !briefCompleto({
        looks: b.looks,
        error: b.error,
        notas: b.notas,
      } as unknown as EvalBriefFila)
  ).length;
  if (pendientes > 0) return { ok: false, pendientes };

  const { error } = await supabase
    .from("eval_corridas")
    .update({ estado: "lista" })
    .eq("id", corridaId)
    .eq("estado", "corriendo");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/evales");
  revalidatePath(`/admin/evales/${corridaId}`);
  return { ok: true };
}

export async function cerrarEval(
  corridaId: string,
  nota?: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("eval_corridas")
    .update({ estado: "cerrada", ...(nota?.trim() ? { nota: nota.trim().slice(0, 1500) } : {}) })
    .eq("id", corridaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/evales");
  revalidatePath(`/admin/evales/${corridaId}`);
  return { ok: true };
}

/**
 * Guarda la calibración humana de UN brief: 👍/👎 por look (+ comentario).
 * Nunca toca las notas de los jueces — la calibración compara, no corrige.
 */
export async function guardarMarcasEval(
  briefId: string,
  marcas: Record<number, "arriba" | "abajo">,
  comentarios?: Record<number, string>
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const limpias: Record<string, string> = {};
  for (const [k, v] of Object.entries(marcas ?? {})) {
    if ((v === "arriba" || v === "abajo") && Number.isInteger(Number(k))) limpias[k] = v;
  }
  if (Object.keys(limpias).length === 0) {
    return { ok: false, error: "no hay marcas que guardar" };
  }
  const textos: Record<string, string> = {};
  for (const [k, v] of Object.entries(comentarios ?? {})) {
    const t = typeof v === "string" ? v.trim().slice(0, 800) : "";
    if (t && Number.isInteger(Number(k))) textos[k] = t;
  }

  const { data: fila } = await supabase
    .from("eval_briefs")
    .select("id, corrida_id, marcas, comentarios")
    .eq("id", briefId)
    .maybeSingle();
  if (!fila) return { ok: false, error: "no existe ese brief" };

  const { error } = await supabase
    .from("eval_briefs")
    .update({
      marcas: { ...((fila.marcas as Record<string, string> | null) ?? {}), ...limpias },
      ...(Object.keys(textos).length
        ? {
            comentarios: {
              ...((fila.comentarios as Record<string, string> | null) ?? {}),
              ...textos,
            },
          }
        : {}),
    })
    .eq("id", briefId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/evales/${fila.corrida_id}`);
  return { ok: true };
}
