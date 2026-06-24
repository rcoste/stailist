import type { CapsuleRow } from "@/lib/capsule";

// Combinatoria de outfits de una cápsula — el "gancho" del research: una cápsula
// rinde porque cada prenda MULTIPLICA. Fórmula base:
//   outfits = (tops × bottoms + vestidos) × (capas + 1) × calzado
// El "+1" en capas = opción de no llevar capa. Accesorios NO multiplican.
//
// Honestidad: la fórmula cruda sobre-cuenta (no todo combina de verdad). El
// research recomienda calibrar a la baja (25-50% del teórico). Usamos 0.5 y
// presentamos con "~". El valor no es el número exacto sino el RELATIVO: qué
// prenda que falta desbloquea más.

type Counts = { tops: number; bottoms: number; dresses: number; layers: number; shoes: number };

function bump(c: Counts, category: string): boolean {
  switch (category) {
    case "top": c.tops++; return true;
    case "bottom": c.bottoms++; return true;
    case "vestido": c.dresses++; return true;
    case "abrigo": c.layers++; return true;
    case "calzado": c.shoes++; return true;
    default: return false; // accesorio: no entra a la fórmula
  }
}

function count(rows: CapsuleRow[], pred: (r: CapsuleRow) => boolean): Counts {
  const c: Counts = { tops: 0, bottoms: 0, dresses: 0, layers: 0, shoes: 0 };
  for (const r of rows) if (pred(r)) bump(c, r.item.category);
  return c;
}

const CALIBRATION = 0.5;
function rawOutfits({ tops, bottoms, dresses, layers, shoes }: Counts): number {
  const cores = tops * bottoms + dresses;
  return cores * (layers + 1) * shoes;
}
const calibrated = (c: Counts) => rawOutfits(c) * CALIBRATION;

// Outfits que armas HOY con lo que ya tienes cubierto (calibrado, redondeado).
export function outfitsNow(rows: CapsuleRow[]): number {
  return Math.round(calibrated(count(rows, (r) => r.covered)));
}

// Looks NUEVOS que desbloquea cada prenda que te FALTA (su aporte marginal sobre
// lo que ya tienes). Keyed por índice de fila. Una prenda en una categoría vacía
// desbloquea mucho (destapa el cuello de botella); una 6ª camiseta, poco.
export function unlocksByIndex(rows: CapsuleRow[]): Map<number, number> {
  const base = count(rows, (r) => r.covered);
  const baseN = calibrated(base);
  const out = new Map<number, number>();
  for (const r of rows) {
    if (r.covered) continue;
    const plus = { ...base };
    if (!bump(plus, r.item.category)) continue; // accesorio → no desbloquea por fórmula
    out.set(r.index, Math.max(0, Math.round(calibrated(plus) - baseN)));
  }
  return out;
}
