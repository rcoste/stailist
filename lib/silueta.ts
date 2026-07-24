// Selector de silueta: dos ejes simples (complexión + dónde carga volumen/forma).
// Tamaño = para REPRESENTAR (la app te muestra con un cuerpo como el tuyo).
// Forma = para RECOMENDAR (qué te equilibra / qué efecto logras).
// Gender-aware: cuerpos, opciones y consejos distintos para mujer y hombre.

export type Gender = "mujer" | "hombre";
export type Build =
  | "delgada" | "atletica" | "media" | "curvas" | "grande"
  | "delgado" | "atletico" | "musculoso" | "promedio" | "robusto" | "corpulento";
export type Volume =
  | "arriba" | "cintura" | "abajo" | "medio" | "pareja"
  | "pecho" | "parejo" | "panza";

export type Zone = [number, number, number, number]; // [left%, top%, w%, h%]
type BuildOpt = { id: Build; label: string; img: string };
type VolumeOpt = { id: Volume; label: string; desc: string; zones: Zone[]; band?: boolean };

// Orden = progresión visual de complexión (no de "mejor a peor"): el grid las
// muestra en este orden para que la usuaria se ubique de un vistazo.
const BUILDS_F: BuildOpt[] = [
  { id: "delgada", label: "Delgada", img: "/siluetas/complexion/1-delgada.png" },
  { id: "atletica", label: "Atlética", img: "/siluetas/complexion/4-atletica.png" },
  { id: "media", label: "Media", img: "/siluetas/complexion/2-media.png" },
  { id: "curvas", label: "Con más curvas", img: "/siluetas/complexion/3-curvas.png" },
  { id: "grande", label: "Talla grande", img: "/siluetas/complexion/5-grande.png" },
];
const BUILDS_M: BuildOpt[] = [
  { id: "delgado", label: "Delgado", img: "/siluetas/complexion-hombre/1-delgado.png" },
  { id: "atletico", label: "Atlético", img: "/siluetas/complexion-hombre/2-atletico.png" },
  { id: "musculoso", label: "Musculoso", img: "/siluetas/complexion-hombre/5-musculoso.png" },
  { id: "promedio", label: "Promedio", img: "/siluetas/complexion-hombre/3-promedio.png" },
  { id: "robusto", label: "Robusto", img: "/siluetas/complexion-hombre/4-robusto.png" },
  { id: "corpulento", label: "Corpulento", img: "/siluetas/complexion-hombre/6-corpulento.png" },
];

const VOLUMES_F: VolumeOpt[] = [
  { id: "arriba", label: "Arriba", desc: "busto u hombros", zones: [[28, 24, 44, 12]] },
  { id: "cintura", label: "Cintura marcada", desc: "parejo, cintura definida", zones: [[30, 25, 40, 10], [26, 47, 48, 12]] },
  { id: "abajo", label: "Abajo", desc: "cadera y muslos", zones: [[25, 47, 50, 14]] },
  { id: "medio", label: "En el medio", desc: "abdomen", zones: [[29, 35, 42, 15]] },
  { id: "pareja", label: "Bastante pareja", desc: "sin mucha curva", zones: [], band: true },
];
const VOLUMES_M: VolumeOpt[] = [
  { id: "pecho", label: "Pecho/hombros", desc: "forma de V", zones: [[24, 21, 52, 14]] },
  { id: "parejo", label: "Parejo", desc: "sin mucha forma", zones: [], band: true },
  { id: "panza", label: "En el medio", desc: "abdomen", zones: [[27, 37, 46, 16]] },
];

export const builds = (g: Gender): BuildOpt[] => (g === "hombre" ? BUILDS_M : BUILDS_F);
export const volumes = (g: Gender): VolumeOpt[] => (g === "hombre" ? VOLUMES_M : VOLUMES_F);

const ALL_BUILDS = [...BUILDS_F, ...BUILDS_M];
const ALL_VOLUMES = [...VOLUMES_F, ...VOLUMES_M];

export const buildLabel = (b: Build | null) => ALL_BUILDS.find((x) => x.id === b)?.label ?? null;
export const volumeLabel = (v: Volume | null) => ALL_VOLUMES.find((x) => x.id === v)?.label ?? null;
export const buildImg = (b: Build | null) => ALL_BUILDS.find((x) => x.id === b)?.img ?? null;
export const volumeOpt = (v: Volume | null) => ALL_VOLUMES.find((x) => x.id === v) ?? null;

export const isBuild = (v: unknown): v is Build => ALL_BUILDS.some((x) => x.id === v);
export const isVolume = (v: unknown): v is Volume => ALL_VOLUMES.some((x) => x.id === v);

