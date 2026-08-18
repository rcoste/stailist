import type { Modelo } from "./index";

// Los modelos que se pueden poner a competir en el comparador.
//
// Esto NO es lo que usa producción — eso vive en lib/models.ts y se mueve sólo
// cuando una comparación lo justifica. Aquí está la banca: quién puede entrar a
// la cancha a que lo midan.
//
// LO QUE CUESTA Y TARDA LEER UNA PRENDA, medido de verdad el 2026-08-05 con
// una foto real del clóset (una chamarra negra, 442kb):
//
//                          costo      tiempo   lo que leyó
//   Haiku 4.5              $0.0040    11.0s    "Chaqueta negra con cierre"
//   Gemini 3.5 Flash       $0.0038     2.2s    "Chaqueta deportiva negra"
//   Gemini 3.6 Flash       $0.0037     6.3s    "Chamarra negra con cierre"
//   Gemini 3.5 Flash-Lite  $0.0009     2.1s    "Chamarra negra"
//   Gemini 3.1 Flash-Lite  $0.0007     1.3s    "Chamarra softshell negra"
//
// Los cinco leyeron bien la prenda. La diferencia de precio entre el más caro y
// el más barato es de casi 6 veces, y la de tiempo de 8 — y eso ANTES de meter
// a Opus, que es lo que corre hoy en producción y cuesta ~$0.017 por prenda.
//
// Puesto en un onboarding de 1,000 personas con 30 prendas cada una: unos $500
// con Opus contra unos $20 con Flash-Lite. Ése es el tamaño real de la pregunta.
// Que TODOS acierten en una chamarra negra no dice nada todavía: la prueba está
// en las prendas difíciles —lino contra algodón, polo contra camisa, el color
// real bajo una luz mala— y para eso existe la pantalla.
//
// Gemini 2.5 Flash-Lite NO está: la API lo rechaza con 404 para cuentas nuevas.
// Lo cachó un test de humo antes de gastar en una corrida entera.

export const CATALOGO: Modelo[] = [
  { proveedor: "anthropic", id: "claude-opus-5", etiqueta: "Opus 5" },
  { proveedor: "anthropic", id: "claude-sonnet-5", etiqueta: "Sonnet 5" },
  { proveedor: "anthropic", id: "claude-haiku-4-5-20251001", etiqueta: "Haiku 4.5" },
  { proveedor: "gemini", id: "gemini-3.7-flash", etiqueta: "Gemini 3.7 Flash" },
  { proveedor: "gemini", id: "gemini-3.6-flash", etiqueta: "Gemini 3.6 Flash" },
  { proveedor: "gemini", id: "gemini-3.5-flash", etiqueta: "Gemini 3.5 Flash" },
  { proveedor: "gemini", id: "gemini-3.5-flash-lite", etiqueta: "Gemini 3.5 Flash-Lite" },
  { proveedor: "gemini", id: "gemini-3.1-flash-lite", etiqueta: "Gemini 3.1 Flash-Lite" },
  // Vía OpenRouter: una sola llave para todo lo que no es Anthropic ni Google.
  // Aparecen deshabilitados hasta que exista OPENROUTER_API_KEY.
  //
  // DOS FILTROS QUE HAY QUE PASAR PARA ENTRAR AQUÍ, y los verifiqué contra el
  // catálogo de OpenRouter el 2026-08-05 en vez de confiar en el nombre:
  //   1. QUE VEA IMÁGENES. De los 340 modelos, sólo 91 tienen entrada de
  //      imagen. Kimi K2 y DeepSeek Chat —los dos que había puesto de memoria—
  //      NO la tienen: aquí no habrían servido de nada.
  //   2. QUE ACEPTE UN SCHEMA de salida. Sin eso la respuesta llega como texto
  //      libre y no se puede comparar campo por campo con las demás.
  { proveedor: "openrouter", id: "moonshotai/kimi-k2.6", etiqueta: "Kimi K2.6" },
  { proveedor: "openrouter", id: "qwen/qwen3-vl-32b-instruct", etiqueta: "Qwen3-VL 32B" },
  { proveedor: "openrouter", id: "meta-llama/llama-4-scout", etiqueta: "Llama 4 Scout" },
  { proveedor: "openrouter", id: "mistralai/mistral-small-3.2-24b-instruct", etiqueta: "Mistral Small 3.2" },
];

export function modeloPorId(id: string): Modelo | null {
  return CATALOGO.find((m) => m.id === id) ?? null;
}

/**
 * Los retadores del motor en el comparador. Viven aquí (la banca) y no en
 * lib/models.ts (producción): nombrarlos no los pone a correr en el producto.
 *
 * Dos clases, y la lectura de sus resultados NO es la misma:
 * - MISMA FAMILIA (sonnet, haiku): la comparación justa — los modismos de un
 *   prompt afinado 38 versiones contra Claude se trasladan. Una derrota aquí
 *   sí habla del modelo.
 * - OTRO PROVEEDOR (geminiFlash, kimi): el TRAJE PRESTADO. Si pierden su
 *   vistazo, eso condena al combo modelo+prompt, no al modelo — adaptarles el
 *   prompt sería otro proyecto. Si sobreviven pese al traje, eso sí es señal.
 *
 * La escalera (calcada de la decisión de visión): el vistazo de 6 pares solo
 * DESCARTA o promueve; únicamente quien sobrevive gana derecho a un veredicto
 * de 20-40 con regla pre-registrada.
 *
 * LA PUERTA DE ENTRADA (verificada con scripts/smoke-motor.ts ANTES de entrar,
 * como en visión): aceptar el schema del motor CON el enum anti-invención del
 * clóset (~113 UUIDs). Haiku 4.5 NO pasa — la API lo rechaza con "Schema is
 * too complex for compilation" (2026-08-06). Correrlo sin el enum sería
 * medirlo con otro arnés, así que queda fuera, no degradado.
 */
export const RETADOR_MOTOR = "claude-sonnet-5";
export const RETADORES_MOTOR = {
  sonnet: RETADOR_MOTOR,
  geminiFlash: "gemini-3.5-flash",
  gemini37: "gemini-3.7-flash",
  kimi: "moonshotai/kimi-k2.6",
} as const;

/**
 * Los retadores de la RÚBRICA QUE MIRA (scripts/rubrica-vision-modelo.ts).
 *
 * Producción juzga con VISION_MODEL —Gemini 3.1 Flash-Lite—, que ganó a ciegas
 * la prueba de LEER prendas. Criticar estilo es otra tarea y más difícil, y
 * nunca se midió: sobre los looks calificados a mano coincide con el humano el
 * 84%, y aprobar todo daría 87%.
 *
 * Los dos contestan preguntas DISTINTAS y por eso son dos:
 *   · `tier` — mismo proveedor, un escalón arriba. Si sube, era el modelo.
 *   · `tarea` — el que ya saca 89% juzgando por TEXTO. Si mirando también se
 *     queda en 84%, el problema no es el modelo sino que juzgar estilo desde
 *     fotos es difícil.
 */
export const RETADORES_VISION = {
  tier: "gemini-3.5-flash",
  tarea: RETADOR_MOTOR,
} as const;

/** Qué proveedores tienen llave puesta. Lo usa la pantalla para no ofrecer lo que no corre. */
export function proveedoresListos(): Record<string, boolean> {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}
