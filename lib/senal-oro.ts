// La señal de oro por CERCANÍA (decisión de Roberto, 2026-08-11): un fit check
// subido a ≤24h de un look generado cuenta como "se puso lo que le sugerí".
//
// Por qué existe: la pregunta "¿te lo pusiste ayer?" murió con el rediseño del
// home (era un favor que casi nadie contestaba — el worn explícito se quedó en
// <10%). El fit check sí pasa, y trae la foto como prueba. La cercanía temporal
// es el puente: si te armé un look y al día siguiente me enseñas tu outfit, lo
// más probable es que sea ese.
//
// Lógica PURA (sin DB): el admin le pasa las fechas y esto solo cuenta.

export const VENTANA_SENAL_ORO_MS = 24 * 60 * 60 * 1000;

/**
 * Cuántos fit checks cayeron dentro de la ventana DESPUÉS de algún look
 * generado del mismo usuario. Cada fit check cuenta una sola vez aunque tenga
 * varios looks cerca; un fit check ANTES del look no cuenta (no puedes ponerte
 * lo que aún no te sugiero).
 */
export function contarSenalOroPorCercania(
  looksGenerados: { userId: string; createdAt: string }[],
  fitChecks: { userId: string; createdAt: string }[]
): number {
  // Fechas de looks por usuario, para no cruzar el look de Tatiana con el fit
  // check de Toño.
  const porUsuario = new Map<string, number[]>();
  for (const look of looksGenerados) {
    const t = Date.parse(look.createdAt);
    if (Number.isNaN(t)) continue;
    const lista = porUsuario.get(look.userId);
    if (lista) lista.push(t);
    else porUsuario.set(look.userId, [t]);
  }

  let cuenta = 0;
  for (const fc of fitChecks) {
    const t = Date.parse(fc.createdAt);
    if (Number.isNaN(t)) continue;
    const looks = porUsuario.get(fc.userId);
    if (looks?.some((lt) => t >= lt && t - lt <= VENTANA_SENAL_ORO_MS)) cuenta++;
  }
  return cuenta;
}
