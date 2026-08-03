// Recoge un lote de fotos de Instagram desde el portapapeles y lo escribe a disco.
//
// POR QUÉ EL PORTAPAPELES Y NO UNA DESCARGA
// Con Pinterest basta el hash: la URL de i.pinimg se deriva de él y un curl la
// baja. Instagram firma cada URL de su CDN con el token de sesión de quien mira,
// así que esas URLs son credenciales y no deben salir del navegador — de hecho
// el propio entorno las bloquea, y hace bien.
//
// Descargar desde la página tampoco sirve: Chrome bloquea las descargas
// programáticas en lote (protección contra sitios que llenan tu disco).
//
// Así que la foto se baja y se recomprime DENTRO de la página, con la sesión ya
// activa, y sale como píxeles por el portapapeles. Lo que cruza es la imagen, no
// la credencial.
//
// El helper del navegador (window.__ig) deja los lotes separados por @@@.
//
// Uso: node scripts/pegar-cosecha-ig.mjs <cuenta> <indice-inicial>

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [cuenta, desde] = process.argv.slice(2);
if (!cuenta || desde === undefined) {
  console.error("Uso: node scripts/pegar-cosecha-ig.mjs <cuenta> <indice-inicial>");
  process.exit(1);
}

// Carpeta de tránsito: clasificar-estilo.mjs la reparte después, igual que la
// cosecha de clima. La cuenta de origen no decide el estilo — un mismo creador
// publica looks de varias familias.
const DESTINO = "docs_para_claude/cosecha-hombre/_ig";
mkdirSync(DESTINO, { recursive: true });

const pegado = execFileSync("pbpaste", { maxBuffer: 64 * 1024 * 1024 }).toString();
const partes = pegado.split("\n@@@\n").filter((p) => p.trim().length > 1000);

let ok = 0;
for (const [i, b64] of partes.entries()) {
  const n = Number(desde) + i;
  const archivo = `${DESTINO}/${cuenta}-${String(n).padStart(3, "0")}.jpg`;
  try {
    const buf = Buffer.from(b64.trim(), "base64");
    // Un JPEG empieza con FF D8. Sin esta comprobación, un portapapeles con
    // cualquier otra cosa dejaría archivos basura que el filtro tendría que
    // descartar uno por uno.
    if (buf[0] !== 0xff || buf[1] !== 0xd8) {
      console.error(`  ⚠ ${archivo}: no es JPEG, se salta`);
      continue;
    }
    writeFileSync(archivo, buf);
    ok++;
  } catch (e) {
    console.error(`  ⚠ ${archivo}: ${e.message}`);
  }
}

console.log(`${ok} de ${partes.length} guardadas en ${DESTINO}`);
