import { pedirImagen, GEMINI_MODEL_RAPIDO } from "@/lib/gemini-imagen";
// Generación de la imagen flat-lay de un básico (estilo A) con Gemini.
//
// LAS PROHIBICIONES EXPLÍCITAS NO SON PARANOIA (2026-08-14). El prompt decía
// "no people, no props, no text, no labels" y pedía la prenda "slightly
// styled" — y con eso el modelo se sintió libre de: (a) ponerle un pañuelo de
// bolsillo a un saco de traje, que no es un "prop" a sus ojos sino estilismo, y
// (b) inventarle un príncipe de Gales a un pantalón gris liso. Las dos cosas
// aparecieron en el clóset de Roberto y contaminaron el veredicto del
// comparador: al votar creía estar juzgando el look y estaba juzgando prendas
// que no son suyas. Fuera el "slightly styled", y las prohibiciones ahora
// nombran lo que de verdad se colaba. Mismo
// prompt que scripts/gen-archetypes.mjs, pero on-demand desde el admin. La
// salida sube a Storage (bucket público), no a public/ (read-only en prod).


export type ImageType = "flat" | "shoes";
export type Gender = "hombre" | "mujer" | null;

// Sin género, una prenda ambigua (traje de baño, sandalias, etc.) sale de MUJER
// por default en el modelo. Esta cláusula lo desambigua según el usuario.
function genderClause(gender?: Gender): string {
  if (gender === "hombre") return " The piece is menswear (a men's item).";
  if (gender === "mujer") return " The piece is womenswear (a women's item).";
  return "";
}

export function buildImagePrompt(
  desc: string,
  type: ImageType,
  gender?: Gender
): string {
  const g = genderClause(gender);
  if (type === "shoes") {
    return `Professional e-commerce flat lay photograph of ${desc}, placed neatly side by side, shot from a slight top-down angle. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The shoes fill about 65% of the frame, centered. Show ONLY this pair exactly as described: no accessories, and do NOT add any pattern or detail the description does not mention. No people, no props, no text, no labels.${g}`;
  }
  return `Professional e-commerce flat lay photograph of ${desc}, neatly laid flat, shot directly from above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The garment fills about 70% of the frame, centered. Show ONLY this single garment exactly as described: no pocket squares, no accessories, no extra garments, and do NOT add any pattern, print, check or stripe that the description does not mention. No people, no props, no text, no labels.${g}`;
}

// Genera la imagen y devuelve los bytes JPEG, o null si falla.
// La proporción DEBE coincidir con el hueco donde se muestra. Generar 1:1 y
// pintarlo en un tile 3:4 con object-cover amplía la foto ~33% y le come los
// lados: la prenda se ve grande, apretada y "chaparra" (lo cachó Roberto con un
// polo negro). Los tiles de cápsula y clóset son 3:4; el catálogo histórico es
// 1:1, por eso el default no cambia y cada caller pide lo suyo.
export type ImageAspect = "1:1" | "3:4";

export async function generateArchetypeImage(
  desc: string,
  type: ImageType,
  gender?: Gender,
  aspect: ImageAspect = "1:1"
): Promise<Buffer | null> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return null;
  // Por la puerta común (lib/gemini-imagen): tenía SU propia copia del fetch y
  // por eso se quedó sin el reintento y el timeout que el try-on ya tenía. El
  // servicio devuelve 500 intermitentes; sin reintento, cada uno era una prenda
  // que se quedaba sin imagen.
  const r = await pedirImagen(
    [{ text: buildImagePrompt(desc, type, gender) }],
    { modelo: GEMINI_MODEL_RAPIDO, aspecto: aspect }
  );
  if ("motivo" in r) {
    console.error(`[archetype-image] ${r.motivo}`);
    return null;
  }
  return Buffer.from(r.data, "base64");
}
