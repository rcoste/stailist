import { type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import { MODELO_MOTIVO_DESTINO } from "@/lib/models";

// LA FOTO DE UN DESTINO NUEVO: qué se dibuja y con qué fórmula.
//
// La fórmula visual es LA MISMA que generó el catálogo estático
// (scripts/gen-destinos.mjs) — B&N frío de alto contraste, sujeto dominante,
// sin gente ni letreros. Está DUPLICADA aquí a propósito: el script es .mjs de
// terminal y no puede importar TS. El test de este archivo lee el script y
// verifica que las dos copias sigan siendo idénticas — si alguien afina la
// fórmula en un lado, el test truena y obliga a copiar el ajuste al otro.
//
// Cada pieza está por una razón, no por adorno (el porqué largo vive en el
// script, junto a las correcciones medidas de la primera tirada):

export const FORMULA_MONO =
  "Pure neutral BLACK AND WHITE monochrome — absolutely no color, NO sepia, NO warm toning, NO split toning, NO blue tint.";
export const FORMULA_LUZ =
  "Cool neutral daylight from an open overcast sky or high open shade. NO golden hour, NO sunrise, NO sunset, NO warm light, NO lens flare.";
export const FORMULA_GRANO =
  "HIGH-KEY and airy: bright pale sky, luminous soft surfaces, gentle silver-gray midtones, NO heavy shadows, NO deep crushed blacks — the whole image reads light and open, like a slightly overexposed editorial film photo. Fine 35mm film grain, crisp and sharp, editorial magazine quality.";
export const FORMULA_COMPOSICION =
  "Calm minimal composition: the main subject is LARGE and dominant, filling most of the frame, with clean negative space around it — never a tiny distant subject lost in an empty sky. Strong graphic shapes reading as bold silhouettes. Quiet, architectural, unhurried.";
export const FORMULA_LIMPIO =
  "No people in the foreground, no faces, no posing tourists (tiny distant anonymous silhouettes are acceptable). No text, no letters, no signage, no logos, no watermarks. The photograph bleeds edge to edge and fills the entire canvas: NO white border, NO frame, NO matte, NO passe-partout, NO polaroid edge, no collage.";

export function promptDestino(sujeto: string): string {
  return `Fine-art black and white travel photograph of ${sujeto}. ${FORMULA_MONO} ${FORMULA_LUZ} ${FORMULA_GRANO} ${FORMULA_COMPOSICION} ${FORMULA_LIMPIO}`;
}

const SCHEMA_MOTIVO = {
  type: "object",
  properties: { sujeto: { type: "string" } },
  required: ["sujeto"],
  additionalProperties: false,
} as Record<string, unknown>;

// El sistema le enseña con EJEMPLOS REALES del catálogo (los que ya funcionaron
// a 140px) en vez de describir el estilo en abstracto: es la diferencia entre
// pedir "un monumento" y enseñar cómo se pide para que la foto sirva chiquita.
const SYSTEM_MOTIVO = `Eres el editor fotográfico de una app de moda. Te doy el nombre de un destino de viaje y contestas con el SUJETO de una fotografía en blanco y negro que lo represente — el lugar o edificio MÁS reconocible e icónico de ese destino, descrito en inglés para un generador de imágenes.

CÓMO SE DESCRIBE UN SUJETO (ejemplos reales de nuestro catálogo, imítalos):
- "the Angel of Independence victory column monument in Mexico City, photographed from below at a three-quarter angle against a wide open sky"
- "the tall organic stone spires of the Sagrada Familia basilica in Barcelona rising against an open sky"
- "a quiet canal in Amsterdam lined with narrow tall gabled houses, an arched bridge crossing in the middle distance"

REGLAS:
- UN solo sujeto, grande y dominante — la foto se ve a 140px y lo que sobrevive es la silueta, no el detalle.
- Concreto y verificable: el nombre real del monumento/lugar. Si el destino no tiene un ícono famoso, describe su paisaje o arquitectura TÍPICA sin inventar monumentos ("colonial stone facades and arched portales of a small Mexican highland town").
- Sin gente en primer plano, sin texto ni letreros (la foto los prohíbe).
- Nada de comida, mercados o interiores: exteriores con formas gráficas fuertes.`;

/**
 * El sujeto visual para la foto de un destino ("Osaka" → "Osaka Castle...").
 *
 * Corre UNA vez por destino en la vida del producto y su error tiene red: la
 * foto genérica queda de fallback y un admin puede regenerar. Por eso va en el
 * modelo barato — y porque la elección fue de Roberto ("hacemos ahí un haiku").
 */
export async function elegirMotivo(
  lugar: string,
  /**
   * Quién está creando el viaje. El recibo lo guardaba la ruta a mano y sólo en
   * el camino feliz: cuando esta llamada tronaba —y su fallo tiene red, así que
   * truena sin que nadie lo note— no quedaba nada. Aquí se registran las dos.
   */
  quien: QuienMide | null = null
): Promise<{ sujeto: string; recibo: Recibo }> {
  const recibo = await medir(quien && { ...quien, tarea: "destino-motivo" }, {
    modelo: MODELO_MOTIVO_DESTINO,
    maxTokens: 300,
    system: SYSTEM_MOTIVO,
    texto: `Destino: ${lugar}`,
    schema: SCHEMA_MOTIVO,
  });
  const { sujeto } = JSON.parse(recibo.texto) as { sujeto: string };
  const limpio = (sujeto ?? "").trim();
  if (!limpio) throw new Error("MOTIVO_VACIO");
  return { sujeto: limpio, recibo };
}
