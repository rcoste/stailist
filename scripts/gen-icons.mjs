// Genera los íconos PWA con el mark de marca v3 (Gen-Z monocromo): tile tinta
// #0a0a0a + gancho-destello blanco (la percha que se vuelve destello, el mismo
// símbolo del botón "armar mi look"). Fiel a design_handoff_identidad_v3/
// assets/app-icon.svg. One-off: corre en local, commitea los PNG. Producción
// NUNCA rasteriza. Re-correr: node scripts/gen-icons.mjs
import sharp from "sharp";

const INK = "#0a0a0a";
const WHITE = "#ffffff";

// El mark sobre un tile (rounded para "any", full-bleed para maskable/apple).
// El símbolo se escala alrededor del centro con un translate explícito
// (translate = (1-scale)/2*48) en vez de CSS transform-origin, para que
// librsvg/sharp lo rastericen igual que el browser. El maskable usa un scale
// menor para que el símbolo quepa en la zona segura (círculo de radio 40%) que
// Android puede recortar; los demás van a 0.78 como el asset del handoff.
const mark = (full, scale) => {
  const t = ((1 - scale) / 2) * 48;
  return `
  ${full
    ? `<rect width="48" height="48" fill="${INK}"/>`
    : `<rect width="48" height="48" rx="11" fill="${INK}"/>`}
  <g fill="none" stroke="${WHITE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(${t.toFixed(2)},${t.toFixed(2)}) scale(${scale})">
    <path d="M26 8l.9 2.5 2.5.9-2.5.9L26 14.8l-.9-2.5-2.5-.9 2.5-.9z" fill="${WHITE}" stroke="none"/>
    <path d="M24 17c0-.9-.3-1.7-.9-2.3"/>
    <path d="M24 17 7 30.5a1.4 1.4 0 0 0 .9 2.5h32.2a1.4 1.4 0 0 0 .9-2.5L24 17z"/>
  </g>`;
};

const svg = (full, scale) =>
  `<svg width="512" height="512" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${mark(full, scale)}</svg>`;

const out = [
  { file: "public/icon-192.png", size: 192, full: false, scale: 0.78 },
  { file: "public/icon-512.png", size: 512, full: false, scale: 0.78 },
  { file: "public/icon-maskable-512.png", size: 512, full: true, scale: 0.62 },
  { file: "app/apple-icon.png", size: 180, full: true, scale: 0.78 },
];

for (const { file, size, full, scale } of out) {
  await sharp(Buffer.from(svg(full, scale))).resize(size, size).png().toFile(file);
  console.log(`✓ ${file} (${size}px${full ? ", full-bleed" : ", rounded"}, scale ${scale})`);
}
