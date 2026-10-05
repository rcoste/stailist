import { filasValidas, type FilaGastoAds } from "@/lib/admin/gasto-ads";

// EL GASTO DE META (Instagram), SIN CAPTURARLO A MANO.
//
// Gemelo de lib/admin/gasto-ads.ts, pero al revés: Google Ads tiene scripts que
// corren DENTRO de la cuenta y empujan los números a stailist; Meta no tiene
// nada parecido. Aquí stailist le PREGUNTA a la API de Marketing cada mañana,
// antes del correo de las 8 (app/api/cron/campana), con un token de solo
// lectura (usuario del sistema con ads_read sobre la cuenta publicitaria).
//
// Una fila por ANUNCIO y día, no por campaña: en Meta hay una sola campaña con
// cuatro anuncios, y cada anuncio lleva su propio utm_campaign (ig-etiqueta,
// ig-jeans…). El nombre del anuncio ES ese utm_campaign, así que cae en la
// misma llave (dia, campana) del panel que lo de Google. Si un día alguien
// duplica un anuncio sin cambiarle el nombre, las dos copias se suman.
//
// Clics = inline_link_clicks (los que abren el enlace), no "clicks", que en
// Meta cuenta también likes, abrir comentarios y tocar el perfil: con ésos el
// CTR no se puede poner junto al de Google.
//
// Registros: Meta no los sabe (no hay píxel, a propósito), así que van en null
// y el panel los cuenta del lado de stailist.

/** Versión de la Graph API. Meta sostiene cada una ~2 años; la v25.0 era la vigente en octubre de 2026. */
export const GRAPH_VERSION = "v25.0";
const GRAPH = "https://graph.facebook.com/";
const MAX_PAGINAS = 10;

export type FilaGastoMeta = Omit<FilaGastoAds, "registros">;

/** Acepta el número de cuenta con o sin el prefijo act_; cualquier otra cosa es null. */
export function cuentaMeta(x: string | undefined): string | null {
  const limpio = (x ?? "").trim().replace(/^act_/, "");
  return /^\d{5,20}$/.test(limpio) ? limpio : null;
}

/** Los últimos 7 días completos (sin hoy), en la zona horaria de la cuenta. Mismo criterio que el script de Google. */
export function urlInsights(cuenta: string): string {
  const q = new URLSearchParams({
    level: "ad",
    fields: "date_start,ad_name,impressions,inline_link_clicks,spend",
    time_increment: "1",
    date_preset: "last_7d",
    limit: "500",
  });
  return `${GRAPH}${GRAPH_VERSION}/act_${cuenta}/insights?${q}`;
}

const numero = (x: unknown) => (typeof x === "string" && x.trim() !== "" ? Number(x) : typeof x === "number" ? x : NaN);

/**
 * Lo que devuelve Insights (todo viene como texto) a filas del panel. Suma las
 * filas con el mismo día y nombre, y valida con las mismas reglas que lo de
 * Google: lo que no cuadra se descarta y se cuenta, para avisar.
 */
export function filasDeInsights(data: unknown): { filas: FilaGastoMeta[]; descartadas: number } {
  const crudas = Array.isArray(data) ? data : [];
  const sumadas = new Map<string, Record<string, unknown>>();
  for (const r of crudas) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const dia = typeof o.date_start === "string" ? o.date_start : "";
    const campana = typeof o.ad_name === "string" ? o.ad_name.trim() : "";
    const clave = `${dia}|${campana}`;
    const previa = sumadas.get(clave);
    const impresiones = numero(o.impressions);
    const clics = o.inline_link_clicks == null ? 0 : numero(o.inline_link_clicks);
    const costo = numero(o.spend);
    sumadas.set(clave, {
      dia,
      campana,
      impresiones: (previa ? (previa.impresiones as number) : 0) + impresiones,
      clics: (previa ? (previa.clics as number) : 0) + clics,
      costo_mxn: (previa ? (previa.costo_mxn as number) : 0) + costo,
      registros: 0,
    });
  }
  const validas = filasValidas({ filas: [...sumadas.values()] });
  return {
    filas: validas.map((f) => ({ dia: f.dia, campana: f.campana, impresiones: f.impresiones, clics: f.clics, costo_mxn: f.costo_mxn })),
    descartadas: sumadas.size - validas.length,
  };
}

type Fetch = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * Pide los insights y sigue la paginación. El token va en el encabezado, nunca
 * en la URL (las URLs terminan en logs), y ningún mensaje de error lo incluye.
 */
export async function traerGastoMeta(
  token: string,
  cuenta: string,
  fetcher: Fetch = fetch as unknown as Fetch
): Promise<{ filas: FilaGastoMeta[]; descartadas: number }> {
  const todas: unknown[] = [];
  let url: string | null = urlInsights(cuenta);
  for (let pagina = 0; url && pagina < MAX_PAGINAS; pagina++) {
    const res = await fetcher(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => null)) as {
      data?: unknown[];
      paging?: { next?: unknown };
      error?: { message?: unknown; code?: unknown };
    } | null;
    if (!res.ok || !body || body.error) {
      const msg = typeof body?.error?.message === "string" ? body.error.message : "sin detalle";
      const codigo = body?.error?.code != null ? ` (código ${String(body.error.code)})` : "";
      throw new Error(`Meta respondió ${res.status}: ${msg.split(token).join("…")}${codigo}`);
    }
    if (Array.isArray(body.data)) todas.push(...body.data);
    const next = body.paging?.next;
    // Solo se sigue un "next" que apunte a la Graph API: nunca a otro lado con el token.
    url = typeof next === "string" && next.startsWith(GRAPH) ? next : null;
  }
  return filasDeInsights(todas);
}
