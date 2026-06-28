// Paletas AMPLIAS por sub-estación (12 = estación × profundidad), para la
// Cartera de Colorimetría. Datos curados (v1) — son COLORES DE ROPA, no tokens
// de UI. Versionados en código como SEASONS de colorimetria.ts.
//
// Familias: neutros (base de armario) · base (cotidiano) · acentos (color que
// suma) · joya (statement/destaque) · evita (apaga la cara). `reveal` lidera en
// voz amiga cool; la sub-estación es vocabulario interno.
import type { Season, Depth, SubSeason } from "./colorimetria";

export type SwatchFamily = "neutros" | "base" | "acentos" | "joya" | "evita";

export type Swatch = { nombre: string; hex: string };
export type SubPalette = {
  reveal: string;
  familias: Record<SwatchFamily, Swatch[]>;
};

export const FAMILY_LABEL: Record<SwatchFamily, string> = {
  neutros: "Tus neutros",
  base: "Para todos los días",
  acentos: "Cuando quieres color",
  joya: "Para destacar",
  evita: "Mejor evítalos",
};

// Orden de presentación de familias en la cartera.
export const FAMILY_ORDER: SwatchFamily[] = ["neutros", "base", "acentos", "joya", "evita"];

const PALETTES: Record<SubSeason, SubPalette> = {
  // ───────────────── OTOÑO (cálido, terroso) ─────────────────
  "otono-light": {
    reveal: "Tierra suave y dorada: te enciende sin pesarte.",
    familias: {
      neutros: [
        { nombre: "Crema cálida", hex: "#F2E6CF" },
        { nombre: "Camel claro", hex: "#CBA873" },
        { nombre: "Café topo", hex: "#9C7E5E" },
      ],
      base: [
        { nombre: "Beige dorado", hex: "#D9BC8C" },
        { nombre: "Salvia clara", hex: "#AFB792" },
        { nombre: "Caqui suave", hex: "#BBA877" },
        { nombre: "Terracota suave", hex: "#D08C6C" },
      ],
      acentos: [
        { nombre: "Melocotón", hex: "#E8A877" },
        { nombre: "Coral cálido", hex: "#E18C6E" },
        { nombre: "Verde lima suave", hex: "#A7B26A" },
        { nombre: "Turquesa cálida", hex: "#5FB0A6" },
      ],
      joya: [
        { nombre: "Oro suave", hex: "#E0B04A" },
        { nombre: "Óxido", hex: "#C06A3D" },
      ],
      evita: [
        { nombre: "Negro", hex: "#1A1A1A" },
        { nombre: "Fucsia frío", hex: "#C13B7A" },
        { nombre: "Gris pizarra", hex: "#4A4E54" },
      ],
    },
  },
  "otono-medium": {
    reveal: "Los tonos tierra te encienden la cara.",
    familias: {
      neutros: [
        { nombre: "Crema", hex: "#EAD9BC" },
        { nombre: "Camel", hex: "#B08D57" },
        { nombre: "Chocolate", hex: "#5C4A38" },
      ],
      base: [
        { nombre: "Oliva", hex: "#6B7A4C" },
        { nombre: "Caqui", hex: "#9A8A5C" },
        { nombre: "Teja", hex: "#B5613E" },
        { nombre: "Verde bosque", hex: "#3F5E45" },
      ],
      acentos: [
        { nombre: "Mostaza", hex: "#C8973D" },
        { nombre: "Calabaza", hex: "#C9742E" },
        { nombre: "Teal", hex: "#2F7A72" },
        { nombre: "Verde musgo", hex: "#7A8440" },
      ],
      joya: [
        { nombre: "Vino", hex: "#722F37" },
        { nombre: "Óxido profundo", hex: "#A65327" },
      ],
      evita: [
        { nombre: "Rosa bebé", hex: "#F3C6D2" },
        { nombre: "Lavanda", hex: "#C9BEE0" },
        { nombre: "Blanco óptico", hex: "#FCFCFA" },
      ],
    },
  },
  "otono-dark": {
    reveal: "Tierra honda y especiada: entre más profundo, mejor te ves.",
    familias: {
      neutros: [
        { nombre: "Crema tostada", hex: "#DCC9A6" },
        { nombre: "Café oscuro", hex: "#4A3A2A" },
        { nombre: "Negro tabaco", hex: "#2B2118" },
      ],
      base: [
        { nombre: "Oliva oscuro", hex: "#4F5A35" },
        { nombre: "Verde pino", hex: "#2D4636" },
        { nombre: "Marrón cuero", hex: "#6E4326" },
        { nombre: "Mostaza oscura", hex: "#9C7322" },
      ],
      acentos: [
        { nombre: "Teal oscuro", hex: "#1F5A55" },
        { nombre: "Naranja quemado", hex: "#A14B22" },
        { nombre: "Verde oliva intenso", hex: "#5E6B27" },
      ],
      joya: [
        { nombre: "Oxblood", hex: "#5E2229" },
        { nombre: "Oro viejo", hex: "#B08524" },
        { nombre: "Esmeralda profunda", hex: "#1F4D3D" },
      ],
      evita: [
        { nombre: "Pastel frío", hex: "#CFE0E8" },
        { nombre: "Gris frío", hex: "#9AA3AD" },
        { nombre: "Neón", hex: "#C6FF00" },
      ],
    },
  },

  // ───────────────── INVIERNO (frío, intenso) ─────────────────
  "invierno-light": {
    reveal: "Frío y nítido: los tonos hielo brillan en ti.",
    familias: {
      neutros: [
        { nombre: "Blanco puro", hex: "#FAFAF7" },
        { nombre: "Gris claro frío", hex: "#C9CDD4" },
        { nombre: "Grafito", hex: "#3A3E46" },
      ],
      base: [
        { nombre: "Azul hielo", hex: "#A9C6E0" },
        { nombre: "Rosa hielo", hex: "#E6B9CC" },
        { nombre: "Azul medio", hex: "#3F73B8" },
        { nombre: "Menta fría", hex: "#9FD6C8" },
      ],
      acentos: [
        { nombre: "Magenta claro", hex: "#C85C9C" },
        { nombre: "Turquesa brillante", hex: "#2BB3C4" },
        { nombre: "Lavanda fría", hex: "#9C8FD0" },
      ],
      joya: [
        { nombre: "Azul rey", hex: "#2E4FA3" },
        { nombre: "Rubí claro", hex: "#B83A57" },
      ],
      evita: [
        { nombre: "Camel", hex: "#B08D57" },
        { nombre: "Mostaza", hex: "#C8973D" },
        { nombre: "Beige amarillo", hex: "#D8C6A0" },
      ],
    },
  },
  "invierno-medium": {
    reveal: "Contrastes fuertes y colores joya: lo intenso es tu zona.",
    familias: {
      neutros: [
        { nombre: "Blanco puro", hex: "#FAFAF7" },
        { nombre: "Gris carbón", hex: "#3A3E46" },
        { nombre: "Negro suave", hex: "#1A1A1A" },
      ],
      base: [
        { nombre: "Azul marino", hex: "#1E2A4A" },
        { nombre: "Gris medio frío", hex: "#7C828C" },
        { nombre: "Azul rey", hex: "#2E4FA3" },
        { nombre: "Verde pino frío", hex: "#1F4A44" },
      ],
      acentos: [
        { nombre: "Fucsia", hex: "#C1216E" },
        { nombre: "Turquesa", hex: "#1F9BAE" },
        { nombre: "Púrpura", hex: "#6A3B8F" },
      ],
      joya: [
        { nombre: "Rubí", hex: "#8E2438" },
        { nombre: "Esmeralda", hex: "#1E6B52" },
        { nombre: "Zafiro", hex: "#243C8F" },
      ],
      evita: [
        { nombre: "Camel", hex: "#B08D57" },
        { nombre: "Naranja tierra", hex: "#C9742E" },
        { nombre: "Oliva apagado", hex: "#6B7A4C" },
      ],
    },
  },
  "invierno-dark": {
    reveal: "Oscuro y dramático: negro y joyas profundas son tuyos.",
    familias: {
      neutros: [
        { nombre: "Negro", hex: "#111111" },
        { nombre: "Blanco puro", hex: "#FAFAF7" },
        { nombre: "Gris pizarra", hex: "#2E333B" },
      ],
      base: [
        { nombre: "Azul noche", hex: "#16213E" },
        { nombre: "Verde botella", hex: "#143A30" },
        { nombre: "Carbón", hex: "#22262C" },
        { nombre: "Vino oscuro", hex: "#4A1722" },
      ],
      acentos: [
        { nombre: "Púrpura intenso", hex: "#512A78" },
        { nombre: "Azul eléctrico", hex: "#1E3FB0" },
        { nombre: "Magenta profundo", hex: "#9C1A5C" },
      ],
      joya: [
        { nombre: "Borgoña", hex: "#5A1A2B" },
        { nombre: "Esmeralda oscura", hex: "#114A38" },
        { nombre: "Rubí oscuro", hex: "#6E1E33" },
      ],
      evita: [
        { nombre: "Pastel", hex: "#E7D8E2" },
        { nombre: "Camel claro", hex: "#CBA873" },
        { nombre: "Beige amarillo", hex: "#D8C6A0" },
      ],
    },
  },

  // ───────────────── PRIMAVERA (cálido, fresco) ─────────────────
  "primavera-light": {
    reveal: "Pasteles cálidos y luminosos: te ves fresca y despierta.",
    familias: {
      neutros: [
        { nombre: "Marfil", hex: "#F6ECD9" },
        { nombre: "Beige claro", hex: "#E4D2B0" },
        { nombre: "Topo cálido", hex: "#B9A57E" },
      ],
      base: [
        { nombre: "Durazno", hex: "#F4C29A" },
        { nombre: "Amarillo claro", hex: "#F4DE8E" },
        { nombre: "Menta cálida", hex: "#B8E0B0" },
        { nombre: "Aqua claro", hex: "#9FD9D2" },
      ],
      acentos: [
        { nombre: "Coral suave", hex: "#F29B82" },
        { nombre: "Lavanda cálida", hex: "#C7B6E0" },
        { nombre: "Verde manzana", hex: "#A6CE6E" },
      ],
      joya: [
        { nombre: "Coral", hex: "#EB7E63" },
        { nombre: "Turquesa", hex: "#4FB6C0" },
      ],
      evita: [
        { nombre: "Negro", hex: "#1A1A1A" },
        { nombre: "Borgoña oscuro", hex: "#4A1722" },
        { nombre: "Gris pesado", hex: "#4A4E54" },
      ],
    },
  },
  "primavera-medium": {
    reveal: "Vivos y cálidos: el color fresco te queda increíble.",
    familias: {
      neutros: [
        { nombre: "Marfil", hex: "#F2E6CC" },
        { nombre: "Camel claro", hex: "#CBA873" },
        { nombre: "Café cálido", hex: "#8C6A45" },
      ],
      base: [
        { nombre: "Verde fresco", hex: "#7FB069" },
        { nombre: "Amarillo dorado", hex: "#F2C14E" },
        { nombre: "Azul cielo cálido", hex: "#5AA9D6" },
        { nombre: "Salmón", hex: "#EE8C6A" },
      ],
      acentos: [
        { nombre: "Coral", hex: "#E8806E" },
        { nombre: "Turquesa", hex: "#62B6CB" },
        { nombre: "Naranja cálido", hex: "#EE9440" },
      ],
      joya: [
        { nombre: "Verde esmeralda claro", hex: "#3DA47A" },
        { nombre: "Coral intenso", hex: "#E5654A" },
      ],
      evita: [
        { nombre: "Negro", hex: "#1A1A1A" },
        { nombre: "Gris frío", hex: "#9AA3AD" },
        { nombre: "Ciruela apagado", hex: "#4B3B52" },
      ],
    },
  },
  "primavera-dark": {
    reveal: "Color claro y saturado: brillas con tonos vivos y limpios.",
    familias: {
      neutros: [
        { nombre: "Marfil", hex: "#F2E6CC" },
        { nombre: "Navy cálido", hex: "#26385E" },
        { nombre: "Café medio", hex: "#7A5A38" },
      ],
      base: [
        { nombre: "Verde brillante", hex: "#3FA85E" },
        { nombre: "Azul brillante", hex: "#1E84C9" },
        { nombre: "Amarillo oro", hex: "#F0B82E" },
        { nombre: "Coral fuerte", hex: "#E85C3F" },
      ],
      acentos: [
        { nombre: "Turquesa brillante", hex: "#16A8B8" },
        { nombre: "Fucsia cálido", hex: "#D43B73" },
        { nombre: "Verde lima", hex: "#8FC23A" },
      ],
      joya: [
        { nombre: "Esmeralda clara", hex: "#1E9C6E" },
        { nombre: "Rojo tomate", hex: "#D83A2E" },
      ],
      evita: [
        { nombre: "Beige grisáceo", hex: "#C7BBA6" },
        { nombre: "Malva apagado", hex: "#9E8FA0" },
        { nombre: "Tonos mute", hex: "#A7A28E" },
      ],
    },
  },

  // ───────────────── VERANO (frío, suave) ─────────────────
  "verano-light": {
    reveal: "Pasteles fríos y suaves: lo delicado te sienta de lujo.",
    familias: {
      neutros: [
        { nombre: "Blanco suave", hex: "#F1EFEA" },
        { nombre: "Gris perla", hex: "#D8D5D0" },
        { nombre: "Topo frío", hex: "#A9A6AE" },
      ],
      base: [
        { nombre: "Azul cielo suave", hex: "#AEC8E0" },
        { nombre: "Rosa bebé", hex: "#EAC2D2" },
        { nombre: "Menta", hex: "#BCE0D0" },
        { nombre: "Lavanda clara", hex: "#C9C2E2" },
      ],
      acentos: [
        { nombre: "Azul polvo", hex: "#8FA8C8" },
        { nombre: "Rosa malva", hex: "#D29CB8" },
        { nombre: "Verde mar suave", hex: "#9CC8BA" },
      ],
      joya: [
        { nombre: "Azul medio frío", hex: "#5C7FB0" },
        { nombre: "Ciruela suave", hex: "#9C6E94" },
      ],
      evita: [
        { nombre: "Naranja", hex: "#E5712B" },
        { nombre: "Negro duro", hex: "#1A1A1A" },
        { nombre: "Mostaza", hex: "#C8973D" },
      ],
    },
  },
  "verano-medium": {
    reveal: "Tonos suaves y frescos: lo apagado y frío es lo tuyo.",
    familias: {
      neutros: [
        { nombre: "Gris perla", hex: "#D6D2CC" },
        { nombre: "Gris medio", hex: "#8C8A92" },
        { nombre: "Navy suave", hex: "#33415E" },
      ],
      base: [
        { nombre: "Azul grisáceo", hex: "#8FA8C8" },
        { nombre: "Rosa empolvado", hex: "#D4A5B5" },
        { nombre: "Salvia", hex: "#A8BCA8" },
        { nombre: "Malva", hex: "#A88BA4" },
      ],
      acentos: [
        { nombre: "Lavanda", hex: "#A5A8D4" },
        { nombre: "Verde mar", hex: "#6FA89A" },
        { nombre: "Frambuesa suave", hex: "#B5567A" },
      ],
      joya: [
        { nombre: "Azul zafiro suave", hex: "#3E5C95" },
        { nombre: "Ciruela", hex: "#7E466E" },
      ],
      evita: [
        { nombre: "Naranja", hex: "#E5712B" },
        { nombre: "Camel", hex: "#B08D57" },
        { nombre: "Amarillo cálido", hex: "#F2C14E" },
      ],
    },
  },
  "verano-dark": {
    reveal: "Frío y profundo pero suave: nada estridente, todo elegante.",
    familias: {
      neutros: [
        { nombre: "Gris carbón frío", hex: "#3E424A" },
        { nombre: "Gris topo", hex: "#76737C" },
        { nombre: "Navy apagado", hex: "#26314A" },
      ],
      base: [
        { nombre: "Azul pizarra", hex: "#4A5E7A" },
        { nombre: "Verde pino apagado", hex: "#3A5A50" },
        { nombre: "Malva oscuro", hex: "#6E5266" },
        { nombre: "Rosa palo oscuro", hex: "#A06E7E" },
      ],
      acentos: [
        { nombre: "Ciruela", hex: "#5E3A58" },
        { nombre: "Verde mar profundo", hex: "#2F6356" },
        { nombre: "Frambuesa apagada", hex: "#8E3A5C" },
      ],
      joya: [
        { nombre: "Borgoña apagado", hex: "#5A2A3A" },
        { nombre: "Zafiro profundo", hex: "#2A4470" },
      ],
      evita: [
        { nombre: "Naranja brillante", hex: "#E5712B" },
        { nombre: "Amarillo cálido", hex: "#F2C14E" },
        { nombre: "Neón", hex: "#C6FF00" },
      ],
    },
  },
};

// Fallback defensivo: si llega una sub-estación inválida, no reventar — cae a
// otoño medio (la estación a la que más gente "presta" sin verse mal).
export function subPalette(season: Season, depth: Depth): SubPalette {
  return PALETTES[`${season}-${depth}`] ?? PALETTES["otono-medium"];
}

// Lista plana de "colores que SÍ van" (para el chequeo de color de Fase 2).
export function paletteHexes(season: Season, depth: Depth): string[] {
  const p = subPalette(season, depth);
  return [...p.familias.neutros, ...p.familias.base, ...p.familias.acentos, ...p.familias.joya].map(
    (s) => s.hex
  );
}

export { PALETTES };
