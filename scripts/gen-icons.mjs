// Genera los íconos PWA con el mark de marca v2: tile burdeos + gancho (símbolo
// de clóset, cream) + "ai" (Bodoni, cream) — fiel a assets/brand/app-icon.svg
// del handoff. One-off: corre en local, commitea los PNG. Producción NUNCA
// rasteriza. Re-correr: node scripts/gen-icons.mjs
import sharp from "sharp";

const BURDEOS = "#722f37";
const CREAM = "#f5f3f0";

// El mark sobre un tile (rounded para "any", full-bleed para maskable/apple).
const mark = (full) => `
  ${full
    ? `<rect width="100" height="100" fill="${BURDEOS}"/>`
    : `<rect width="100" height="100" rx="23" fill="${BURDEOS}"/>`}
  <g stroke="${CREAM}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 30a5 5 0 1 1 5-5"/>
    <path d="M50 30L22 53H78L50 30z"/>
  </g>
  <text x="50" y="82" text-anchor="middle"
    font-family="'Bodoni Moda','Times New Roman',serif" font-weight="600"
    font-size="30" letter-spacing="-1" fill="${CREAM}">ai</text>`;

const svg = (full) =>
  `<svg width="512" height="512" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${mark(full)}</svg>`;

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
