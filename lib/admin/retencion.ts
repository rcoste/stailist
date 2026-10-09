// LA TABLA DE RETENCIÓN: qué días después de empezar vuelve a entrar cada quien.
//
// Nació de Roberto (2026-10-09): "una tabla de retención para ver cuándo
// vuelven a entrar los usuarios: el que entró el día 1 vuelve el día 2, luego
// el 3, o el día no sé". Una fila por persona, una columna por día desde que
// empezó, y arriba el porcentaje que vuelve el día 1, 2, 3, 7 y 14.
//
// Las reglas, para que el número cuadre con el resto del admin:
//
// - "ENTRAR" ES EL MISMO CRITERIO DEL PLAN (lib/admin/adquisicion.ts): cualquier
//   rastro (eventos salvo EVENTOS_QUE_NO_SON_VOLVER, prendas, looks), en días de
//   la Ciudad de México, y del día 1 en adelante sólo si fue al menos 4 horas
//   después de empezar. Así un onboarding de las 11:50 pm que sigue a las 12:10
//   no cuenta como volver al día siguiente. El SQL entrega los días ya así.
//
// - EL DENOMINADOR ES QUIEN YA VIVIÓ ESE DÍA COMPLETO. Quien empezó ayer no
//   puede haber vuelto el día 7, y contarlo como "no volvió" hundiría la curva
//   con gente que todavía no tiene cómo. El día que corre hoy tampoco cuenta:
//   puede entrar más tarde.

/** Lo que el SQL dice de cada persona. */
export type PersonaRetencion = {
  id: string;
  etiqueta: string;
  /** Día (de la Ciudad de México) en que empezó el onboarding, "YYYY-MM-DD". */
  diaInicio: string;
  /** Días después de empezar en que entró (1 = el día siguiente), sin repetir. */
  dias: number[];
};

/** Las columnas de la tabla: del día 0 al 14. */
export const DIAS_TABLA = 14;
/** Los días que resume la curva de arriba. */
export const DIAS_CURVA = [1, 2, 3, 7, 14] as const;

/** Días de calendario entre dos "YYYY-MM-DD". */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export type Celda = "entro" | "no" | "futuro";

/**
 * La fila de una persona: qué pasó cada día. El día 0 siempre es "entró"
 * (ahí empezó); los días que todavía no llegan, o que corren hoy sin rastro
 * todavía, son "futuro".
 */
export function fila(p: PersonaRetencion, hoy: string, n: number = DIAS_TABLA): Celda[] {
  const vivido = diasEntre(p.diaInicio, hoy);
  const entro = new Set(p.dias);
  return Array.from({ length: n + 1 }, (_, d) => {
    if (d === 0 || entro.has(d)) return "entro";
    return d >= vivido ? "futuro" : "no";
  });
}

export type PuntoCurva = { dia: number; volvieron: number; de: number };

/** Cuántas volvieron el día N, entre quienes ya vivieron ese día completo. */
export function curva(personas: PersonaRetencion[], hoy: string): PuntoCurva[] {
  return DIAS_CURVA.map((dia) => {
    const elegibles = personas.filter((p) => diasEntre(p.diaInicio, hoy) > dia);
    return { dia, volvieron: elegibles.filter((p) => p.dias.includes(dia)).length, de: elegibles.length };
  });
}

/**
 * Volvió AL MENOS UNA VEZ en su primera semana, entre quienes ya la cerraron.
 * Es el número del criterio de paro, pero sin filtrar por primer look: aquí
 * entra toda persona que empezó el onboarding.
 */
export function volvieronEnSuSemana(personas: PersonaRetencion[], hoy: string): { volvieron: number; de: number } {
  const cerradas = personas.filter((p) => diasEntre(p.diaInicio, hoy) > 7);
  return { volvieron: cerradas.filter((p) => p.dias.some((d) => d >= 1 && d <= 7)).length, de: cerradas.length };
}
