// Catálogo de hints: qué tips existen y CÓMO se presentan.
//
// Vive aparte de lib/hints.ts porque ese archivo es "use server" y ahí solo
// pueden exportarse funciones async — no un tipo ni una constante.
//
// El modo NO es un detalle visual, es un contrato:
//   · "centrado"  → velo plano, nota al centro. No necesita nada más.
//   · "spotlight" → recorta un elemento REAL de la pantalla, así que EXIGE un
//                   [data-hint-target="<id>"] en algún componente. Sin él el tip
//                   no se dibuja nunca.
//
// Ese "nunca" fue un bug real y silencioso: el rediseño del detalle del look
// (commit 7200585, 2026-07-24) borró el target de `hoy-tryon` y el tip quedó
// muerto sin que nada fallara. Por eso el modo se declara aquí y hay un test
// (hints-catalog.test.ts) que truena si un spotlight se queda sin su target.

export type HintId =
  // Orientación (dónde estás / para qué sirve la sección)
  | "hoy-casa"
  | "fab-generar"
  | "closet-tabs"
  | "historial-worn"
  | "wishlist-cartera"
  | "viaje"
  // Función de valor (qué puedes HACER dentro de la sección)
  | "hoy-tryon"
  | "closet-agregar"
  | "capsula-swap";

export type HintModo = "centrado" | "spotlight";

export const HINT_MODO: Record<HintId, HintModo> = {
  // Orientación general: no hay UN elemento que señalar.
  "hoy-casa": "centrado",
  "historial-worn": "centrado",
  // Señalan un elemento concreto.
  "fab-generar": "spotlight",
  "closet-tabs": "spotlight",
  "wishlist-cartera": "spotlight",
  viaje: "spotlight",
  "hoy-tryon": "spotlight",
  "closet-agregar": "spotlight",
  "capsula-swap": "spotlight",
};

export const HINT_IDS = Object.keys(HINT_MODO) as HintId[];
