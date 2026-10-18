// QUÉ ES CADA PIEZA, por su nombre (2026-10-18). Lo comparten los jueces de la
// cápsula (lib/engine/capsule-revision.ts) y de la maleta
// (lib/engine/trip-revision.ts): un abrigo de invierno, algo para la lluvia,
// unos jeans azules, una pieza de noche. Clasificar por texto es imperfecto a
// propósito: lo que aquí no se reconoce no dispara nada (falla hacia "no
// opinar"), y cada patrón salió de nombres reales de la base.

import type { CapsuleItem } from "@/lib/capsule";

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_]/g, " ");
const txt = (it: Pick<CapsuleItem, "nombre" | "tipo">) => norm(`${it.nombre} ${it.tipo ?? ""}`);

/** Abrigo de invierno de verdad: el que la regla de abrigo pide bajo 5°C. Una gabardina o un bomber no lo son. */
export function esAbrigoDeInvierno(it: CapsuleItem): boolean {
  const t = txt(it);
  if (/gabardina|trench|ligera|rompevientos|chaleco|bomber/.test(t)) return false;
  return /abrigo|plumas|pluma|acolchad|puffer|chaqueton|parka acolchada|anorak acolchado/.test(t);
}

/** Cualquier capa exterior: abrigo, chamarra, gabardina, blazer, cárdigan. */
export function esCapaExterior(it: CapsuleItem): boolean {
  return it.category === "abrigo" || it.category === "saco" || /chamarra|chaqueta|gabardina|trench|abrigo|parka|blazer|cardigan|sobrecamisa|bomber|rompevientos/.test(txt(it));
}

/** Algo que aguanta la lluvia: capa o calzado impermeable. */
export function esParaLluvia(it: CapsuleItem): boolean {
  return /gabardina|trench|impermeable|lluvia|rompevientos|repelente|parka|botas? de hule|waterproof/.test(txt(it));
}

/** Jeans azules (índigo, mezclilla azul). Los negros, grises o blancos no cuentan. */
export function esJeansAzul(it: CapsuleItem): boolean {
  const t = norm(`${it.nombre} ${it.tipo ?? ""} ${it.colorFamilia ?? ""}`);
  return it.category === "bottom" && /jean|mezclilla|denim/.test(t) && !/negr|gris|blanc|crema|beige|hueso|cafe|chocolate|verde|rosa|vino/.test(t);
}

/** Se nombra como pieza de noche, gala o evento. */
export function esDeNoche(it: CapsuleItem): boolean {
  return /\b(gala|noche|coctel|fiesta|etiqueta)\b/.test(txt(it));
}

/** Su descripción para el dibujo dice qué la hace de noche. */
export function visualDeNoche(visual: string | null | undefined): boolean {
  return /saten|seda|terciopelo|lentejuel|brillo|escote en v|escote profundo|espalda|abertura|tirante fino|drapead|tafeta|organza|encaje|metalic|plisado/.test(norm(visual ?? ""));
}

/** Calzado cerrado (sirve con frío o lluvia). */
export function esCalzadoCerrado(it: CapsuleItem): boolean {
  return it.category === "calzado" && !/sandalia|chancla|alpargata|huarache|destalon|abierto|mule|flip/.test(txt(it));
}

/** Pieza para calor. */
export function esLigera(it: CapsuleItem): boolean {
  return it.temporada === "calor" || /lino|short|bermuda|sandalia|tirantes|traje de bano|playera ligera/.test(txt(it));
}
