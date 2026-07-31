// Baja las candidatas cosechadas de Pinterest y descarta las que no sirven
// como referencia de outfit.
//
// La cosecha vive en el navegador (ver el flujo con la extensión de Chrome):
// de cada búsqueda saco el hash de 32 chars de la imagen. La ruta de i.pinimg
// se DERIVA del hash — /736x/<0..2>/<2..4>/<4..6>/<hash>.jpg — así que con el
// hash basta y el transporte de texto se reduce a la mitad.
//
// El filtro NO es de gusto (para eso está la curaduría humana): descarta lo que
// técnicamente no sirve para leer un outfit — flat-lays sin cuerpo, collages,
// cuadrados de producto, y todo lo que llegue en baja resolución.
//
// Uso: node scripts/cosecha-pinterest.mjs <estilo> <hash,hash,hash...>

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [estilo, lista] = process.argv.slice(2);
if (!estilo || !lista) {
  console.error("Uso: node scripts/cosecha-pinterest.mjs <estilo> <hashes separados por coma>");
  process.exit(1);
}

const DESTINO = `docs_para_claude/cosecha-hombre/${estilo}`;
mkdirSync(DESTINO, { recursive: true });

const url = (h) =>
  `https://i.pinimg.com/736x/${h.slice(0, 2)}/${h.slice(2, 4)}/${h.slice(4, 6)}/${h}.jpg`;

// Una referencia de outfit es una foto de cuerpo: vertical y con suficiente
// resolución para distinguir el corte de la prenda. Lo cuadrado suele ser
// producto o collage; lo chico no deja leer detalles.
const MIN_ANCHO = 400;
const MIN_ALTO = 600;
const RATIO_MAX = 0.9; // ancho/alto — más que esto ya es cuadrado

const hashes = [...new Set(lista.split(",").map((h) => h.trim()).filter(Boolean))];
let ok = 0;
const descartes = [];

for (const h of hashes) {
  const destino = `${DESTINO}/${h.slice(0, 8)}.jpg`;
  if (existsSync(destino)) {
    ok++;
    continue;
  }
  try {
    execFileSync("curl", ["-sS", "--max-time", "20", "-o", destino, url(h)]);
    const dims = execFileSync("python3", [
      "-c",
      `from PIL import Image;im=Image.open("${destino}");print(im.size[0],im.size[1])`,
    ])
      .toString()
      .trim()
      .split(" ")
      .map(Number);
    const [w, alto] = dims;
    if (w < MIN_ANCHO || alto < MIN_ALTO || w / alto > RATIO_MAX) {
      execFileSync("rm", ["-f", destino]);
      descartes.push(`${h.slice(0, 8)} ${w}x${alto}`);
      continue;
    }
    ok++;
  } catch {
    execFileSync("rm", ["-f", destino]);
    descartes.push(`${h.slice(0, 8)} error`);
  }
}

console.log(`${estilo}: ${ok} sirven, ${descartes.length} descartadas de ${hashes.length}`);
if (descartes.length) console.log(`  descartes: ${descartes.slice(0, 8).join(", ")}`);
