// QUÉ SE COMPARTE Y CÓMO (2026-10-16). Lógica pura, para que el evento
// `compartido` sólo lleve valores conocidos: el admin los cuenta y un texto
// libre los partiría en categorías que nadie lee.
//
// - `que`: el try-on a pantalla completa o el pasaporte de estilo (los dos
//   botones de compartir que existen hoy).
// - `como`: "share" = el diálogo del teléfono terminó (la persona eligió a
//   dónde mandarlo; cancelar no cuenta), "descarga" = lo guardó como archivo
//   (escritorio, o "guardar imagen"), "link" = copió el link de la app.

export const QUE_SE_COMPARTE = ["tryon", "pasaporte"] as const;
export const COMO_SE_COMPARTE = ["share", "descarga", "link"] as const;

export type QueSeComparte = (typeof QUE_SE_COMPARTE)[number];
export type ComoSeComparte = (typeof COMO_SE_COMPARTE)[number];

/** Los datos del evento, o null si algo no es de la lista (no se guarda). */
export function datosDeCompartido(que: unknown, como: unknown): { que: QueSeComparte; como: ComoSeComparte } | null {
  if (!QUE_SE_COMPARTE.includes(que as QueSeComparte)) return null;
  if (!COMO_SE_COMPARTE.includes(como as ComoSeComparte)) return null;
  return { que: que as QueSeComparte, como: como as ComoSeComparte };
}
