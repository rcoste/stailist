// Selector de silueta: dos ejes simples (complexión + dónde carga volumen).
// Tamaño = para REPRESENTAR (la app te muestra con un cuerpo como el tuyo).
// Volumen = para RECOMENDAR (qué te equilibra / qué efecto logras).
// Es autoselect, opcional, y el avatar puede refinarlo después.

export type Build = "delgada" | "media" | "curvas";
export type Volume = "arriba" | "cintura" | "abajo" | "medio" | "pareja";

export const BUILDS: { id: Build; label: string; img: string }[] = [
  { id: "delgada", label: "Delgada", img: "/siluetas/complexion/1-delgada.png" },
  { id: "media", label: "Media", img: "/siluetas/complexion/2-media.png" },
  { id: "curvas", label: "Con más curvas", img: "/siluetas/complexion/3-curvas.png" },
];

// Zona resaltada sobre el cuerpo: [left%, top%, width%, height%].
export type Zone = [number, number, number, number];
export const VOLUMES: {
  id: Volume;
  label: string;
  desc: string;
  zones: Zone[];
  band?: boolean;
}[] = [
  { id: "arriba", label: "Arriba", desc: "busto u hombros", zones: [[28, 24, 44, 12]] },
  { id: "cintura", label: "Cintura marcada", desc: "parejo, cintura definida", zones: [[30, 25, 40, 10], [26, 47, 48, 12]] },
  { id: "abajo", label: "Abajo", desc: "cadera y muslos", zones: [[25, 47, 50, 14]] },
  { id: "medio", label: "En el medio", desc: "abdomen", zones: [[29, 35, 42, 15]] },
  { id: "pareja", label: "Bastante pareja", desc: "sin mucha curva", zones: [], band: true },
];

export const BUILD_LABEL = new Map(BUILDS.map((b) => [b.id, b.label]));
export const VOLUME_LABEL = new Map(VOLUMES.map((v) => [v.id, v.label]));
export const buildImg = (b: Build | null) => BUILDS.find((x) => x.id === b)?.img ?? null;

export function isBuild(v: unknown): v is Build {
  return v === "delgada" || v === "media" || v === "curvas";
}
export function isVolume(v: unknown): v is Volume {
  return v === "arriba" || v === "cintura" || v === "abajo" || v === "medio" || v === "pareja";
}

// El "premio" cálido al elegir: qué te equilibra + el efecto contrario (agencia).
// Sin juicio: nunca "disimula tu X", siempre "tú decides el efecto".
export function siluetaConsejo(v: Volume): { equilibra: string; acentua: string } {
  switch (v) {
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
  }
}
