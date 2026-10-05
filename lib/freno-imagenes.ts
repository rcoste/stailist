import type { SupabaseClient } from "@supabase/supabase-js";
import { withDb } from "@/lib/db";
import { MENSAJE_PAUSA, TOPE_USD_DIA_GLOBAL, revisarCuota, revisarGasto, type Recurso, type Veredicto } from "@/lib/cuotas";

// EL FRENO GLOBAL DE IMÁGENES. Cuando la IA de TODA la app lleva más de
// TOPE_USD_DIA_GLOBAL en 24 horas, se dejan de generar imágenes para todos.
//
// POR QUÉ SÓLO IMÁGENES: son el 90% del gasto ($0.134 cada una contra centavos
// de un look) y lo único que alguien puede pedir por cientos. Con las imágenes
// en pausa la app sigue viva: los looks se arman, las fotos se leen y las
// prendas entran al clóset con su foto original. Cortar todo dejaría a quien
// acaba de llegar de un anuncio sin su primer look por el gasto de otra persona.
//
// POR QUÉ EXISTE: hasta el 2026-10-05 el tope global sólo mandaba un correo
// (app/api/cron/vigilancia), una vez por hora. Si algo se desbocaba de noche,
// seguía gastando hasta que alguien leyera el correo.
//
// Va por Postgres directo: ninguna sesión puede ver el gasto de las demás. Se
// guarda 60 segundos en memoria para no sumar la tabla en cada imagen; el
// exceso posible en ese minuto son unas cuantas imágenes. Falla ABIERTO, como
// lib/cuotas.ts.

const VIGENCIA_MS = 60_000;
let memo: { at: number; gasto: number } | null = null;

async function gastoGlobal24h(ahora: number): Promise<number> {
  if (memo && ahora - memo.at < VIGENCIA_MS) return memo.gasto;
  const gasto = await withDb((c) =>
    c
      .query<{ gasto: string }>(
        `select coalesce(sum(costo_usd), 0) as gasto from public.ai_calls where created_at >= now() - interval '24 hours'`
      )
      .then((r) => Number(r.rows[0]?.gasto ?? 0))
  );
  memo = { at: ahora, gasto };
  return gasto;
}

/** Pura, para probarla: ¿ese gasto pausa las imágenes? */
export function gastoPausaImagenes(gasto: number, tope: number = TOPE_USD_DIA_GLOBAL): boolean {
  return Number.isFinite(gasto) && gasto >= tope;
}

export async function imagenesEnPausa(ahora: number = Date.now()): Promise<boolean> {
  try {
    return gastoPausaImagenes(await gastoGlobal24h(ahora));
  } catch {
    return false;
  }
}

/** Sólo para los tests: olvida lo guardado. */
export function olvidarGastoGlobal() {
  memo = null;
}

/**
 * El permiso para generar UNA imagen: primero el freno global, luego lo de la
 * persona (su cuota si el recurso tiene una, o sólo su tope de dinero). Toda
 * ruta que genere imágenes pasa por aquí.
 */
export async function revisarImagen(
  supabase: SupabaseClient,
  userId: string,
  recurso: Recurso | null
): Promise<Veredicto> {
  if (await imagenesEnPausa()) {
    return { permitido: false, motivo: "pausa", mensaje: MENSAJE_PAUSA };
  }
  return recurso ? revisarCuota(supabase, userId, recurso) : revisarGasto(supabase, userId);
}
