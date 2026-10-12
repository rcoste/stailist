// LA PRUEBA A/B DEL ONBOARDING CON FOTOS (2026-10-12). El porqué está en la
// migración 0172. Aquí vive lo que se decide en código:
//
// - QUIÉN VA EN CADA LADO: la mitad, por el id de la cuenta y no al azar en
//   cada carga, para que una misma persona caiga siempre del mismo lado aunque
//   recargue. Se asigna una sola vez, al arrancar el onboarding, y se guarda en
//   profiles.onboarding_variante.
// - EL APAGADOR: ONBOARDING_PRUEBA_FOTOS=0 en Vercel deja de asignar 'fotos' a
//   la gente nueva (quien ya la tiene asignada la termina). Sin la variable, la
//   prueba está prendida.
// - CUÁNDO ALCANZA LA ROPA: la misma regla que la lista de básicos (dos de
//   arriba, dos de abajo, unos zapatos): con menos, el motor entrega una sola
//   combinación y el primer look sale pobre.

export type VarianteOnboarding = "basicos" | "fotos";

export const PRUEBA_FOTOS_DESDE = "2026-10-12";

export function pruebaFotosActiva(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ONBOARDING_PRUEBA_FOTOS !== "0";
}

/** Mitad y mitad, estable por id: el primer byte del uuid decide. */
export function elegirVariante(userId: string, activa = pruebaFotosActiva()): VarianteOnboarding {
  if (!activa) return "basicos";
  const byte = parseInt(userId.replace(/-/g, "").slice(0, 2), 16);
  return Number.isNaN(byte) || byte % 2 === 0 ? "basicos" : "fotos";
}

/** null (cuentas de antes de la prueba) se lee como la lista de siempre. */
export function esVarianteFotos(v: string | null | undefined): boolean {
  return v === "fotos";
}

/**
 * ¿Con estas prendas alcanza para looks distintos? Un vestido cuenta como
 * arriba y abajo a la vez. Es la regla de app/onboarding/closet/actions.ts,
 * sacada aquí para que la pantalla de fotos y la lista digan lo mismo.
 */
export function alcanzaParaLooks(categorias: (string | null | undefined)[]): boolean {
  const de = (cat: string) => categorias.filter((c) => c === cat).length;
  const vestidos = de("vestido");
  return de("top") + vestidos >= 2 && de("bottom") + vestidos >= 2 && de("calzado") >= 1;
}

/** Lo que le falta, en palabras, para la pantalla que complementa con la lista. */
export function queFalta(categorias: (string | null | undefined)[]): string[] {
  const de = (cat: string) => categorias.filter((c) => c === cat).length;
  const vestidos = de("vestido");
  const faltan: string[] = [];
  if (de("top") + vestidos < 2) faltan.push("algo de arriba");
  if (de("bottom") + vestidos < 2) faltan.push("algo de abajo");
  if (de("calzado") < 1) faltan.push("unos zapatos");
  return faltan;
}
