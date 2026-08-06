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
 * El retador natural del motor en el comparador: mismo prompt y mismas reglas,
 * generador en Sonnet. Es la única comparación de modelo JUSTA hoy — misma
 * familia, así que los modismos de un prompt afinado 38 versiones contra
 * Claude se trasladan; dárselo a otro proveedor mediría el traje prestado.
 * Vive aquí (la banca) y no en lib/models.ts (producción): nombrarlo no lo
 * pone a correr en el producto.
 */
export const RETADOR_MOTOR = "claude-sonnet-5";

/** Qué proveedores tienen llave puesta. Lo usa la pantalla para no ofrecer lo que no corre. */
export function proveedoresListos(): Record<string, boolean> {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}
