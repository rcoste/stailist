import type { PackableItem } from "@/lib/engine/trip-outfits";
import {
  cleanPatron,
  cleanTextAttr,
  MAX_COLOR_LEN,
  MAX_MATERIAL_LEN,
} from "@/lib/prenda-atributos";

// Enriquecimiento del empacable de un viaje con la prenda REAL del clóset,
// resuelta por nombre (pura, sin IA ni DB — testeable). El empacable referencia
// prendas del clóset por el nombre que dio el match (`r.by`); aquí lo
// resolvemos a sus attrs reales para que el motor juzgue color/clima/estampado
// de verdad (el colorFamilia ideal puede no ser el color real de TU prenda).

// Attrs relevantes de una prenda real del clóset (subset de items.attrs).
export type RealAttrs = {
  nombre?: string;
  color?: string;
  color_hex?: string;
  temporada?: string;
  material?: string;
  patron?: string;
  color_secundario?: string;
};

// Hex plausible (#RGB..#RRGGBBAA). Lo que no cumpla no entra al prompt.
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

// Normaliza para comparar nombres: minúsculas, sin acentos, sin espacios sobrantes.
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Resuelve un nombre de prenda a sus attrs reales. Exacto (normalizado) primero;
// si no, fallback por inclusión de substring — pero SOLO si hay exactamente UN
// candidato: con dos nombres que se contienen ("camisa blanca" en dos prendas),
// adivinar el primero pondría los atributos de la prenda equivocada en el look.
// Ambiguo o sin match → null (la pieza queda con sus datos ideales, como antes).
export function resolveRealAttrs(
  nombre: string,
  byName: Map<string, RealAttrs>
): RealAttrs | null {
  const n = norm(nombre);
  if (!n) return null;
  const exact = byName.get(n);
  if (exact) return exact;
  const candidates: RealAttrs[] = [];
  for (const [k, v] of byName) {
    if (k && (k.includes(n) || n.includes(k))) candidates.push(v);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

// Enriquece IN PLACE cada pieza empacable con los attrs de su prenda real.
// Tolerante: si el nombre no resuelve (o resuelve ambiguo), la pieza queda como
// estaba. Devuelve el mismo array para encadenar.
export function enrichPackable(
  packable: PackableItem[],
  closetAttrs: RealAttrs[]
): PackableItem[] {
  // Nombres DUPLICADOS en el clóset (dos "Camisa blanca": arquetipo + foto) se
  // excluyen del mapa: un match exacto contra un duplicado devolvería los attrs
  // de una prenda al azar — peor dejar la pieza con sus datos ideales que
  // enriquecerla con el hex/material de la prenda equivocada.
  const byName = new Map<string, RealAttrs>();
  const dupes = new Set<string>();
  for (const a of closetAttrs) {
    if (!a.nombre) continue;
    const k = norm(a.nombre);
    if (byName.has(k)) dupes.add(k);
    else byName.set(k, a);
  }
  for (const k of dupes) byName.delete(k);
  // Frontera de confianza al PUNTO DE CONSUMO: items.attrs viene de la DB
  // (escrituras viejas sin validar, updateItemAttrs, clientes manipulados) y
  // aquí entra a prompts de Opus — se acota/valida cada campo antes de copiar.
  for (const p of packable) {
    const a = resolveRealAttrs(p.nombre, byName);
    if (!a) continue;
    const color = cleanTextAttr(a.color, MAX_COLOR_LEN);
    if (color) p.color = color;
    p.hex = a.color_hex && HEX_RE.test(a.color_hex) ? a.color_hex : null;
    p.temporada = cleanTextAttr(a.temporada, 20) ?? null;
    p.material = cleanTextAttr(a.material, MAX_MATERIAL_LEN) ?? null;
    p.patron = cleanPatron(a.patron) ?? null;
    p.color_secundario = cleanTextAttr(a.color_secundario, MAX_COLOR_LEN) ?? null;
  }
  return packable;
}
