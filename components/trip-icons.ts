import type { IconName } from "@/components/icon";
import type { Luggage, Occasion } from "@/lib/trip";

// El ícono de cada actividad y tipo de maleta del viaje. Vivían dentro de
// trip-wizard; salieron a su propio módulo cuando la pestaña "el plan" del
// detalle (handoff viaje 2) necesitó los mismos tiles de actividad — importar
// del wizard habría arrastrado todo su bundle al detalle.
export const ACT_ICON: Record<Occasion, IconName> = {
  playa: "playa",
  ciudad: "ciudad",
  trabajo: "maletin",
  noche: "luna",
  aire: "hoja",
  traslado: "avion",
};

export const LUG_ICON: Record<Luggage, IconName> = {
  mochila: "mochila",
  mano: "maletin",
  documentada: "maleta",
};
