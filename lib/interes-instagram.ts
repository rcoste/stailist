// PRUEBA DE INTERÉS: "¿te armamos tu clóset desde Instagram?" (2026-10-16,
// migración 0178). La lógica pura: a quién se le enseña la tarjeta y qué se
// guarda. La regla para leerla está escrita en la migración y en la memoria
// del proyecto ANTES de ver un solo número.

/** Sólo a quien todavía no tiene su ropa: con 10+ prendas propias ya no le sirve. */
export const UMBRAL_PRENDAS = 10;
/** En cuántos días distintos se enseña como máximo. */
export const MAX_VISTAS = 3;

export type EstadoInteres = {
  prendasPropias: number;
  vistas: number;
  dijoSi: boolean;
  dijoNo: boolean;
  fotosBloqueadas: boolean;
};

export function mostrarTarjetaIg(e: EstadoInteres): boolean {
  if (e.fotosBloqueadas || e.dijoSi || e.dijoNo) return false;
  if (e.prendasPropias >= UMBRAL_PRENDAS) return false;
  return e.vistas < MAX_VISTAS;
}

/** "@tu.usuario_1" → "tu.usuario_1". Lo que no parece un usuario de Instagram, null. */
export function normalizarUsuarioIg(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  const u = entrada.trim().replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(u) ? u.toLowerCase() : null;
}

/** Lo que va al evento `ig_interes_si`: el usuario SÓLO si dio permiso. */
export function datosDeInteres(usuario: unknown, consiente: unknown): { usuario?: string; consiente: boolean } {
  const ok = consiente === true;
  const u = ok ? normalizarUsuarioIg(usuario) : null;
  return u ? { usuario: u, consiente: true } : { consiente: ok };
}
