// LA MARCA EN LA IMAGEN QUE SE COMPARTE (2026-10-16). Cuando un try-on sale de
// la app (WhatsApp, Instagram, la galería), viaja solo: la marca chica en una
// esquina es lo que dice de dónde salió. Es el ciclo de recomendación más
// barato posible. Sólo se pinta en la COPIA que se comparte; la imagen
// guardada en la app no se toca.

export const TEXTO_MARCA = "stailist · stailist.co";

export type MedidasMarca = { fuente: number; padX: number; padY: number; margen: number; radio: number };

/**
 * Tamaños relativos al ancho de la imagen, para que la marca se vea igual de
 * discreta en un render de 768 px que en uno de 1536: legible en el teléfono
 * de quien la recibe, sin competir con el look.
 */
export function medidasDeMarca(ancho: number): MedidasMarca {
  const fuente = Math.max(14, Math.round(ancho * 0.028));
  return {
    fuente,
    padX: Math.round(fuente * 0.6),
    padY: Math.round(fuente * 0.38),
    margen: Math.round(fuente * 0.9),
    radio: Math.round(fuente * 0.2),
  };
}

/** La imagen con la marca abajo a la izquierda, como JPEG. Sólo navegador. */
export async function conMarca(original: Blob, fuenteCss = "Arial, sans-serif"): Promise<Blob> {
  const bmp = await createImageBitmap(original);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(bmp, 0, 0);
  const m = medidasDeMarca(bmp.width);
  ctx.font = `600 ${m.fuente}px ${fuenteCss}`;
  const w = ctx.measureText(TEXTO_MARCA).width + m.padX * 2;
  const h = m.fuente + m.padY * 2;
  const x = m.margen;
  const y = bmp.height - m.margen - h;
  ctx.fillStyle = "rgba(10, 10, 10, 0.6)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, m.radio);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(TEXTO_MARCA, x + m.padX, y + h / 2);
  return await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b ?? original), "image/jpeg", 0.92));
}
