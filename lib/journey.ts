// Motor de "siguiente mejor paso" post-onboarding — lógica de dominio PURA
// (sin DB ni IA; segura para cliente). Ver docs/designs/post-onboarding-nudges.md.
//
// Idea: tras el aha del primer outfit, guiamos al usuario UNO a la vez y por
// comportamiento. Cada nudge se muestra hasta que el usuario lo descarta o lo
// completa. Las SEÑALES se derivan de datos que ya existen (events, outfits,
// items, capsule_target) — aquí solo decidimos QUÉ mostrar, dado el estado.

// Orden = prioridad: tryon (P2) → closet_real (P3) → capsula (P4). El resolvedor
// devuelve UNO solo, así nunca se encima más de un nudge a la vez.
export type NudgeId = "tryon" | "closet_real" | "capsula";

export type NudgeLifecycle = {
  shown_at?: string;
  dismissed_at?: string;
  done_at?: string;
};

// Guardado en profiles.journey_state (jsonb). Parcial: una entrada por nudge tocado.
export type JourneyState = Partial<Record<NudgeId, NudgeLifecycle>>;

// Derivadas server-side de datos existentes antes de llamar al resolvedor.
export type JourneySignals = {
  likes: number; // # de vote_up (events)
  lookDays: number; // # de días con look-of-day (outfits)
  hasAvatar: boolean; // ya subió foto para el try-on
  editedCloset: boolean; // agregó foto propia o borró un básico
  hasCapsule: boolean; // capsule_target no nulo
};

// ¿Sigue "vivo"? (ni descartado ni completado → se puede volver a mostrar).
export function isOpen(l: NudgeLifecycle | undefined): boolean {
  return !l?.dismissed_at && !l?.done_at;
}

// El ÚNICO nudge a mostrar ahora, o null. Uno a la vez, por prioridad.
export function nextBestAction(
  state: JourneyState,
  signals: JourneySignals
): NudgeId | null {
  // P2 — try-on: ya enganchó (≥1 👍) y aún no tiene avatar para verse el look.
  if (signals.likes >= 1 && !signals.hasAvatar && isOpen(state.tryon)) {
    return "tryon";
  }

  // P3 — "haz tu clóset real": usó Hoy ≥2 veces y aún no editó su clóset.
  if (signals.lookDays >= 2 && !signals.editedCloset && isOpen(state.closet_real)) {
    return "closet_real";
  }

  // P4 — descubre la cápsula: ya enganchó con outfits y aún no la abrió.
  if (
    (signals.lookDays >= 2 || signals.likes >= 2) &&
    !signals.hasCapsule &&
    isOpen(state.capsula)
  ) {
    return "capsula";
  }

  return null;
}
