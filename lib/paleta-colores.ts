// LA PALETA DE CORRECCIÓN, Y CUÁLES ENSEÑAR PRIMERO.
//
// Idea de Roberto, y es la correcta: "no tiene caso en cada prenda mostrar las
// mismas opciones de color; algo que cae entre negro o gris pudiera
// confundirse, pero nunca con rosa o amarillo". Las doce opciones fijas hacían
// buscar entre colores que nadie iba a elegir jamás.
//
// LA SALVEDAD QUE NO SE NEGOCIA: los vecinos se ofrecen primero, pero la paleta
// completa está SIEMPRE a un tap. Filtrar por cercanía da por hecho que la
// lectura es aproximadamente correcta — que es justo lo que falla cuando más
// falta hace corregir. Un saco marino fotografiado con luz cálida se puede leer
// "café", y ahí el color bueno NO está entre los vecinos del café. Si el filtro
// cerrara la puerta, el único error que de verdad importa sería el único
// imposible de arreglar.
//
// EL ORDEN SE CALCULA EN OKLab, NO EN RGB, y no es un detalle: en RGB los
// colores oscuros y desaturados —negro, carbón, marino, café chocolate— caen
// todos cerca unos de otros, así que los "vecinos" de un gris carbón saldrían
// mal ordenados exactamente en la familia donde se necesita precisión. Es el
// mismo defecto que obligó a reescribir la regla de cueros.

import { distanciaPerceptual } from "@/lib/engine/color-perceptual";

export type ColorPaleta = { name: string; hex: string };

/**
 * Los atajos de corrección. NO son el vocabulario de color del producto: el
 * color real de una prenda es el hex que leyó la visión, que casi nunca es
 * ninguno de éstos. Esto es sólo "no, es más bien…".
 *
 * "Gris oscuro" está porque faltaba de verdad: el carbón es media sastrería
 * masculina (trajes, abrigos, pantalones de vestir) y el único gris disponible
 * era uno de en medio, así que corregir con él ACLARABA la prenda.
 */
export const PALETA: ColorPaleta[] = [
  { name: "Negro", hex: "#1A1A1A" },
  { name: "Gris oscuro", hex: "#3A3A3C" },
  { name: "Gris", hex: "#8A8A8A" },
  { name: "Blanco", hex: "#F2F2F2" },
  { name: "Azul marino", hex: "#1F2A44" },
  { name: "Azul", hex: "#3B5BA5" },
  { name: "Beige", hex: "#C8B89E" },
  { name: "Café", hex: "#6B4F3A" },
  { name: "Verde", hex: "#3E5641" },
  { name: "Vino", hex: "#5E2A33" },
  { name: "Rosa", hex: "#C98B9E" },
];

/**
 * Los `n` colores de la paleta más parecidos al leído, del más cercano al
 * menos.
 *
 * Sin hex legible devuelve los primeros `n` tal cual: sin un color de
 * referencia no hay vecindad que calcular, y quedarse sin opciones sería peor
 * que ofrecer unas cualesquiera.
 */
export function coloresCercanos(hex: string | null | undefined, n = 4): ColorPaleta[] {
  const conDistancia = PALETA.map((c) => ({ c, d: distanciaPerceptual(hex, c.hex) }));
  if (conDistancia.some((x) => x.d === null)) return PALETA.slice(0, n);
  return conDistancia
    .sort((a, b) => (a.d as number) - (b.d as number))
    .slice(0, n)
    .map((x) => x.c);
}
