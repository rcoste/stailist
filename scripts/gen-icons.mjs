// Genera los íconos PWA a partir de un monograma "s" en burdeos (tokens del DS).
// One-off: corre en local (mac con Helvetica), commitea los PNG. Producción
// NUNCA rasteriza. Re-correr: node scripts/gen-icons.mjs
import sharp from "sharp";

const BURDEOS = "#722f37";
const CREAM = "#f5f3f0";

// monograma centrado + el "tick" que cita el subrayado del wordmark.
const mark = (full) => `
  ${full
    ? `<rect width="512" height="512" fill="${BURDEOS}"/>`
    : `<rect width="512" height="512" rx="115" fill="${BURDEOS}"/>`}
  <text x="256" y="352" text-anchor="middle"
    font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
    font-size="340" font-weight="600" letter-spacing="-8" fill="${CREAM}">s</text>
  <rect x="196" y="392" width="120" height="16" rx="8" fill="${CREAM}" opacity="0.4"/>`;

const svg = (full) =>
  `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${mark(full)}</svg>`;

const out = [
  { file: "public/icon-192.png", size: 192, full: false },
  { file: "public/icon-512.png", size: 512, full: false },
  { file: "public/icon-maskable-512.png", size: 512, full: true },
  { file: "app/apple-icon.png", size: 180, full: true },
];

for (const { file, size, full } of out) {
  await sharp(Buffer.from(svg(full))).resize(size, size).png().toFile(file);
  console.log(`✓ ${file} (${size}px${full ? ", full-bleed" : ", rounded"})`);
}
