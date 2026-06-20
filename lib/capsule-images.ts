// Imágenes curadas para prendas que te FALTAN en la cápsula. Una prenda "falta"
// no está en tu clóset, así que no tiene foto — esto te deja VISUALIZAR lo que te
// falta. Es un mapa sembrado a mano (NO se genera por usuaria: auto-generar
// imágenes de cosas-a-comprar sería la zona de "compras" cortada del MVP). Lo que
// no esté aquí cae al indicador de siempre (un aro). Las imágenes viven en
// public/capsula-falta, en el mismo estilo flat-lay que el catálogo.

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (café → cafe)
    .trim();

// Clave: `${tipo}|${colorFamilia}` normalizado (sin acentos, minúsculas).
const FALTA_IMAGES: Record<string, string> = {
  "cuello-tortuga|negro": "/capsula-falta/cuello-tortuga-negro.png",
  "sueter|esmeralda": "/capsula-falta/sueter-esmeralda.png",
  "chino|cafe": "/capsula-falta/chino-chocolate.png",
};

export function faltaImage(item: { tipo: string; colorFamilia: string }): string | null {
  return FALTA_IMAGES[`${slug(item.tipo)}|${slug(item.colorFamilia)}`] ?? null;
}
