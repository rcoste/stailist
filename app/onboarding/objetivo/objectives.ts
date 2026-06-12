// Las 5 opciones cerradas de "¿Qué necesitas hoy?". Viven fuera de actions.ts
// porque un archivo "use server" solo puede exportar funciones async.
export const OBJECTIVES = {
  diario: "Día a día",
  oficina: "Oficina",
  evento: "Un evento",
  viaje: "Viaje",
  refrescar: "Refrescar mi estilo",
} as const;

export type Objective = keyof typeof OBJECTIVES;
