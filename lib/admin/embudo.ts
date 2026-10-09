// EL EMBUDO POR PASOS: a dónde llega la gente, cuánto tarda y dónde se queda.
//
// Nació de Roberto (2026-10-09): "poder ver una vista de funnel de los
// usuarios: a dónde están llegando, cuánto tardan, qué se atoran". El panel de
// campaña ya tenía el embudo de ANTES de la cuenta (landing → botón → correo,
// en lib/embudo-marcas.ts), pero nada del onboarding paso a paso: los números
// de esta pantalla se sacaban a mano con SQL en cada conversación (8.3 min de
// mediana al primer look, la lista de básicos perdiendo 10 de 47).
//
// Tres decisiones que importan al leer los números:
//
// 1. LLEGAR ES MONÓTONO. Quien llegó al paso 7 cuenta como que pasó por el 1-6,
//    aunque falte el evento de alguno: el onboarding cambió con el tiempo (la
//    pregunta de "cómo nos conociste" es de septiembre) y sin esta regla una
//    cuenta vieja "saltaría" pasos y el embudo subiría en vez de bajar.
//
// 2. "SE QUEDÓ EN ESTA PANTALLA" = terminó el paso ANTERIOR y no éste, y no ha
//    hecho nada en MINUTOS_EN_CURSO. Cada paso se registra al TERMINAR su
//    pantalla, así que quien contestó la colorimetría y no las prendas se quedó
//    en la pantalla de prendas (la primera versión lo ponía en colorimetría, y
//    la lista de básicos parecía inocente). Quien sigue moviéndose está "en
//    curso": si no, cada persona a la mitad del onboarding saldría como pérdida.
//
// 3. VOLVER ES EL MISMO CRITERIO DEL PLAN (lib/admin/adquisicion.ts): otro día
//    de la Ciudad de México, al menos 4 horas después de empezar y dentro de 7
//    días. Quien empezó hace menos de 7 días y no ha vuelto todavía puede
//    hacerlo, así que se cuenta aparte y no como pérdida.

import { DIAS_VENTANA } from "@/lib/admin/adquisicion";

export const PASOS = [
  { id: "inicio", label: "empezó el onboarding" },
  { id: "genero", label: "género" },
  { id: "edad", label: "edad" },
  { id: "conocio", label: "cómo nos conoció" },
  { id: "swipes", label: "swipes de looks" },
  { id: "colorimetria", label: "colorimetría" },
  { id: "prendas", label: "prendas básicas" },
  { id: "correo", label: "confirmó su correo" },
  { id: "objetivo", label: "objetivo" },
  { id: "primer_look", label: "llegó a su primer look" },
  { id: "foto", label: "subió una foto de su ropa" },
  { id: "volvio", label: "volvió otro día" },
] as const;

export type PasoId = (typeof PASOS)[number]["id"];

/** Sin actividad en este rato, quien se detuvo en un paso "se quedó" ahí. */
export const MINUTOS_EN_CURSO = 30;

/** Un evento del onboarding tal como sale de `events`. */
export type EventoPaso = { type: string; data: Record<string, unknown> | null; at: string };

/**
 * Qué paso marca un evento, o null si no marca ninguno.
 *
 * `onboarding_step` trae `paso` en las pantallas nuevas y sólo `step` en las
 * viejas. El 3 es doble: sin `paso` es la lista de básicos y con
 * `paso: "correo"` es el correo confirmado (lib: app/onboarding/correo/actions).
 */
export function pasoDeEvento(e: EventoPaso): PasoId | null {
  if (e.type === "onboarding_started") return "inicio";
  if (e.type === "first_outfit_ttv") return "primer_look";
  if (e.type !== "onboarding_step") return null;
  const d = e.data ?? {};
  const paso = typeof d.paso === "string" ? d.paso : null;
  if (paso === "genero" || paso === "edad" || paso === "conocio" || paso === "correo") return paso;
  if (paso) return null;
  switch (Number(d.step)) {
    case 1:
      return "swipes";
    case 2:
      return "colorimetria";
    case 3:
      return "prendas";
    case 4:
      return "objetivo";
    case 5:
      return "primer_look";
  }
  return null;
}

