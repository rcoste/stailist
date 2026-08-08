// ¿EL CONTADOR DE PERSONAS AVISA CUANDO DEBE Y CALLA CUANDO DEBE?
//
// El aviso de "sale alguien más en esta foto" sólo sirve si se le cree, y sólo
// se le cree si no grita en las fotos donde sales sola. O sea que hay que medir
// las dos direcciones, no sólo la que uno quiere que funcione.
//
// EL BANCO SE ARMA CON IMÁGENES DEL PROPIO REPO, pegadas lado a lado. No es un
// lujo: no hay fotos reales de dos personas a mano, y esperar a tenerlas es
// como no medir. Los seis casos cubren lo que el flujo va a ver de verdad —
// prendas extendidas, una persona, y varias— más el que se equivoca solo.
//
// EL CASO QUE IMPORTA es "LA MISMA persona dos veces". Salió de una medición
// fallida: el primer banco pegaba dos fotos de la MISMA modelo con dos outfits
// distintos, el modelo contestó 1 las tres veces y lo di por error. No lo era —
// es una persona, fotografiada dos veces, y el modelo tenía razón. Se quedó
// como caso permanente porque es exactamente el selfie de espejo y la rejilla
// de outfits, donde avisar sería avisar de más.
//
// RESULTADO (2026-08-08, gemini-3.1-flash-lite, 3 corridas por caso): 18/18 en
// la decisión de avisar, y 18/18 también en el conteo exacto.
//
// Correr:  npx tsx scripts/personas-en-foto.ts
// Requiere python3 con PIL para armar los compuestos (sólo para la prueba).

import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
) as Record<string, string>;
for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

const HOMBRE = "public/ab/1-a.png";
const MUJER = "public/wardrobe/b1-look1.png";
const MUJER2 = "public/landing/look-casual.png";
const MUJER2_OTRO_LOOK = "public/landing/maleta-look-1.png";
const PRENDA = "public/wardrobe/jeans-wide-indigo.png";

const RECETA = `
import sys
from PIL import Image
S = sys.argv[1]
def load(p, h=900):
    im = Image.open(p).convert("RGB")
    return im.resize((int(im.width * h / im.height), h))
def side(paths, out):
    ims = [load(p) for p in paths]
    W = sum(i.width for i in ims); H = max(i.height for i in ims)
    c = Image.new("RGB", (W, H), (235, 233, 230)); x = 0
    for i in ims:
        c.paste(i, (x, 0)); x += i.width
    c.save(out, "JPEG", quality=88)
side(["${PRENDA}"], S + "/prenda.jpg")
side(["${MUJER2}"], S + "/una.jpg")
side(["${MUJER2}", "${MUJER2_OTRO_LOOK}"], S + "/misma-dos-veces.jpg")
side(["${HOMBRE}", "${MUJER}"], S + "/dos.jpg")
side(["${HOMBRE}", "${MUJER}", "${MUJER2}"], S + "/tres.jpg")
`;

async function main() {
  const { contarPersonas } = await import("../lib/vision-personas");
  const { VISION_MODEL } = await import("../lib/models");

  const dir = mkdtempSync(join(tmpdir(), "personas-"));
  execFileSync("python3", ["-c", RECETA, dir], { stdio: "inherit" });

  const casos = [
    { f: "prenda.jpg", esp: 0, que: "unos jeans solos (flat-lay)" },
    { f: "una.jpg", esp: 1, que: "una persona" },
    { f: "misma-dos-veces.jpg", esp: 1, que: "LA MISMA persona 2 veces" },
    { f: "dos.jpg", esp: 2, que: "dos personas distintas" },
    { f: "tres.jpg", esp: 3, que: "tres personas distintas" },
  ];

  let bienDecide = 0;
  let bienCuenta = 0;
  let total = 0;
  for (const c of casos) {
    const base64 = readFileSync(join(dir, c.f)).toString("base64");
    // Tres corridas: un acierto solo puede ser suerte, y estos modelos no son
    // deterministas (es la misma lección del control de ruido de la deriva).
    const r = await Promise.all(
      [0, 1, 2].map(() => contarPersonas({ mediaType: "image/jpeg", base64 }, VISION_MODEL))
    );
    // Lo que DECIDE el aviso es ">1 o no", no el número exacto: da igual si son
    // tres o cuatro, el aviso y el remedio (recortar) son los mismos.
    const debe = c.esp > 1;
    const decide = r.filter((x) => x > 1 === debe).length;
    const cuenta = r.filter((x) => x === c.esp).length;
    bienDecide += decide;
    bienCuenta += cuenta;
    total += 3;
    const marca = decide === 3 ? "✅" : decide === 0 ? "❌" : "⚠️ ";
    console.log(
      `${marca} ${c.que.padEnd(30)} esperado ${c.esp} → [${r.join(", ")}] · decide ${decide}/3 · cuenta ${cuenta}/3`
    );
  }
  console.log(`\ndecisión de avisar: ${bienDecide}/${total}   ← es lo que importa`);
  console.log(`conteo exacto:      ${bienCuenta}/${total}`);
}

main();
