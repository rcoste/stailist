// Paletas AMPLIAS por sub-estación (12 = estación × profundidad), organizadas por
// FAMILIA DE TONO (azules, verdes, rosas, cafés, neutros…) para comparar contra
// prendas reales en tienda. Son COLORES DE ROPA (datos), no tokens de UI.
//
// Arquitectura: se cura un MASTER rico por estación (la "estación verdadera" =
// medium). Las variantes light/dark se derivan con un shift de luminosidad en HSL
// (light = más claro/suave, dark = más profundo). Da amplitud consistente sin
// curar 400 hex a mano; v1, tuneable. La sub-estación se conserva en cada color
// vía subPalette(season, depth).
import { seasonPalette, normSeason, type Season, type Depth } from "./colorimetria";
import { deltaE2000, hexToRgb, rgbToLab } from "./color/match";

// Familias por TONO (Roberto: verdes, azules, rosas, rojos, cafés, morados,
// amarillos, naranjas, grises, blancos, cremas). "evita" es aparte.
export type HueFamily =
  | "blancos"
  | "cremas"
  | "grises"
  | "cafes"
  | "amarillos"
  | "naranjas"
  | "rojos"
  | "rosas"
  | "morados"
  | "azules"
  | "verdes";

export type Swatch = { nombre: string; hex: string };

export const FAMILY_LABEL: Record<HueFamily, string> = {
  blancos: "Blancos",
  cremas: "Cremas",
  grises: "Grises",
  cafes: "Cafés",
  amarillos: "Amarillos",
  naranjas: "Naranjas",
  rojos: "Rojos",
  rosas: "Rosas",
  morados: "Morados",
  azules: "Azules",
  verdes: "Verdes",
};

export const FAMILY_ORDER: HueFamily[] = [
  "blancos", "cremas", "grises", "cafes",
  "amarillos", "naranjas", "rojos", "rosas", "morados", "azules", "verdes",
];

type Hues = Partial<Record<HueFamily, Swatch[]>>;
type SeasonLib = { reveal: string; hues: Hues; evita: Swatch[] };

export type SubPalette = {
  reveal: string;
  familias: Hues;
  evita: Swatch[];
  // Guiños: los colores prestados de la estación vecina (el flow). Vacío si no
  // hay flow. La estación del guiño viaja aparte para etiquetar la fila.
  guinos: Swatch[];
  guinoSeason: Season | null;
};

// ───────────── HSL helpers (para el shift de profundidad) ─────────────
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0, hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return [hue, s * 100, l * 100];
}

