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

// Dos retirados el 2026-07-29:
// · "historial-worn" ("márcale me lo puse") — nombraba una acción que ya no vive
//   en Historial: el worn se mudó a Hoy como la card "¿te lo pusiste?".
// · "closet-agregar" ("súmale tu ropa real") — señalaba el botón "agregar" para
//   anunciar las tres formas de sumar ropa. Ahora esas tres formas están
//   DESPLEGADAS en el clóset (ClosetLlenalo) mientras no haya foto propia, así
//   que el tip explicaba lo que ya se ve, y señalaba un botón que dejó de ser el
//   camino. Un tip encima de contenido autoexplicativo es una puerta que dice
//   EMPUJE.
//
// Y uno nuevo, "closet-boton-agregar": el caso legítimo del mismo cambio. Al
// subir tu primera foto el bloque se retira y el botón "agregar" aparece donde
// antes no había nada; sin avisar, la persona busca el atajo que venía usando y
// no lo encuentra. Este tip NO explica algo que ya se ve — señala un control que
// acaba de aparecer, que es para lo que sirve un coach-mark.
// Otro retirado el 2026-08-11 (rediseño del home, handoff design_handoff_inicio):
// · "hoy-casa" ("esta es tu central — pídeme un look, enséñame el que traes...")
//   — describía de corrido las tres acciones de una pantalla que ahora se
//   explica sola (hero-pregunta + CTA + tiles con nombre). Lo reemplaza
//   "hoy-fitcheck": UN spotlight al tile del fit check, que es la acción nueva
//   que nadie conoce y la que más trabaja (veredicto + carga prendas + hábito).
//   Id nuevo a propósito: quien ya vio "hoy-casa" también debe ver este.
export type HintId =
  // Orientación (dónde estás / para qué sirve la sección)
  | "fab-generar"
  | "closet-tabs"
  | "wishlist-cartera"
  | "viaje"
  // Función de valor (qué puedes HACER dentro de la sección)
  | "hoy-fitcheck"
  | "hoy-tryon"
  | "capsula-swap"
  // Continuidad: un control que ANTES no estaba y ahora sí
  | "closet-boton-agregar";

export type HintModo = "centrado" | "spotlight";

export const HINT_MODO: Record<HintId, HintModo> = {
  // Señalan un elemento concreto.
  "fab-generar": "spotlight",
  "closet-tabs": "spotlight",
  "wishlist-cartera": "spotlight",
  viaje: "spotlight",
  "hoy-fitcheck": "spotlight",
  "hoy-tryon": "spotlight",
  "capsula-swap": "spotlight",
  "closet-boton-agregar": "spotlight",
};

export const HINT_IDS = Object.keys(HINT_MODO) as HintId[];
