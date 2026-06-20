// Las 5 opciones cerradas de "¿Qué necesitas hoy?". Viven fuera de actions.ts
// porque un archivo "use server" solo puede exportar funciones async.
export const OBJECTIVES = {
  diario: "Día a día",
  oficina: "Oficina",
  evento: "Un evento",
  // "Aeropuerto" (no "Viaje") para no chocar con la pestaña Modo viaje (la maleta).
  // Aquí es una ocasión de un día: vísteme cómodo para andar viajando hoy.
  viaje: "Aeropuerto",
  refrescar: "Refrescar mi estilo",
} as const;

export type Objective = keyof typeof OBJECTIVES;
