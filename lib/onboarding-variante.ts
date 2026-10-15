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
 * ¿Con estas prendas alcanza para looks distintos? Cuenta COMBINACIONES:
 * (prendas de arriba × prendas de abajo) + vestidos, y pide al menos 3, más
 * unos zapatos. Es la regla de app/onboarding/closet/actions.ts, sacada aquí
 * para que la pantalla de fotos y la lista digan lo mismo.
 *
 * ANTES UN VESTIDO CONTABA COMO "ARRIBA" Y COMO "ABAJO" A LA VEZ (hasta el
 * 2026-10-14), y eso dejaba pasar clósets con sólo dos looks posibles: blusa,
 * shorts, vestido y tenis sumaban "2 de arriba y 2 de abajo" pero sólo dan
 * blusa+shorts o vestido+tenis. El motor necesita dos looks distintos que
 * además pasen sus filtros (clima, ocasión); con dos combinaciones justas
 * cualquiera lo tumba. Pasó el 12 de octubre en la variante de fotos: una
 * persona vio fallar su primer look 4 veces seguidas y se fue, otra lo logró
 * al segundo intento. Con 3 combinaciones hay margen; la lista de básicos
 * (2×2 = 4) pasa igual que antes.
 */
export const COMBINACIONES_MINIMAS = 3;

function cuenta(categorias: (string | null | undefined)[]) {
  const de = (cat: string) => categorias.filter((c) => c === cat).length;
  return { top: de("top"), bottom: de("bottom"), vestido: de("vestido"), calzado: de("calzado") };
}

const combinaciones = (c: { top: number; bottom: number; vestido: number }) => c.top * c.bottom + c.vestido;

export function alcanzaParaLooks(categorias: (string | null | undefined)[]): boolean {
  const c = cuenta(categorias);
  return combinaciones(c) >= COMBINACIONES_MINIMAS && c.calzado >= 1;
}

/**
 * Lo que le falta, en palabras, para la pantalla que complementa con la lista.
 * Pide lo que MÁS combinaciones suma: con una blusa y tres pantalones, otra
 * prenda de arriba da tres looks más; otro pantalón, sólo uno.
 */
export function queFalta(categorias: (string | null | undefined)[]): string[] {
  const c = { ...cuenta(categorias) };
  const faltan: string[] = [];
  while (combinaciones(c) < COMBINACIONES_MINIMAS) {
    // Suma por el lado que multiplica más; si empatan, arriba primero.
    const porArriba = (c.top + 1) * c.bottom - c.top * c.bottom;
    const porAbajo = c.top * (c.bottom + 1) - c.top * c.bottom;
    if (c.top === 0 || porArriba >= porAbajo) {
      c.top += 1;
      if (!faltan.includes("algo de arriba")) faltan.push("algo de arriba");
    } else {
      c.bottom += 1;
      if (!faltan.includes("algo de abajo")) faltan.push("algo de abajo");
    }
  }
  if (c.calzado < 1) faltan.push("unos zapatos");
  return faltan;
}
