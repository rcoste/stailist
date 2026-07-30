// A dónde regresar al terminar una pantalla de inversión (avatar, estilo,
// silueta). Vive aparte porque el checklist de Home encadena varias de esas
// pantallas y todas necesitan la misma validación.
//
// El bug que lo motiva (feedback de Alberto, 2026-07-30): el checklist de Home
// te manda a crear tu avatar y, al terminar, el wizard te dejaba en Perfil. Sus
// palabras: "se rompió la continuidad de lo que iba a hacer… los pasos
// incompletos se sentían como que me iban a generar un atuendo pero acabó con
// el modelo en 3D". El paso se completa pero pierdes el hilo de los otros
// cuatro.
//
// Guard anti open-redirect: solo rutas internas ("/" y no "//host") y solo las
// del allowlist. Se compara el PATHNAME y se conserva la query — el onboarding
// manda "/onboarding/wow?look=<id>" para retomar ESE look al volver, y comparar
// el string completo nunca hacía match (caía al fallback y rompía el flujo).

/** Los destinos válidos de regreso en toda la app. */
export const RETURNS_VALIDOS = new Set([
  "/hoy",
  "/perfil",
  "/onboarding/wow",
]);

export function safeReturn(
  ret: string | undefined,
  fallback = "/perfil",
  permitidos: Set<string> = RETURNS_VALIDOS
): string {
  if (!ret || !ret.startsWith("/") || ret.startsWith("//")) return fallback;
  const path = ret.split(/[?#]/)[0];
  return permitidos.has(path) ? ret : fallback;
}

/** La etiqueta del "← volver" según a dónde regresa. */
export function returnLabel(returnTo: string): string {
  const path = returnTo.split(/[?#]/)[0];
  if (path === "/hoy") return "Hoy";
  if (path === "/perfil") return "Perfil";
  return "Volver";
}
