// EL DIAL DE REGISTRO POR PLAN — la capa 2 de las tres capas
// (docs/improvement-loop-del-motor.md, conversación de 2026-08-22).
//
// LA PREGUNTA QUE RESUELVE, con las palabras de Roberto: "para mí algo puede
// ser muy formal y para alguien más no… ¿cómo se calibran los gustos según los
// tipos de planes? No podemos generalizar para todos los usuarios sobre lo que
// yo diga". Cuánto se arregla alguien para UNA cita no es una regla del motor
// ni un gusto del juez: es un dial de ESA persona sobre ESE plan.
//
// EL DEFAULT ES EL CONSENSO (lo que ya dice el catálogo de eventos), y la
// persona lo mueve un paso: "relajado" o "arreglado". Tres posiciones a
// propósito — un slider fino pediría precisión que nadie tiene sobre sí mismo.
//
// PUNTO DE PALANCA: la línea viaja DENTRO de lineaTipoEvento (lib/eventos.ts),
// que comparten el generador, las tres rúbricas, el juez de producción y el
// juez stylist. Una sola edición y la misma vara guía al que arma y al que
// califica — la lección de v56.
export type RegistroPlan = "relajado" | "arreglado";
export type RegistroPorPlan = Record<string, RegistroPlan>;

export const REGISTRO_OPCIONES: { valor: RegistroPlan | null; label: string }[] = [
  { valor: "relajado", label: "más relajado" },
  { valor: null, label: "normal" },
  { valor: "arreglado", label: "más arreglado" },
];

export function registroDe(
  registro: RegistroPorPlan | null | undefined,
  planKey: string | null | undefined
): RegistroPlan | null {
  if (!registro || !planKey) return null;
  const v = registro[planKey];
  return v === "relajado" || v === "arreglado" ? v : null;
}

/**
 * La línea que viaja al motor y a los jueces. Habla del REGISTRO, no de
 * prendas concretas: decirle "no traje" sin decir qué sí fue exactamente lo
 * que rompió v56 — aquí se dice hacia dónde y con la alternativa dentro.
 */
export function lineaRegistro(valor: RegistroPlan | null): string {
  if (valor === "relajado")
    return "SU REGISTRO PARA ESTE PLAN (dicho por la persona, manda sobre la norma): va deliberadamente un paso MÁS RELAJADO que lo típico — prefiere un blazer o piezas sueltas bien puestas sobre el traje completo, y lo simple cuidado sobre lo formal. No la sobre-vistas; el look correcto aquí es el que se ve sin esfuerzo.";
  if (valor === "arreglado")
    return "SU REGISTRO PARA ESTE PLAN (dicho por la persona, manda sobre la norma): le gusta ir un paso MÁS ARREGLADO que lo típico — de lo más puesto del lugar, y el traje o la pieza de sastre son bienvenidos aunque nadie más los lleve. No la sub-vistas; quedarse corto aquí es el error.";
  return "";
}

/**
 * LAS SEÑALES DE DIAL QUE DEJAN LOS ATAJOS DEL VOTAR. "bien, pero muy formal
 * para la ocasión" sobre un look de un plan es una señal DIRECCIONAL (a
 * diferencia del 👎, que no dice hacia dónde): si se repite, el dial de esa
 * persona para ese plan probablemente no está donde el consenso.
 *
 * NO mueve el dial solo: el cruce lo muestra y la persona lo fija de un toque.
 * Mover el perfil en silencio desde un comentario sería decidir por ella — y
 * el manual siempre gana (una señal no distingue "hoy" de "siempre").
 */
export function senalesDeDial(
  looks: { plan: string | null | undefined; comentario: string | null }[]
): { plan: string; hacia: RegistroPlan; n: number }[] {
  const cuenta: Record<string, { relajado: number; arreglado: number }> = {};
  for (const l of looks) {
    if (!l.plan || !l.comentario) continue;
    const c = l.comentario.toLowerCase();
    const e = (cuenta[l.plan] ??= { relajado: 0, arreglado: 0 });
    if (/muy formal para la ocasi/.test(c)) e.relajado++;
    if (/muy casual para la ocasi/.test(c)) e.arreglado++;
  }
  const out: { plan: string; hacia: RegistroPlan; n: number }[] = [];
  for (const [plan, e] of Object.entries(cuenta)) {
    const neto = e.relajado - e.arreglado;
    // ≥2 señales netas en la MISMA dirección: una sola puede ser el look, no
    // la persona; dos ya son un patrón dentro de la ronda.
    if (Math.abs(neto) >= 2) out.push({ plan, hacia: neto > 0 ? "relajado" : "arreglado", n: Math.abs(neto) });
  }
  return out;
}
