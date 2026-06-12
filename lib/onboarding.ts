// Mapa paso → ruta del onboarding. profiles.onboarding_step lleva la cuenta:
// 0 = sin empezar … 4 = checklist hecho (falta el wow), 5 = completo.
// Regla dura del MVP: interrumpir en el paso N y volver = retomas en el paso N.
export const ONBOARDING_ROUTES = [
  "/onboarding/objetivo", // step 0 → declara qué necesita
  "/onboarding/gustos", // step 1 → swipes de looks
  "/onboarding/colorimetria", // step 2 → quiz de 4 estaciones
  "/onboarding/closet", // step 3 → checklist de básicos
  "/onboarding/wow", // step 4 → primeros outfits generados
] as const;

export const ONBOARDING_COMPLETE = 5;

export function routeForStep(step: number): string {
  if (step >= ONBOARDING_COMPLETE) return "/hoy";
  return ONBOARDING_ROUTES[Math.max(0, step)];
}
