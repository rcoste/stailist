// Tipos del estado de nudges (profiles.journey_state) — lógica de dominio PURA
// (sin DB ni IA; segura para cliente).
//
// El RESOLVEDOR de "siguiente mejor paso" (nextBestAction) se retiró cuando el
// checklist de activación de Home (lib/home-checklist) reemplazó los nudges de
// uno-en-uno. Estos tipos siguen vivos porque `lib/journey-actions.ts` (markNudge)
// aún marca el ciclo de vida de un nudge — p. ej. el avatar-wizard registra
// "tryon" como done al crear el avatar — y `lib/auth.ts` tipa `profile.journey_state`.

// Los nudges que journey_state puede llevar registrados.
export type NudgeId = "tryon" | "closet_real" | "capsula" | "silueta";

export type NudgeLifecycle = {
  shown_at?: string;
  dismissed_at?: string;
  done_at?: string;
};

// Guardado en profiles.journey_state (jsonb). Parcial: una entrada por nudge tocado.
export type JourneyState = Partial<Record<NudgeId, NudgeLifecycle>>;

// Señales de comportamiento derivadas server-side de datos existentes (events,
// outfits, items, capsule_target). Las consume el checklist de Home.
export type JourneySignals = {
  likes: number; // # de vote_up (events)
  lookDays: number; // # de días con look-of-day (outfits)
  hasAvatar: boolean; // ya subió foto para el try-on
  editedCloset: boolean; // agregó foto propia o borró un básico
  hasCapsule: boolean; // capsule_target no nulo
  hasSilueta: boolean; // ya eligió complexión o dónde carga volumen
  siluetaApplies: boolean; // género mujer/hombre (la silueta tiene contenido propio)
};
