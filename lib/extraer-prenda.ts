import { pedirImagen, GEMINI_MODEL } from "@/lib/gemini-imagen";

// EXTRAER UNA PRENDA DE UNA FOTO — imagen→imagen, en un solo lugar.
//
// POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE LA RUTA
// Vivía dentro de app/api/render-prenda/route.ts, y mientras esa ruta fuera la
// única que lo usaba, ahí estaba bien. Dejó de estarlo el día que la foto
// original empezó a guardarse: desde entonces CUALQUIER prenda del clóset puede
// volver a su fuente, no sólo la que se acaba de dar de alta. Copiarlo a la
// segunda ruta habría sido la cuarta copia del mismo prompt en este repo — el
// mismo error que ya costó caro con el fetch de Gemini.
//
// POR QUÉ IMAGEN→IMAGEN Y NO TEXTO→IMAGEN
// Describir la prenda en palabras pierde la prenda: hay mil cortes de saco
// negro y "saco negro" no distingue ninguno. Pasándole la FOTO, el modelo copia
// el color real, el corte real y los detalles reales, y el texto sólo sirve
// para señalar CUÁL de las prendas de la foto extraer. Esa es justo la razón
// por la que el esmoquin de Roberto se puede arreglar: su foto trae el traje
// entero, y aquí se le dice "sólo el saco".
export type PrendaAExtraer = {
  /** Qué prenda sacar de la foto: la descripción visual, o el nombre. */
  quePrenda: string;
  categoria?: string;
  /** El color CONFIRMADO manda sobre lo que diga la luz de la foto. */
  color?: string;
  /** 1:1 para el alta (grid de dos columnas), 3:4 para las fichas del clóset. */
  aspecto?: "1:1" | "3:4";
};

/**
 * Devuelve el flat-lay de esa prenda, o null si falla.
 *
 * Falla hacia null a propósito: quien llama decide si cae a texto→imagen o si
 * marca el render como fallido. Aquí no se sabe cuál de las dos toca.
 */
export async function extraerPrendaDeFoto(
  foto: { base64: string; mediaType: string },
  prenda: PrendaAExtraer
): Promise<Buffer | null> {
  const encuadre =
    prenda.categoria === "calzado"
      ? "placed neatly side by side, shot from a slight top-down angle, filling about 65% of the frame"
      : "neatly laid flat and slightly styled, shot directly from above, filling about 70% of the frame";

  const que = prenda.color ? `${prenda.quePrenda}, en color ${prenda.color}` : prenda.quePrenda;

  const prompt = `From the photo of the person, isolate ONLY this single garment they are wearing: ${que}. Produce a professional e-commerce flat lay photograph of just that one garment, ${encuadre}. CRITICAL: preserve the garment's exact real-world color, cut, silhouette, fabric, texture, pattern and distinctive details (collar, sleeves, buttons, zipper, sole, etc.) exactly as seen on the person — do not redesign it, do not change its style. Remove the person, any other garments, and the background entirely. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. No people, no props, no text, no labels.`;

  const r = await pedirImagen(
    [{ text: prompt }, { inlineData: { mimeType: foto.mediaType, data: foto.base64 } }],
    { modelo: GEMINI_MODEL, aspecto: prenda.aspecto ?? "1:1" }
  );
  if ("motivo" in r) {
    console.error(`[extraer-prenda] ${r.motivo}`);
    return null;
  }
  return Buffer.from(r.data, "base64");
}
