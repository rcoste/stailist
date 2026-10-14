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

// ─── ¿Lo que trae en el espejo ES el look que le sugerí? ────────────────────
//
// POR QUÉ EXISTE (2026-10-14): el primer fit check de una persona de anuncios
// se leyó como "se puso un look". No lo era: subió el espejo 9 minutos después
// de generar, con jeans y tenis grises, y el look más cercano era una falda
// midi con mules. Compartían una camiseta de tirantes. La regla de cercanía de
// arriba lo cuenta igual como señal de oro, y el `worn` que escribe el espejo
// también. Esto no cambia esa cuenta (es la decisión del 2026-08-11); le pone
// al lado el dato que la confirma o la desmiente, para que nadie celebre de
// más mirando un número.
//
// CON SOMBRERO DE STYLIST: un look es la combinación, no una prenda suelta.
// Repetir la camiseta básica no es ponerse el look; llevar dos de sus tres
// piezas, sí. Por eso el umbral es dos tercios del LOOK sugerido (no del
// espejo) y al menos dos prendas.

export type LookSugerido = { id: string; titulo: string | null; itemIds: string[]; createdAt: string };

export type ParecidoConSugerido =
  /** No hubo ningún look generado en las 24 h anteriores. */
  | { tipo: "sin-look" }
  /** Hubo look, pero el espejo no tiene prendas confirmadas para comparar. */
  | { tipo: "sin-prendas"; titulo: string | null; minutosAntes: number }
  | {
      tipo: "comparte";
      titulo: string | null;
      enComun: number;
      total: number;
      minutosAntes: number;
      /** Se puso el look: ≥ 2 prendas y ≥ 2/3 de las del look sugerido. */
      esElLook: boolean;
    };

export function parecidoConSugerido(
  espejo: { itemIds: string[]; createdAt: string },
  looks: LookSugerido[]
): ParecidoConSugerido {
  const t = Date.parse(espejo.createdAt);
  const previos = looks
    .map((l) => ({ ...l, t: Date.parse(l.createdAt) }))
    .filter((l) => !Number.isNaN(l.t) && l.t <= t && t - l.t <= VENTANA_SENAL_ORO_MS);
  if (previos.length === 0) return { tipo: "sin-look" };

  const minutos = (lt: number) => Math.round((t - lt) / 60_000);
  const masCercano = previos.reduce((a, b) => (b.t > a.t ? b : a));
  if (espejo.itemIds.length === 0) {
    return { tipo: "sin-prendas", titulo: masCercano.titulo, minutosAntes: minutos(masCercano.t) };
  }

  const puestas = new Set(espejo.itemIds);
  // El que más prendas comparte; a empate, el más reciente.
  const mejor = previos
    .map((l) => ({ l, enComun: l.itemIds.filter((id) => puestas.has(id)).length }))
    .reduce((a, b) => (b.enComun > a.enComun || (b.enComun === a.enComun && b.l.t > a.l.t) ? b : a));
  const total = mejor.l.itemIds.length;
  return {
    tipo: "comparte",
    titulo: mejor.l.titulo,
    enComun: mejor.enComun,
    total,
    minutosAntes: minutos(mejor.l.t),
    esElLook: mejor.enComun >= 2 && total > 0 && mejor.enComun * 3 >= total * 2,
  };
}

/** En palabras, para el admin. */
export function parecidoEnPalabras(p: ParecidoConSugerido): string {
  const hace = (m: number) => (m < 60 ? `${m} min antes` : `${Math.round(m / 60)} h antes`);
  if (p.tipo === "sin-look") return "su ropa: no tenía un look sugerido en las 24 h previas";
  if (p.tipo === "sin-prendas") return `no confirmó sus prendas; el último look sugerido fue «${p.titulo ?? "Look"}», ${hace(p.minutosAntes)}`;
  if (p.esElLook) return `se puso el look sugerido «${p.titulo ?? "Look"}» (${p.enComun} de ${p.total} prendas, sugerido ${hace(p.minutosAntes)})`;
  return `su ropa, no el look: comparte ${p.enComun} de ${p.total} prendas con «${p.titulo ?? "Look"}» (sugerido ${hace(p.minutosAntes)})`;
}
