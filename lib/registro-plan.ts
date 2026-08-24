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
