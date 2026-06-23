import { seasonPalette, seasonDisplayLabel, seasonMetal, type Season } from "@/lib/colorimetria";
import { buildLabel, volumeLabel, siluetaConsejo, type Build, type Volume } from "@/lib/silueta";

// Datos del Pasaporte de estilo: identidad estilística compartible (arquetipo +
// vibe + paleta + colores + silueta + lo que le favorece). Plantilla, no imagen
// generada. `heroImage` lo resuelve la página (avatar inline) — aquí va null.
export type PasaporteData = {
  name: string;
  heroImage: string | null; // avatar como data URL (lo pone la página) o null
  archetypeNombre: string | null;
  archetypeDesc: string | null;
  vibe: string[]; // taste tags ("minimalista, refinado…")
  seasonLabel: string | null; // "Otoño profundo"
  metal: "oro" | "plata" | null; // metal que le va
  swatches: string[]; // hex de la paleta (sus mejores + prestados)
  powerColors: { nombre: string; hex: string }[]; // los que le encienden la cara
  siluetaLine: string | null; // "Con más curvas · En el medio"
  favorece: string | null; // lo que la equilibra (de su silueta)
  formula: { nombre: string; image: string | null }[]; // un look real (la página lo llena)
};

// Nombre para mostrar: parte local del correo, capitalizada (no tenemos campo
// de nombre). "roberto@kublau.com" → "Roberto".
export function nameFromEmail(email: string): string {
  const local = (email.split("@")[0] || "tú").replace(/[._-]+/g, " ").trim();
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function buildPasaporte(profile: {
  email: string;
  style_archetype: { nombre: string; descripcion: string } | null;
  taste_tags: string[];
  palette_season: Season | null;
  palette_flow: Season | null;
  body_build: Build | null;
  body_volume: Volume | null;
}): PasaporteData {
  const season = profile.palette_season;
  const pal = season ? seasonPalette(season, profile.palette_flow) : null;
  const all = pal ? [...pal.mejores, ...pal.prestados] : [];

  const siluetaLine =
    profile.body_build || profile.body_volume
      ? [
          profile.body_build ? buildLabel(profile.body_build) : null,
          profile.body_volume ? volumeLabel(profile.body_volume) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return {
    name: nameFromEmail(profile.email),
    heroImage: null,
    archetypeNombre: profile.style_archetype?.nombre ?? null,
    archetypeDesc: profile.style_archetype?.descripcion ?? null,
    vibe: (profile.taste_tags ?? []).slice(0, 5),
    seasonLabel: season ? seasonDisplayLabel(season, profile.palette_flow) : null,
    metal: season ? seasonMetal(season, profile.palette_flow) : null,
    swatches: all.slice(0, 7).map((c) => c.hex),
    powerColors: (pal?.mejores ?? []).slice(0, 3).map((c) => ({ nombre: c.nombre, hex: c.hex })),
    siluetaLine,
    favorece: profile.body_volume ? siluetaConsejo(profile.body_volume).equilibra : null,
    formula: [],
  };
}
