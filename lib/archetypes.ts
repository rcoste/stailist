// Resuelve la imagen de un básico según el género del usuario.
//
// Los básicos unisex se guardan con UNA imagen (corte de hombre) en
// /archetypes/<slug>.png. SOLO las prendas donde el corte femenino se nota de
// verdad en un flat-lay (camisas, blazer, suéter, chamarra de mezclilla, botas)
// tienen variante /archetypes/<slug>-mujer.png. Para esas, la mujer ve el corte
// femenino; el hombre (o género nulo) ve la base.
//
// Las prendas genuinamente andróginas (playeras lisas, jeans básicos, tenis…)
// NO tienen variante: una playera blanca acostada se ve igual en ambos géneros,
// así que comparten la imagen base y no vale la pena duplicarlas.
//
// Solo transforma paths estáticos de arquetipo (/archetypes/<slug>.png). Otros
// (p. ej. una URL de Storage de una regeneración del admin) quedan intactos.
export type Gender = "hombre" | "mujer" | null | undefined;

// Básicos unisex con variante de corte femenino. Si agregas más, genera también
// su <slug>-mujer.png con scripts/gen-archetypes.mjs.
const FEMININE_VARIANT_SLUGS = new Set([
  "camisa-blanca",
  "camisa-mezclilla",
  "blazer-azul-marino",
  "sueter-gris",
  "chamarra-mezclilla",
  "botas-negras",
]);

export function archetypeImageForGender(
  segment: string | null | undefined,
  imagePath: string | null | undefined,
  gender: Gender
): string | null {
  if (!imagePath) return imagePath ?? null;
  const match = imagePath.match(/\/archetypes\/([^/]+)\.png$/);
  if (
    segment === "unisex" &&
    gender === "mujer" &&
    match &&
    FEMININE_VARIANT_SLUGS.has(match[1])
  ) {
    return imagePath.replace(/\.png$/, "-mujer.png");
  }
  return imagePath;
}
