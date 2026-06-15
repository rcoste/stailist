// Resuelve la imagen de un básico según el género del usuario.
//
// Los básicos unisex se guardan con UNA imagen (corte de hombre) en
// /archetypes/<slug>.png. La versión con corte femenino vive en
// /archetypes/<slug>-mujer.png. La mujer ve esa; el hombre (o género nulo) ve
// la base. Espejo de looksForGender() en lib/looks.ts.
//
// Solo transforma paths estáticos de arquetipo (/archetypes/<algo>.png). Si el
// image_path es otra cosa (p. ej. una URL de Storage de una regeneración del
// admin) lo deja intacto.
export type Gender = "hombre" | "mujer" | null | undefined;

export function archetypeImageForGender(
  segment: string | null | undefined,
  imagePath: string | null | undefined,
  gender: Gender
): string | null {
  if (!imagePath) return imagePath ?? null;
  if (
    segment === "unisex" &&
    gender === "mujer" &&
    /\/archetypes\/[^/]+\.png$/.test(imagePath)
  ) {
    return imagePath.replace(/\.png$/, "-mujer.png");
  }
  return imagePath;
}
