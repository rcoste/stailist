// Ciencia de color para el chequeo de la Cartera: hex → CIELAB y deltaE (CIEDE2000),
// más checkColor() que clasifica el color de una prenda contra la paleta del usuario.
// Puro (sin DOM) → testeable y reutilizable client o server.
import type { Swatch } from "@/lib/palette-data";

export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function rgbToLab([r, g, b]: RGB): Lab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  // sRGB → XYZ (D65)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) * 100;
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) * 100;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) * 100;
  // XYZ → Lab (D65 ref white)
  const Xn = 95.047, Yn = 100, Zn = 108.883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number) => (d * Math.PI) / 180;

// Diferencia perceptual CIEDE2000 (0 = idéntico; ~2 imperceptible; >20 distinto).
export function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p0 = (Math.atan2(b1, a1p) * 180) / Math.PI;
  const h1p = h1p0 >= 0 ? h1p0 : h1p0 + 360;
  const h2p0 = (Math.atan2(b2, a2p) * 180) / Math.PI;
  const h2p = h2p0 >= 0 ? h2p0 : h2p0 + 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    let d = h2p - h1p;
    if (d > 180) d -= 360;
    else if (d < -180) d += 360;
    dhp = d;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp = hbarp < 360 ? hbarp + 360 : hbarp - 360;
    hbarp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
}

export type Verdict = "va" | "no-ideal" | "parecido";

export type CheckResult = {
  garmentHex: string;
  verdict: Verdict;
  nearestVa: Swatch; // el "que sí va" más cercano
  alternatives: Swatch[]; // top 3 "que sí van" por cercanía
  nearEvita: Swatch | null; // el "evita" más cercano (si el veredicto es no-ideal)
};

// Umbrales v1 (deltaE2000), tuneables. Las paletas son discretas, así que una
// prenda rara vez cae EXACTO sobre un swatch; por eso "va" no es <2 sino <12.
const VA_THRESHOLD = 12;
const EVITA_THRESHOLD = 16;

export function checkColor(garmentHex: string, va: Swatch[], evita: Swatch[]): CheckResult {
  const g = rgbToLab(hexToRgb(garmentHex));
  const rank = (arr: Swatch[]) =>
    arr
      .map((s) => ({ s, d: deltaE2000(g, rgbToLab(hexToRgb(s.hex))) }))
      .sort((a, b) => a.d - b.d);

  const vaSorted = rank(va);
  const evitaSorted = evita.length ? rank(evita) : [];
  const dVa = vaSorted[0]?.d ?? Infinity;
  const dEvita = evitaSorted[0]?.d ?? Infinity;

  let verdict: Verdict;
  if (dVa <= VA_THRESHOLD) verdict = "va";
  else if (dEvita < dVa && dEvita <= EVITA_THRESHOLD) verdict = "no-ideal";
  else verdict = "parecido";

  return {
    garmentHex,
    verdict,
    nearestVa: vaSorted[0].s,
    alternatives: vaSorted.slice(0, 3).map((x) => x.s),
    nearEvita: verdict === "no-ideal" ? evitaSorted[0]?.s ?? null : null,
  };
}
