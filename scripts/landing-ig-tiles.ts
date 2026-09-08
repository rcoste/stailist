// TILES DE LA LANDING DESDE UNA FOTO REAL (2026-09-08).
//
// La sección "03 · Tu ropa de verdad" enseña "de esa foto salen estas 3". Para
// que no sea un montaje, los tres tiles salen del MISMO pipeline que usa el
// carrete en producción: leerPrendas (visión) lista lo que trae puesto la
// persona, y extraerPrendaDeFoto (imagen→imagen) dibuja el flat-lay de cada
// una a partir de la foto original. Sin retoque a mano.
//
// Uso:  npx tsx scripts/landing-ig-tiles.ts <foto.jpg> <prefijo>
// Escribe public/landing/<prefijo>-foto.png y un tile por CADA prenda leída:
// public/landing/<prefijo>-<n>-<categoria>.png (Roberto: "no sólo 3, todas,
// para que se sienta la funcionalidad"). Cuesta ~$0.13 por prenda.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
async function main() {
  const { leerPrendas } = await import("../lib/vision-prendas");
  const { extraerPrendaDeFoto } = await import("../lib/extraer-prenda");
  const { VISION_MODEL } = await import("../lib/models");

  const [ruta, prefijo = "ig"] = process.argv.slice(2);
  if (!ruta) {
    console.error("Uso: npx tsx scripts/landing-ig-tiles.ts <foto.jpg> <prefijo>");
    process.exit(1);
  }
  const bytes = readFileSync(ruta);
  const mediaType = ruta.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const foto = { base64: bytes.toString("base64"), mediaType };

  const { prendas, recibo } = await leerPrendas(foto, VISION_MODEL, null);
  console.log(`leídas ${prendas.length} prendas ($${recibo.costoUsd?.toFixed(4) ?? "?"}):`);
  for (const p of prendas) console.log(`  · [${p.categoria}] ${p.nombre} — ${p.color}`);

  // Copia de la foto como asset de la landing (a PNG, como el resto de la carpeta).
  execFileSync("sips", ["-s", "format", "png", "-Z", "1600", ruta, "--out", `public/landing/${prefijo}-foto.png`], { stdio: "ignore" });
  console.log(`→ public/landing/${prefijo}-foto.png`);

  let n = 0;
  for (const p of prendas) {
    n += 1;
    const que = ((p as { descripcion?: string }).descripcion ?? "").trim() || p.nombre;
    const render = await extraerPrendaDeFoto(foto, { quePrenda: que, categoria: p.categoria, color: p.color, aspecto: "1:1" }, null);
    if (!render) { console.warn(`  falló el render de ${p.nombre}`); continue; }
    const tmp = `/tmp/${prefijo}-${n}.jpg`;
    writeFileSync(tmp, render);
    const salida = `public/landing/${prefijo}-${n}-${p.categoria}.png`;
    execFileSync("sips", ["-s", "format", "png", "-Z", "720", tmp, "--out", salida], { stdio: "ignore" });
    console.log(`→ ${salida}  (${p.nombre})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