function hslToHex(hue: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

// Shift de profundidad: medium = master tal cual; light = más claro y un pelo
// menos saturado; dark = más profundo y un pelo más saturado. Modesto a propósito
// (la sub-estación es sutil; no queremos que "invierno claro" se vuelva pastel).
//
// LOS NEUTROS NO SE MUEVEN, y los cromáticos no se hunden hasta el negro.
// Roberto (2026-08-22), viendo su cartera de "Invierno oscuro": el "Blanco
// puro" salía #E2E2CC —un verdoso sucio— y "Pino" y "Berenjena" quedaban en
// #030907 y #110812, negros con nombre de color. Un invierno profundo no tiene
// blancos sucios: tiene CONTRASTE, y el blanco puro es justo lo suyo. Por eso
// el shift se salta blancos/cremas/grises (ver subPalette) y, en oscuro, la
// luminosidad tiene piso: un color que ya era profundo se queda como está.
function depthShift(hex: string, depth: Depth): string {
  if (depth === "medium") return hex;
  const [h, s, l] = hexToHsl(hex);
  if (depth === "light") return hslToHex(h, clamp(s - 7), Math.min(88, clamp(l + 11)));
  if (l - 13 < 14) return hex; // ya es profundo: oscurecerlo lo vuelve negro
  return hslToHex(h, clamp(s + 5), clamp(l - 13)); // dark
}

/** Familias que no cambian con la profundidad: un blanco es blanco. */
const NEUTRAS: ReadonlySet<HueFamily> = new Set(["blancos", "cremas", "grises"]);

// ───────────── MASTERS por estación (medium) ─────────────
const LIBRARY: Record<Season, SeasonLib> = {
  primavera: {
    reveal: "Vivos, cálidos y claros: el color fresco te enciende la cara.",
    hues: {
      blancos: [{ nombre: "Marfil", hex: "#F6ECD9" }],
      cremas: [
        { nombre: "Crema", hex: "#F2E6CC" },
        { nombre: "Durazno claro", hex: "#F6D3B0" },
      ],
      grises: [{ nombre: "Gris cálido", hex: "#C9BFB0" }],
      cafes: [
        { nombre: "Camel claro", hex: "#CBA873" },
        { nombre: "Tostado", hex: "#B07D4E" },
      ],
      amarillos: [
        { nombre: "Amarillo mantequilla", hex: "#F4DE8E" },
        { nombre: "Amarillo dorado", hex: "#F2C14E" },
      ],
      naranjas: [
        { nombre: "Durazno", hex: "#F4C29A" },
        { nombre: "Coral", hex: "#EB7E63" },
        { nombre: "Naranja cálido", hex: "#EE9440" },
      ],
      rojos: [
        { nombre: "Rojo coral", hex: "#E5654A" },
        { nombre: "Geranio", hex: "#D8412E" },
      ],
      rosas: [
        { nombre: "Salmón", hex: "#EE8C6A" },
        { nombre: "Rosa cálido", hex: "#F0A39B" },
      ],
      morados: [{ nombre: "Lila cálida", hex: "#C7B6E0" }],
      azules: [
        { nombre: "Aqua", hex: "#7FD0C8" },
        { nombre: "Turquesa", hex: "#4FB6C0" },
        { nombre: "Azul cielo", hex: "#5AA9D6" },
      ],
      verdes: [
        { nombre: "Verde manzana", hex: "#A6CE6E" },
        { nombre: "Verde fresco", hex: "#7FB069" },
        { nombre: "Lima", hex: "#C0D860" },
      ],
    },
    evita: [
      { nombre: "Negro", hex: "#1A1A1A" },
      { nombre: "Gris pizarra", hex: "#4A4E54" },
      { nombre: "Ciruela apagado", hex: "#4B3B52" },
      { nombre: "Malva grisáceo", hex: "#9E8FA0" },
    ],
  },

  verano: {
    reveal: "Suaves, frescos y apagados: lo delicado y frío es lo tuyo.",
    hues: {
      blancos: [{ nombre: "Blanco suave", hex: "#F1EFEA" }],
      cremas: [{ nombre: "Marfil frío", hex: "#ECE7DE" }],
      grises: [
        { nombre: "Gris perla", hex: "#D6D2CC" },
        { nombre: "Gris medio", hex: "#8C8A92" },
        { nombre: "Gris topo", hex: "#A9A6AE" },
      ],
      cafes: [
        { nombre: "Topo frío", hex: "#9C9088" },
        { nombre: "Cacao suave", hex: "#8A7A74" },
      ],
      amarillos: [{ nombre: "Amarillo suave", hex: "#E8DCA0" }],
      rojos: [
        { nombre: "Frambuesa suave", hex: "#B5567A" },
        { nombre: "Sandía apagado", hex: "#C77A82" },
      ],
      rosas: [
        { nombre: "Rosa empolvado", hex: "#D4A5B5" },
        { nombre: "Rosa bebé", hex: "#EAC2D2" },
        { nombre: "Malva", hex: "#A88BA4" },
      ],
      morados: [
        { nombre: "Lavanda", hex: "#A5A8D4" },
        { nombre: "Ciruela suave", hex: "#9C6E94" },
        { nombre: "Orquídea", hex: "#B58AB0" },
      ],
      azules: [
        { nombre: "Azul polvo", hex: "#8FA8C8" },
        { nombre: "Azul grisáceo", hex: "#7E96B5" },
        { nombre: "Azul cielo", hex: "#AEC8E0" },
      ],
      verdes: [
        { nombre: "Salvia", hex: "#A8BCA8" },
        { nombre: "Verde mar", hex: "#6FA89A" },
        { nombre: "Menta", hex: "#BCE0D0" },
      ],
    },
    evita: [
      { nombre: "Naranja", hex: "#E5712B" },
      { nombre: "Mostaza", hex: "#C8973D" },
      { nombre: "Camel", hex: "#B08D57" },
      { nombre: "Negro duro", hex: "#1A1A1A" },
    ],
  },

  otono: {
    reveal: "Tierra honda y especiada: los tonos cálidos te encienden la cara.",
    hues: {
      blancos: [{ nombre: "Marfil cálido", hex: "#EFE3C8" }],
      cremas: [
        { nombre: "Crema", hex: "#EAD9BC" },
        { nombre: "Beige dorado", hex: "#D9BC8C" },
      ],
      grises: [{ nombre: "Topo cálido", hex: "#9C8C76" }],
      cafes: [
        { nombre: "Camel", hex: "#B08D57" },
        { nombre: "Cuero", hex: "#8C5A30" },
        { nombre: "Chocolate", hex: "#5C4A38" },
        { nombre: "Café", hex: "#6E4326" },
      ],
      amarillos: [
        { nombre: "Mostaza", hex: "#C8973D" },
        { nombre: "Oro viejo", hex: "#B08524" },
        { nombre: "Curry", hex: "#B5852A" },
      ],
      naranjas: [
        { nombre: "Terracota", hex: "#B5613E" },
        { nombre: "Óxido", hex: "#A65327" },
        { nombre: "Calabaza", hex: "#C9742E" },
        { nombre: "Teja", hex: "#C06A3D" },
      ],
      rojos: [
        { nombre: "Vino", hex: "#722F37" },
        { nombre: "Oxblood", hex: "#5E2229" },
        { nombre: "Ladrillo", hex: "#9C3B2E" },
      ],
      rosas: [{ nombre: "Salmón terroso", hex: "#CF8A72" }],
      morados: [{ nombre: "Ciruela", hex: "#6E3B52" }],
      azules: [
        { nombre: "Teal", hex: "#2F7A72" },
        { nombre: "Petróleo", hex: "#1F5A55" },
      ],
      verdes: [
        { nombre: "Oliva", hex: "#6B7A4C" },
        { nombre: "Musgo", hex: "#7A8440" },
        { nombre: "Bosque", hex: "#3F5E45" },
        { nombre: "Verde botella", hex: "#2D4636" },
      ],
    },
    evita: [
      { nombre: "Rosa bebé", hex: "#F3C6D2" },
      { nombre: "Lavanda", hex: "#C9BEE0" },
      { nombre: "Blanco óptico", hex: "#FCFCFA" },
      { nombre: "Menta fría", hex: "#B8E0CC" },
    ],
  },

  invierno: {
    reveal: "Contrastes fuertes y colores joya: lo intenso y nítido es tu zona.",
    hues: {
      blancos: [{ nombre: "Blanco puro", hex: "#FAFAF7" }],
      grises: [
        { nombre: "Negro", hex: "#111111" },
        { nombre: "Gris carbón", hex: "#3A3E46" },
        { nombre: "Grafito", hex: "#2E333B" },
        { nombre: "Plata", hex: "#C2C2CC" },
      ],
      amarillos: [{ nombre: "Limón frío", hex: "#E3E84F" }],
      rojos: [
        { nombre: "Rubí", hex: "#8E2438" },
        { nombre: "Rojo verdadero", hex: "#C41E3A" },
        { nombre: "Vino oscuro", hex: "#5A1A2B" },
      ],
      rosas: [
        { nombre: "Fucsia", hex: "#C1216E" },
        { nombre: "Magenta", hex: "#B4186B" },
        { nombre: "Rosa shocking", hex: "#E0218A" },
        { nombre: "Rosa hielo", hex: "#E6B9CC" },
      ],
      morados: [
        { nombre: "Púrpura", hex: "#6A3B8F" },
        { nombre: "Violeta", hex: "#512A78" },
        { nombre: "Berenjena", hex: "#3A1F3D" },
      ],
      azules: [
        { nombre: "Azul marino", hex: "#1E2A4A" },
        { nombre: "Azul rey", hex: "#2E4FA3" },
        { nombre: "Zafiro", hex: "#243C8F" },
        { nombre: "Azul hielo", hex: "#A9C6E0" },
      ],
      verdes: [
        { nombre: "Esmeralda", hex: "#1E6B52" },
        { nombre: "Pino", hex: "#143A30" },
        { nombre: "Menta fría", hex: "#9FD6C8" },
      ],
    },
    evita: [
      { nombre: "Camel", hex: "#B08D57" },
      { nombre: "Mostaza", hex: "#C8973D" },
      { nombre: "Oliva apagado", hex: "#6B7A4C" },
      { nombre: "Beige amarillo", hex: "#D8C6A0" },
      { nombre: "Naranja tierra", hex: "#C9742E" },
    ],
  },
};

// Aplica el shift de profundidad a una lista de swatches (conserva el nombre).
function shiftAll(items: Swatch[], depth: Depth): Swatch[] {
  return items.map((s) => ({ nombre: s.nombre, hex: depthShift(s.hex, depth) }));
}

export function subPalette(season: Season, depth: Depth): SubPalette {
  const lib = LIBRARY[season] ?? LIBRARY.otono;
  const familias: Hues = {};
  for (const fam of FAMILY_ORDER) {
    const items = lib.hues[fam];
    if (items && items.length) familias[fam] = NEUTRAS.has(fam) ? [...items] : shiftAll(items, depth);
  }
  return {
    reveal: lib.reveal,
    familias,
    evita: shiftAll(lib.evita, depth),
    guinos: [],
    guinoSeason: null,
  };
}

// Umbral deltaE2000 para considerar que un color del "evita" es en realidad un
// guiño (misma familia cálida). VA_THRESHOLD del chequeo es 12 (mismo color);
// 18 captura "misma familia" sin barrer evitas legítimos de otro tono.
const GUINO_EVITA_THRESHOLD = 18;

// Cartera con el guiño incorporado: la paleta por profundidad + una fila de
// "guiños" (los prestados de la estación vecina) + el evita YA filtrado para no
// vetar lo que en realidad es tu guiño. Resuelve la contradicción donde una
// invierno-con-guiño-a-otoño veía sus cálidos terrosos en "evita".
export function carteraPalette(
  season: Season,
  depth: Depth,
  flow: Season | null
): SubPalette {
  const base = subPalette(season, depth);
  if (!flow) return base;

  const guinos: Swatch[] = seasonPalette(season, flow).prestados.map((c) => ({
    nombre: c.nombre,
    hex: c.hex,
  }));
  if (guinos.length === 0) return base;

  const guinoLabs = guinos.map((g) => rgbToLab(hexToRgb(g.hex)));
  const evita = base.evita.filter((e) => {
    const el = rgbToLab(hexToRgb(e.hex));
    return !guinoLabs.some((gl) => deltaE2000(el, gl) <= GUINO_EVITA_THRESHOLD);
  });

  return { ...base, guinos, guinoSeason: normSeason(flow), evita };
}

// Lista plana de los colores que SÍ van, en orden de familia (para el swipe
// fullscreen: tonos de la misma familia quedan contiguos).
export function goSwatches(season: Season, depth: Depth): Swatch[] {
  const p = subPalette(season, depth);
  return FAMILY_ORDER.flatMap((f) => p.familias[f] ?? []);
}

// Solo los hex que SÍ van (para el chequeo de color de Fase 2).
export function paletteHexes(season: Season, depth: Depth): string[] {
  return goSwatches(season, depth).map((s) => s.hex);
}

// "Colores que van" incluyendo los guiños del flow (para el chequeo de color):
// así un cálido prestado da "va", no "no-ideal".
export function carteraGoSwatches(
  season: Season,
  depth: Depth,
  flow: Season | null
): Swatch[] {
  const p = carteraPalette(season, depth, flow);
  return [...FAMILY_ORDER.flatMap((f) => p.familias[f] ?? []), ...p.guinos];
}
