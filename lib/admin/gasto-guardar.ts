import { withDb } from "@/lib/db";
import type { FilaGastoAds } from "@/lib/admin/gasto-ads";
import { cuentaMeta, traerGastoMeta, type FilaGastoMeta } from "@/lib/admin/gasto-meta";

// ESCRIBE EL GASTO AUTOMÁTICO en campana_gasto, la misma tabla que la captura a
// mano de /admin/campana. Lo automático manda: pisa lo capturado del mismo día
// y campaña. Lo usan el script de Google (app/api/campana/gasto) y la consulta
// a Meta (actualizarGastoMeta, abajo).

export const NOTA_GOOGLE = "automático: script de Google Ads";
export const NOTA_META = "automático: API de Meta";

/**
 * registros_google se escribe solo cuando la plataforma lo sabe (Google). Para
 * Meta va null: si fuera 0, el panel diría "Google dice 0" junto a cada anuncio.
 */
export async function guardarGasto(filas: (FilaGastoAds | FilaGastoMeta)[], nota: string): Promise<number> {
  if (filas.length === 0) return 0;
  const conRegistros = filas.map((f) => ({ ...f, registros: "registros" in f ? f.registros : null }));
  await withDb((c) =>
    c.query(
      `insert into public.campana_gasto (dia, campana, impresiones, clics, costo_mxn, registros_google, nota, actualizado)
       select x.dia, x.campana, x.impresiones, x.clics, x.costo_mxn, x.registros, $2, now()
       from jsonb_to_recordset($1::jsonb) as x(dia date, campana text, impresiones int, clics int, costo_mxn numeric, registros int)
       on conflict (dia, campana) do update set
         impresiones = excluded.impresiones, clics = excluded.clics, costo_mxn = excluded.costo_mxn,
         registros_google = excluded.registros_google, nota = excluded.nota, actualizado = now()`,
      [JSON.stringify(conRegistros), nota]
    )
  );
  return filas.length;
}

export type ResultadoMeta =
  | { estado: "sin-configurar" }
  | { estado: "ok"; guardadas: number; descartadas: number }
  | { estado: "error"; mensaje: string };

/**
 * Trae de Meta los últimos 7 días y los guarda. Nunca lanza: quien la llama es
 * el correo de las 8, y un Meta caído no debe tumbar el correo. El resultado
 * viaja al correo como aviso, para que una falla no pase callada.
 */
export async function actualizarGastoMeta(): Promise<ResultadoMeta> {
  const token = process.env.META_ADS_TOKEN?.trim();
  const cuenta = cuentaMeta(process.env.META_AD_ACCOUNT_ID);
  if (!token || !cuenta) return { estado: "sin-configurar" };
  try {
    const { filas, descartadas } = await traerGastoMeta(token, cuenta);
    const guardadas = await guardarGasto(filas, NOTA_META);
    return { estado: "ok", guardadas, descartadas };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error(`[gasto-meta] ${mensaje}`);
    return { estado: "error", mensaje };
  }
}

/** Lo que el correo dice del gasto de Meta; null cuando no hay nada que avisar. */
export function avisoGastoMeta(r: ResultadoMeta): string | null {
  if (r.estado === "error") return `No se pudo traer el gasto de Meta: ${r.mensaje}. El panel trae lo último que sí llegó.`;
  if (r.estado === "ok" && r.descartadas > 0)
    return `Meta mandó ${r.descartadas} ${r.descartadas === 1 ? "fila" : "filas"} con un nombre de anuncio que no parece utm_campaign (solo letras, números, guiones y puntos); no se guardaron.`;
  return null;
}