/** Lo que se sabe de una persona para el embudo. */
export type PersonaEmbudo = {
  id: string;
  etiqueta: string;
  eventos: EventoPaso[];
  /** Primera prenda que subió con foto (ISO), o null. */
  primeraFoto: string | null;
  /** Primer regreso válido (ISO), o null. Lo calcula el SQL con el criterio del plan. */
  volvio: string | null;
  /** Último rastro de cualquier tipo (ISO). */
  ultimaActividad: string;
};

export type FilaEmbudo = {
  id: PasoId;
  label: string;
  llegaron: number;
  /** Mediana de segundos desde el paso anterior, entre quienes tienen los dos. */
  medianaSeg: number | null;
  /** Terminaron el paso anterior, no éste, y llevan MINUTOS_EN_CURSO sin moverse. */
  seQuedaron: { id: string; etiqueta: string }[];
  /** Terminaron el anterior, no éste, y se movieron hace poco. */
  enCurso: number;
  /** Sólo en "volvió": quienes aún están dentro de su semana y no han vuelto. */
  aunPueden?: number;
};

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Cuándo pasó cada persona por cada paso (la PRIMERA vez). */
export function tiemposDe(p: PersonaEmbudo): Partial<Record<PasoId, string>> {
  const t: Partial<Record<PasoId, string>> = {};
  for (const e of p.eventos) {
    const paso = pasoDeEvento(e);
    if (paso && (!t[paso] || e.at < t[paso]!)) t[paso] = e.at;
  }
  // La foto sólo cuenta DESPUÉS del primer look: es el paso que sigue.
  if (p.primeraFoto && t.primer_look && p.primeraFoto >= t.primer_look) t.foto = p.primeraFoto;
  if (p.volvio) t.volvio = p.volvio;
  return t;
}

export function construirEmbudo(personas: PersonaEmbudo[], ahora: Date = new Date()): FilaEmbudo[] {
  const filas: FilaEmbudo[] = PASOS.map((p) => ({
    id: p.id,
    label: p.label,
    llegaron: 0,
    medianaSeg: null,
    seQuedaron: [],
    enCurso: 0,
  }));
  const deltas: number[][] = PASOS.map(() => []);
  let aunPueden = 0;

  for (const p of personas) {
    const t = tiemposDe(p);
    // El paso más lejano al que llegó: de ahí para atrás, todos cuentan.
    let lejano = -1;
    PASOS.forEach((paso, i) => {
      if (t[paso.id]) lejano = i;
    });
    if (lejano < 0) continue;
    for (let i = 0; i <= lejano; i++) filas[i].llegaron++;
    for (let i = 1; i <= lejano; i++) {
      const a = t[PASOS[i - 1].id];
      const b = t[PASOS[i].id];
      if (a && b && b >= a) deltas[i].push((Date.parse(b) - Date.parse(a)) / 1000);
    }

    const iPrimerLook = PASOS.findIndex((x) => x.id === "primer_look");
    const inicio = t.inicio ? Date.parse(t.inicio) : null;
    const dentroDeSuSemana = inicio != null && ahora.getTime() - inicio < DIAS_VENTANA * 86_400_000;
    // Después del primer look, no volver todavía no es quedarse si la semana sigue abierta.
    if (!t.volvio && lejano >= iPrimerLook && dentroDeSuSemana) aunPueden++;

    if (lejano === PASOS.length - 1) continue;
    const quieto = ahora.getTime() - Date.parse(p.ultimaActividad) > MINUTOS_EN_CURSO * 60_000;
    // Donde se detuvo es la pantalla SIGUIENTE a la última que terminó.
    const donde = filas[lejano + 1];
    if (!quieto) donde.enCurso++;
    else if (!(lejano >= iPrimerLook && dentroDeSuSemana)) {
      donde.seQuedaron.push({ id: p.id, etiqueta: p.etiqueta });
    }
  }
  filas.forEach((f, i) => {
    const m = mediana(deltas[i]);
    f.medianaSeg = m == null ? null : Math.round(m);
  });
  filas[filas.length - 1].aunPueden = aunPueden;
  return filas;
}

/** 84 → "1m 24s"; 8 → "8s"; 3900 → "1h 5m". */
export function duracion(seg: number | null): string {
  if (seg == null) return "—";
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.floor(seg / 60)}m ${seg % 60}s`;
  return `${Math.floor(seg / 3600)}h ${Math.floor((seg % 3600) / 60)}m`;
}
