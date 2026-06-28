// Extrae el color dominante de la foto de una prenda. Puro (recibe los píxeles
// RGBA + dimensiones; el canvas vive en el cliente). Estrategia v1: pondera el
// centro (la prenda suele estar ahí, el fondo en los bordes), descarta casi-blanco
// (fondo de catálogo) y casi-negro (sombras), cuantiza a 12 bits y toma el bucket
// más frecuente. Limitación conocida: estampados/multicolor → solo el dominante;
// prenda blanca sobre fondo blanco es ambigua.
import { rgbToHex } from "./match";

export function dominantColor(data: Uint8ClampedArray, w: number, h: number): string {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let y = 0; y < h; y++) {
    // Recorta el borde (probable fondo): centro vertical/horizontal.
    if (y < h * 0.12 || y > h * 0.95) continue;
    for (let x = 0; x < w; x++) {
      if (x < w * 0.15 || x > w * 0.85) continue;
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 200) continue; // transparente
      if (r > 244 && g > 244 && b > 244) continue; // casi-blanco (fondo)
      if (r < 16 && g < 16 && b < 16) continue; // casi-negro (sombra)
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); // 12-bit
      const e = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      e.count++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.count > best.count) best = e;
  if (!best) return "#888888"; // todo era fondo/sombra → gris neutro
  return rgbToHex(best.r / best.count, best.g / best.count, best.b / best.count);
}
