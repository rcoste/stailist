// EL NAVEGADOR AVISA DE LO QUE LE SALIÓ MAL (2026-10-14). Dos maneras:
//
//  · avisarError(): una pantalla lo llama a mano cuando le enseña un error a
//    la persona (la maleta que no salió, la pantalla de "algo se me atoró").
//  · instalarVigia(): se instala una vez y vigila TODAS las llamadas de la app
//    a /api/* y a las acciones del servidor. Si una regresa 500+ o se cae la
//    conexión, avisa sola. Es lo que ve el corte por tiempo (504) sin tocar
//    pantalla por pantalla, que eran 40 archivos con su propio "no pude".
//
// Nunca lanza ni espera: un aviso que falla se pierde, y la persona no se
// entera. La misma clave se avisa una vez por minuto como mucho: un botón que
// reintenta en bucle no llena la tabla (y la ruta tiene además su tope).

import { rutaSinIds } from "@/lib/errores-clave";

const avisadas = new Map<string, number>();
const RUTA_AVISO = "/api/errores";
// Rutas que no se vigilan: la propia del aviso (sería un bucle) y las de
// medición, cuyo fallo no lo ve nadie.
const SIN_VIGILAR = new Set([RUTA_AVISO, "/api/visita"]);

export function avisarError(a: { clave: string; mensaje?: string | null; tecnico?: string | null }): void {
  try {
    if (typeof window === "undefined") return;
    const ahora = Date.now();
    if ((avisadas.get(a.clave) ?? 0) > ahora - 60_000) return;
    avisadas.set(a.clave, ahora);
    const cuerpo = JSON.stringify({
      clave: a.clave.slice(0, 120),
      pantalla: rutaSinIds(window.location.pathname),
      mensaje: a.mensaje?.slice(0, 300) ?? null,
      tecnico: a.tecnico?.slice(0, 500) ?? null,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    });
    // fetchOriginal: el aviso no pasa por el vigía.
    void (fetchOriginal ?? window.fetch)(RUTA_AVISO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* un aviso perdido no rompe nada */
  }
}

let fetchOriginal: typeof fetch | null = null;

/** Qué llamada es y si es de las que se vigilan. null = no se vigila. */
export function llamadaVigilada(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  origen: string
): { ruta: string; accion: boolean } | null {
  let url: URL;
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    url = new URL(raw, origen);
  } catch {
    return null;
  }
  if (url.origin !== origen) return null;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const accion = headers.has("Next-Action");
  if (!accion && !url.pathname.startsWith("/api/")) return null;
  if (SIN_VIGILAR.has(url.pathname)) return null;
  return { ruta: rutaSinIds(url.pathname), accion };
}

export function instalarVigia(): void {
  if (typeof window === "undefined" || fetchOriginal) return;
  fetchOriginal = window.fetch.bind(window);
  const original = fetchOriginal;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const vigilada = llamadaVigilada(input, init, window.location.origin);
    if (!vigilada) return original(input, init);
    const donde = vigilada.accion ? `accion:${vigilada.ruta}` : vigilada.ruta;
    try {
      const res = await original(input, init);
      if (res.status >= 500) {
        avisarError({ clave: `http:${donde}:${res.status}`, tecnico: `${init?.method ?? "GET"} ${donde} → ${res.status}` });
      }
      return res;
    } catch (e) {
      // Cancelar a propósito (cambiar de pantalla, AbortController) no es un error.
      const abortado = e instanceof DOMException && e.name === "AbortError";
      if (!abortado) {
        avisarError({ clave: `red:${donde}`, tecnico: e instanceof Error ? e.message : String(e) });
      }
      throw e;
    }
  };
}
