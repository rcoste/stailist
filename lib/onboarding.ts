import { esVarianteFotos } from "@/lib/onboarding-variante";

// Mapa paso → ruta del onboarding. profiles.onboarding_step lleva la cuenta:
// 0 = sin empezar … 4 = objetivo declarado (falta el wow), 5 = completo.
// El perfil PERMANENTE va primero (gustos, colores, clóset); el objetivo —que
// es del momento— justo antes de generar, para que la petición quede fresca.
// Regla dura del MVP: interrumpir en el paso N y volver = retomas en el paso N.
export const ONBOARDING_ROUTES = [
  "/onboarding/gustos", // step 0 → swipes de looks (tu estilo)
  "/onboarding/colorimetria", // step 1 → tus colores
  "/onboarding/closet", // step 2 → checklist de básicos (lo que tienes)
  "/onboarding/objetivo", // step 3 → qué necesitas HOY
  "/onboarding/wow", // step 4 → primeros outfits generados
] as const;

export const ONBOARDING_COMPLETE = 5;

/**
 * A dónde va alguien en su paso. Con `perfil`, respeta la prueba A/B del
 * onboarding con fotos (lib/onboarding-variante.ts): en la variante 'fotos' el
 * paso 2 no es la lista de básicos sino las 3 fotos, y como subir fotos pide
 * correo (Storage y la IA no abren sin él), un borrador va primero al correo.
 * Sin `perfil` se asume la lista de siempre.
 */
export function routeForStep(
  step: number,
  perfil?: { onboarding_variante?: string | null; email?: string | null } | null
): string {
  if (step >= ONBOARDING_COMPLETE) return "/hoy";
  if (step === 2 && esVarianteFotos(perfil?.onboarding_variante)) {
    return perfil?.email ? "/onboarding/fotos" : "/onboarding/correo";
  }
  return ONBOARDING_ROUTES[Math.max(0, step)];
}
