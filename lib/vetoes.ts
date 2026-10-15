// Vetos de estilo (issue #2): hard NOs que el motor respeta. Catálogo de chips
// curados (gender-aware) + texto libre. El `kind` decide el enforcement:
//   - garment/color → filtro previo del clóset (applyVetoes) + prompt + juez
//   - feature        → solo prompt + juez (no mapea a un atributo de prenda)
// El texto libre siempre va por prompt + juez.

export type VetoKind = "garment" | "color" | "feature";
export type Gender = "hombre" | "mujer";

export type VetoChip = {
  id: string;
  label: string;
  kind: VetoKind;
  /** Si está, el chip solo se muestra a estos géneros. */
  genders?: Gender[];
  /** Términos (normalizados) a buscar en el nombre de la prenda (garment) o
   *  en attrs.color (color). Default: el label normalizado. */
  match?: string[];
  /** Garment: sólo aplica a prendas de estas categorías. "cropped" en un top
   *  es un crop top; en un pantalón es un largo, y vetar uno no veta el otro. */
  soloCategorias?: string[];
};

export type StyleVetoes = { chips: string[]; free: string[] };

export const EMPTY_VETOES: StyleVetoes = { chips: [], free: [] };

export const VETO_CATALOG: VetoChip[] = [
  // Prendas
  // Cuña y stiletto también son tacón: quien los veta casi siempre es porque no
  // camina en ellos, y una cuña sube el talón igual. La plataforma NO entra: la
  // "flatform" es plana.
  { id: "tacones", label: "Tacones", kind: "garment", genders: ["mujer"], match: ["tacon", "heel", "cuna", "stiletto"] },
  { id: "shorts", label: "Shorts", kind: "garment", match: ["short", "bermuda"] },
  { id: "faldas", label: "Faldas", kind: "garment", genders: ["mujer"], match: ["falda"] },
  { id: "vestidos", label: "Vestidos", kind: "garment", genders: ["mujer"], match: ["vestido"] },
  { id: "sandalias", label: "Sandalias", kind: "garment", match: ["sandalia", "sandal", "huarache"] },
  { id: "crop_tops", label: "Crop tops", kind: "garment", genders: ["mujer"], match: ["crop", "cropped"], soloCategorias: ["top"] },
  { id: "gorras", label: "Gorras", kind: "garment", match: ["gorra", "cachucha", "cap"] },
  // Detalles
  { id: "estampados", label: "Estampados", kind: "feature" },
  { id: "animal_print", label: "Animal print", kind: "feature" },
  { id: "transparencias", label: "Transparencias", kind: "feature" },
  { id: "escotes", label: "Escotes pronunciados", kind: "feature", genders: ["mujer"] },
  { id: "sin_mangas", label: "Sin mangas", kind: "feature" },
  // Colores
  { id: "amarillo", label: "Amarillo", kind: "color", match: ["amarillo", "yellow"] },
  { id: "naranja", label: "Naranja", kind: "color", match: ["naranja", "orange"] },
  { id: "rosa", label: "Rosa", kind: "color", match: ["rosa", "pink"] },
  { id: "rojo", label: "Rojo", kind: "color", match: ["rojo", "red"] },
  { id: "morado", label: "Morado", kind: "color", match: ["morado", "purpura", "purple", "violeta"] },
  { id: "verde", label: "Verde", kind: "color", match: ["verde", "green"] },
];

const CHIP_BY_ID: Record<string, VetoChip> = Object.fromEntries(
  VETO_CATALOG.map((c) => [c.id, c])
);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (diacríticos combinados)
    .trim();
}

function chipTerms(chip: VetoChip): string[] {
  return (chip.match ?? [normalize(chip.label)]).map(normalize);
}

// Los chips que se muestran a este género (los gender-locked solo a su género).
export function vetoCatalogForGender(gender: Gender | null): VetoChip[] {
  return VETO_CATALOG.filter(
    (c) => !c.genders || (gender !== null && c.genders.includes(gender))
  );
}

// Lista humana (chips + free) para la regla dura del prompt y el juez.
export function vetoLabels(vetoes: StyleVetoes | null | undefined): string[] {
  if (!vetoes) return [];
  const out: string[] = [];
  for (const id of vetoes.chips ?? []) {
    const chip = CHIP_BY_ID[id];
    if (chip) out.push(chip.label.toLowerCase());
  }
  for (const f of vetoes.free ?? []) {
    const t = f.trim();
    if (t) out.push(t.toLowerCase());
  }
  return out;
}

// Filtro previo (capa 1): quita del clóset las prendas que mapean a un veto de
// prenda (por su NOMBRE) o de color (attrs.color). Los feature y el free NO
// filtran — los cubre la regla dura + el juez. Objeto vacío = passthrough idéntico.
//
// POR QUÉ EL NOMBRE Y NO attrs.tipo (2026-10-14). Comparaba contra attrs.tipo,
// y ninguna prenda lo trae: 0 de 3044 en producción (los arquetipos no lo
// llevan y el alta por foto tampoco lo guarda). El filtro de tacones, shorts,
// faldas, vestidos, sandalias, crop tops y gorras no quitaba nada; sólo los
// cuidaban el prompt y el juez. Lo encontró Pablo leyendo el código.
//
// POR QUÉ PALABRA ENTERA y no `includes`: "cap" (gorra) estaba dentro de
// "sudadera con capucha", y "short" dentro de cualquier "shortalls". Se acepta
// el plural (tacones, faldas) y los prefijos de largo (minifalda, maxivestido).
export function applyVetoes<
  T extends { attrs: { nombre?: string; tipo?: string; color?: string; categoria?: string } },
>(items: T[], vetoes: StyleVetoes | null | undefined): { items: T[]; removed: number } {
  const chips = vetoes?.chips ?? [];
  const prendas: VetoChip[] = [];
  const colorTerms: string[] = [];
  for (const id of chips) {
    const chip = CHIP_BY_ID[id];
    if (!chip) continue;
    if (chip.kind === "garment") prendas.push(chip);
    else if (chip.kind === "color") colorTerms.push(...chipTerms(chip));
  }
  if (prendas.length === 0 && colorTerms.length === 0) {
    return { items, removed: 0 };
  }
  const kept = items.filter((it) => {
    const nombre = normalize(`${it.attrs.nombre ?? ""} ${it.attrs.tipo ?? ""}`);
    const color = normalize(it.attrs.color ?? "");
    if (nombre && prendas.some((c) => vetaPrenda(c, nombre, it.attrs.categoria ?? null))) return false;
    if (color && colorTerms.some((t) => color.includes(t))) return false;
    return true;
  });
  return { items: kept, removed: items.length - kept.length };
}

function vetaPrenda(chip: VetoChip, nombre: string, categoria: string | null): boolean {
  if (chip.soloCategorias && !(categoria && chip.soloCategorias.includes(categoria))) return false;
  return chipTerms(chip).some((t) => palabra(t).test(nombre));
}

const PALABRAS = new Map<string, RegExp>();
function palabra(t: string): RegExp {
  let re = PALABRAS.get(t);
  if (!re) {
    re = new RegExp(`(?<![a-z])(?:mini|midi|maxi)?${t}(?:e?s)?(?![a-z])`);
    PALABRAS.set(t, re);
  }
  return re;
}
