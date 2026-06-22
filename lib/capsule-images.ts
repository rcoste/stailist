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

// Familia de color (texto de la cápsula ideal, p. ej. "marino", "neutro claro")
// → hex aproximado para el swatch del clóset cuando sumas una prenda que no tiene
// foto. Matching por subcadena sobre el slug; cae a un neutro cálido si no acierta.
const FAMILIA_HEX: [string, string][] = [
  ["negro", "#1A1A1A"],
  ["blanco", "#F2F2F2"],
  ["hueso", "#ECE7DE"],
  ["crema", "#E7DDC8"],
  ["marino", "#1F2A44"],
  ["azul claro", "#9DB4D4"],
  ["azul", "#3B5BA5"],
  ["gris", "#8A8A8A"],
  ["carbon", "#3A3A3C"],
  ["camel", "#C8A877"],
  ["beige", "#C8B89E"],
  ["chocolate", "#4B3526"],
  ["cafe", "#6B4F3A"],
  ["verde", "#3E5641"],
  ["esmeralda", "#1F6B4A"],
  ["oliva", "#6B6A3A"],
  ["vino", "#5E2A33"],
  ["rojo", "#9B2D2D"],
  ["rosa", "#C98B9E"],
  ["morado", "#5B4673"],
  ["mostaza", "#B8902F"],
  ["neutro claro", "#D9D2C7"],
  ["neutro", "#9B9591"],
];

export function familiaToHex(familia: string): string {
  const s = slug(familia);
  for (const [name, hex] of FAMILIA_HEX) if (s.includes(name)) return hex;
  return "#C9BFB2"; // neutro cálido por defecto
}
