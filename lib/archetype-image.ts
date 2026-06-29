// Generación de la imagen flat-lay de un básico (estilo A) con Gemini. Mismo
// prompt que scripts/gen-archetypes.mjs, pero on-demand desde el admin. La
// salida sube a Storage (bucket público), no a public/ (read-only en prod).

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

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
    return `Professional e-commerce flat lay photograph of ${desc}, placed neatly side by side, shot from a slight top-down angle. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The shoes fill about 65% of the frame, centered. No people, no props, no text, no labels.${g}`;
  }
  return `Professional e-commerce flat lay photograph of ${desc}, neatly laid flat and slightly styled, shot directly from above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The garment fills about 70% of the frame, centered. No people, no props, no text, no labels.${g}`;
}

// Genera la imagen y devuelve los bytes JPEG, o null si falla.
export async function generateArchetypeImage(
  desc: string,
  type: ImageType,
  gender?: Gender
): Promise<Buffer | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildImagePrompt(desc, type, gender) }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "1:1" },
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("[archetype-image] Gemini HTTP", res.status);
      return null;
    }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string } }) => p.inlineData?.data
    );
    if (!part?.inlineData?.data) return null;
    return Buffer.from(part.inlineData.data, "base64");
  } catch (err) {
    console.error("[archetype-image] fallo:", err);
    return null;
  }
}
