// CUÁNTO TARDA CADA TRAMO DEL ONBOARDING, EN MEDIANA.
//
// POR QUÉ EXISTE
// El criterio #1 del experimento es "primer look en menos de 2 minutos", y
// hasta la auditoría del 2026-09-01 el único número era un TTV total que
// además se medía mal (desde que pedías el código, no desde que abrías la
// app). Un total no dice DÓNDE se va el tiempo; esta tabla sí: reconstruye,
// por persona, el reloj entre cada paso y saca la mediana de cada tramo.
//
// Lo que salió la primera vez que se calculó a mano (n=18): gustos 143 s,
// colorimetría 105 s, básicos 113 s, objetivo 9 s, generación 47 s. El 77% es
// onboarding declarativo; el motor es el 10%. Roberto decidió no recortar el
// onboarding — está bien: esta tabla existe para que la decisión se pueda
// revisar con el número delante, no para forzarla.
//
// Función pura sobre los eventos crudos: se prueba con casos, no con la base.

export type EventoPaso = {
  user_id: string;
  created_at: string;
  type: "onboarding_started" | "onboarding_step";
  data: { step?: number; paso?: string } | null;
};

/** Los tramos, en el orden en que se viven. La llave es el paso que CIERRA. */
export const TRAMOS: { llave: string; etiqueta: string }[] = [
  { llave: "genero", etiqueta: "abrió la app → género" },
  { llave: "edad", etiqueta: "género → edad" },
  { llave: "1", etiqueta: "edad → gustos (swipes)" },
  { llave: "2", etiqueta: "gustos → colorimetría" },
  { llave: "3", etiqueta: "colorimetría → básicos" },
  { llave: "4", etiqueta: "básicos → objetivo" },
  { llave: "5", etiqueta: "objetivo → primer look" },
];

/** Más de esto entre dos pasos es "se fue y volvió otro día", no un tramo. */
export const TOPE_TRAMO_S = 2 * 60 * 60;

export type TramoMedido = {
  llave: string;
  etiqueta: string;
  /** Mediana en segundos, o null si nadie completó el tramo con reloj sano. */
  medianaS: number | null;
  n: number;
};

export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

/** La llave del tramo que un evento cierra, o null si no cierra ninguno. */
function llaveDe(e: EventoPaso): string | null {
  if (e.type === "onboarding_started") return "inicio";
  const paso = e.data?.paso;
  if (paso === "genero" || paso === "edad") return paso;
  const step = e.data?.step;
  if (typeof step === "number" && step >= 1 && step <= 5) return String(step);
  return null;
}

/**
 * Reconstruye el reloj de cada persona y devuelve la mediana por tramo.
 *
 * Para cada persona se toma el PRIMER evento de cada llave (repetir un paso no
 * lo hace más rápido) y el tramo es la resta contra la llave anterior en el
 * orden de TRAMOS. Un tramo mayor que TOPE_TRAMO_S se descarta: es alguien que
 * cerró la app y volvió al día siguiente, y meterlo aplasta la mediana igual
 * que aplastaba el promedio del TTV viejo.
 */
export function tiemposPorTramo(eventos: EventoPaso[]): TramoMedido[] {
  const porPersona = new Map<string, Map<string, number>>();
  for (const e of eventos) {
    const llave = llaveDe(e);
    if (!llave) continue;
    const t = new Date(e.created_at).getTime();
    if (Number.isNaN(t)) continue;
    const reloj = porPersona.get(e.user_id) ?? new Map<string, number>();
    const previo = reloj.get(llave);
    if (previo === undefined || t < previo) reloj.set(llave, t);
    porPersona.set(e.user_id, reloj);
  }

  const orden = ["inicio", ...TRAMOS.map((t) => t.llave)];
  return TRAMOS.map((tramo, i) => {
    const desde = orden[i];
    const hasta = tramo.llave;
    const muestras: number[] = [];
    for (const reloj of porPersona.values()) {
      const a = reloj.get(desde);
      const b = reloj.get(hasta);
      if (a === undefined || b === undefined) continue;
      const s = Math.round((b - a) / 1000);
      if (s < 0 || s > TOPE_TRAMO_S) continue;
      muestras.push(s);
    }
    return { llave: hasta, etiqueta: tramo.etiqueta, medianaS: mediana(muestras), n: muestras.length };
  });
}

/** "1m 43s" — para la tabla del admin. */
export function fmtSegundos(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}
