// LEER LOS RECIBOS DE IA: de filas sueltas a las tres preguntas que importan.
//
// La tabla `ai_calls` (migración 0133) guarda un renglón por llamada. Esto es
// la aritmética que convierte esos renglones en respuestas, y vive aparte de la
// pantalla por la razón de siempre en este repo: el markup cambia con cada
// rediseño, y lo que no puede cambiar en silencio es CÓMO se cuenta un promedio
// o qué se considera "caro".
//
// LAS TRES PREGUNTAS (son las de la migración, ahora contestables):
//   1. ¿Cuánto tarda de verdad cada tarea? — para diseñar esperas honestas.
//   2. ¿Qué cuesta cada una? — el proyecto ya se llevó sustos de factura.
//   3. ¿Cada cuánto truena un proveedor? — y cuánto tarda en tronar.

export type AiCall = {
  created_at: string;
  tarea: string;
  proveedor: string;
  modelo: string;
  version: string | null;
  ms: number;
  tokens_entrada: number | null;
  tokens_salida: number | null;
  costo_usd: number | null;
  ok: boolean;
};

export type ResumenTarea = {
  tarea: string;
  llamadas: number;
  fallos: number;
  /** 0-100. */
  tasaFallo: number;
  /** Mediana de ms de los ÉXITOS. */
  msMediana: number;
  /** p95 de ms de los éxitos: la espera que sufre la persona con mala suerte. */
  msP95: number;
  /** Mediana de ms de los FALLOS (0 si no hubo). */
  msMedianaFallo: number;
  costoTotal: number;
  /** Costo medio por llamada exitosa; null si ningún modelo tenía precio. */
  costoPorLlamada: number | null;
  modelos: string[];
};

/**
 * Percentil por interpolación lineal sobre una lista YA ordenada.
 *
 * Con pocas muestras —que es exactamente el caso de este proyecto— el método
 * importa: con 4 llamadas, "el p95" tomado como el elemento en la posición 0.95
 * es siempre el máximo, y entonces la pantalla presenta el peor dato como si
 * fuera una medida robusta. Interpolar al menos deja ver que el número está
 * entre dos observaciones reales.
 */
export function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0;
  if (ordenados.length === 1) return ordenados[0];
  const pos = (ordenados.length - 1) * p;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return ordenados[bajo];
  return Math.round(ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo));
}

export const mediana = (ordenados: number[]): number => percentil(ordenados, 0.5);

/**
 * Una fila por tarea, ordenadas por gasto (que es como se decide dónde mirar).
 *
 * Los tiempos se calculan SOLO sobre los éxitos, y los fallos se reportan
 * aparte. Mezclarlos miente en las dos direcciones a la vez: un timeout de 60s
 * infla la mediana de una tarea que va bien, y un fallo instantáneo (falta la
 * llave, 400 del proveedor) la baja y hace ver rápido lo que ni siquiera
 * corrió.
 */
export function resumenPorTarea(filas: AiCall[]): ResumenTarea[] {
  const porTarea = new Map<string, AiCall[]>();
  for (const f of filas) {
    const lista = porTarea.get(f.tarea);
    if (lista) lista.push(f);
    else porTarea.set(f.tarea, [f]);
  }

  const salida: ResumenTarea[] = [];
  for (const [tarea, lista] of porTarea) {
    const ok = lista.filter((f) => f.ok);
    const fallidas = lista.filter((f) => !f.ok);
    const msOk = ok.map((f) => f.ms).sort((a, b) => a - b);
    const msFallo = fallidas.map((f) => f.ms).sort((a, b) => a - b);
    const costoTotal = lista.reduce((s, f) => s + (f.costo_usd ?? 0), 0);
    // Solo promedia sobre las que SÍ tenían precio: dividir el costo entre
    // todas cuando la mitad son de un modelo sin tarifa conocida da un número
    // que se ve creíble y está mal (ver el comentario de PRECIOS).
    const conPrecio = ok.filter((f) => f.costo_usd !== null);
    salida.push({
      tarea,
      llamadas: lista.length,
      fallos: fallidas.length,
      tasaFallo: lista.length ? Math.round((100 * fallidas.length) / lista.length) : 0,
      msMediana: mediana(msOk),
      msP95: percentil(msOk, 0.95),
      msMedianaFallo: mediana(msFallo),
      costoTotal,
      costoPorLlamada: conPrecio.length
        ? conPrecio.reduce((s, f) => s + (f.costo_usd ?? 0), 0) / conPrecio.length
        : null,
      modelos: [...new Set(lista.map((f) => f.modelo))].sort(),
    });
  }
  return salida.sort((a, b) => b.costoTotal - a.costoTotal || b.llamadas - a.llamadas);
}

export type Totales = {
  llamadas: number;
  fallos: number;
  tasaFallo: number;
  costo: number;
  /** Gasto de las últimas 24h, para ver un pico el día que ocurre. */
  costo24h: number;
  llamadas24h: number;
};

export function totales(filas: AiCall[], ahoraMs: number): Totales {
  const corte = ahoraMs - 24 * 60 * 60 * 1000;
  const recientes = filas.filter((f) => new Date(f.created_at).getTime() >= corte);
  const fallos = filas.filter((f) => !f.ok).length;
  return {
    llamadas: filas.length,
    fallos,
    tasaFallo: filas.length ? Math.round((100 * fallos) / filas.length) : 0,
    costo: filas.reduce((s, f) => s + (f.costo_usd ?? 0), 0),
    costo24h: recientes.reduce((s, f) => s + (f.costo_usd ?? 0), 0),
    llamadas24h: recientes.length,
  };
}

/** Milisegundos como los diría una persona: "1.4s", "820ms", "1m 12s". */
export function fmtMs(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
