// Optimiza los PNG del catálogo en su lugar: resize a 720px + PNG palette
// (lossy, dither) → ~3-4x más ligeros, MISMO nombre/ruta (cero cambios en BD ni
// código). Acelera el primer pintado (el optimizador de Next lee menos px/bytes).
// Idempotente: salta lo ya optimizado (≤720px y <260KB). Reusar tras agregar
// imágenes nuevas: node scripts/optimize-images.mjs
import { readdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";

const DIRS = ["public/archetypes", "public/capsula-falta"];
const MAX = 720;
const SKIP_BYTES = 260 * 1024; // ya optimizado → no re-encodear (evita pérdida acumulada)

const sharpMod = (await import("sharp")).default;

let before = 0,
  after = 0,
  done = 0,
  skipped = 0;

for (const dir of DIRS) {
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".png"));
  } catch {
    continue;
  }
  for (const f of files) {
    const path = join(dir, f);
    const size = statSync(path).size;
    const meta = await sharpMod(path).metadata();
    if ((meta.width ?? 9999) <= MAX && size < SKIP_BYTES) {
      skipped++;
      continue;
    }
    const tmp = path + ".tmp";
    await sharpMod(path)
      .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true })
      .png({ quality: 85, compressionLevel: 9, palette: true, dither: 0.5 })
      .toFile(tmp);
    const newSize = statSync(tmp).size;
    renameSync(tmp, path);
    before += size;
    after += newSize;
    done++;
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`Optimizadas: ${done} · saltadas (ya ligeras): ${skipped}`);
console.log(`Peso: ${mb(before)} MB → ${mb(after)} MB  (${before ? Math.round((1 - after / before) * 100) : 0}% menos)`);