// Línea de orientación para el motor de outfits (Hoy + Viaje). Señal suave: el
// motor la usa para desempatar y enriquecer el porqué, NO como filtro ni regla.
// null si no hay silueta → el motor se comporta como hoy.
export function siluetaPromptLine(build: Build | null, volume: Volume | null): string | null {
  if (!build && !volume) return null;
  const parts: string[] = [];
  if (build) parts.push(`complexión ${buildLabel(build)}`);
  if (volume) {
    parts.push(`carga más en "${volumeLabel(volume)}" — para equilibrar: ${siluetaConsejo(volume).equilibra}`);
  }
  return parts.join("; ");
}

// El "premio" cálido al elegir: qué te equilibra + el efecto contrario (agencia).
// Sin juicio: nunca "disimula tu X", siempre "tú decides el efecto".
export function siluetaConsejo(v: Volume): { equilibra: string; acentua: string } {
  switch (v) {
    // --- mujer ---
    case "arriba":
      return {
        equilibra: "Los escotes en V y los cuellos abiertos te alargan el torso y equilibran.",
        acentua: "¿Quieres lo contrario? Los hombros con estructura y cuellos altos te realzan arriba a propósito.",
      };
    case "cintura":
      return {
        equilibra: "Marcar la cintura es tu jugada: todo lo que la defina te luce.",
        acentua: "¿Y si un día buscas soltura? Las líneas rectas la suavizan cuando tú quieras.",
      };
    case "abajo":
      return {
        equilibra: "Subir el foco arriba te equilibra: hombros, escotes y detalle en la parte de arriba.",
        acentua: "¿Lo contrario? Las faldas con vuelo te suman abajo a propósito.",
      };
    case "medio":
      return {
        equilibra: "Las líneas verticales y la caída suelta desde el busto te alargan y suavizan el medio.",
        acentua: "¿Acentuar? Un cinturón alto marca la cintura cuando tú decidas.",
      };
    case "pareja":
      return {
        equilibra: "Crear curva es tu juego: cinturas marcadas y capas con forma.",
        acentua: "¿Te gusta lo recto? Las líneas limpias te van perfecto tal cual.",
      };
    // --- hombre ---
    case "pecho":
      return {
        equilibra: "Tu forma de V ya hace el trabajo: las prendas rectas y los cuellos sencillos la lucen sin esfuerzo.",
        acentua: "¿Suavizar los hombros? Las capas y texturas equilibran la parte de arriba.",
      };
    case "parejo":
      return {
        equilibra: "Crear estructura es tu jugada: hombros definidos, capas y líneas que marquen.",
        acentua: "¿Te gusta lo limpio? Las siluetas rectas te van perfecto tal cual.",
      };
    case "panza":
      return {
        equilibra: "Las líneas verticales, las capas abiertas y la caída recta te alargan y limpian el medio.",
        acentua: "¿Subir el foco arriba? Los hombros con estructura llevan la mirada hacia arriba.",
      };
  }
}

// --- Puente silueta ↔ avatar -------------------------------------------------
// La complexión del perfil (body_build) es la ÚNICA fuente de verdad de
// morfología. El wizard de avatar la deriva de aquí en vez de re-preguntarla
// (antes se preguntaba dos veces: avatar body_type + silueta body_build), y si
// la silueta aún no existe, la respuesta del wizard la siembra de vuelta.

export type AvatarBodyType = "slim" | "athletic" | "average" | "full";

const BUILD_TO_BODY: Record<Build, AvatarBodyType> = {
  delgada: "slim",
  atletica: "athletic",
  media: "average",
  curvas: "full",
  grande: "full",
  delgado: "slim",
  atletico: "athletic",
  musculoso: "athletic",
  promedio: "average",
  robusto: "full",
  corpulento: "full",
};

export const buildToBodyType = (b: Build | null): AvatarBodyType | null =>
  b ? BUILD_TO_BODY[b] ?? null : null;

// Inversa gender-aware (los ids de Build son distintos por género). Desde que
// mujer tiene eje atlético propio (2026-07-23), "athletic" ya no cae a "media".
// Nota: es 4→N, así que las complexiones más grandes (grande/corpulento) no son
// alcanzables por esta vía; el avatar solo distingue 4 tipos y la elección fina
// vive en la galería de complexión.
export function bodyTypeToBuild(t: AvatarBodyType, g: Gender): Build {
  return g === "hombre"
    ? ({ slim: "delgado", athletic: "atletico", average: "promedio", full: "robusto" } as const)[t]
    : ({ slim: "delgada", athletic: "atletica", average: "media", full: "curvas" } as const)[t];
}
