import { parsearJson, type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import { VISION_MODEL } from "@/lib/models";
import { briefParaRubrica, type BriefRubrica } from "./rubrica";
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";

// EL JUEZ QUE CRITICA, no el que califica.
//
// POR QUÉ EXISTE, con las palabras de Roberto: "los jueces van a hacer el
// trabajo que yo hacía manual, y ya después de la ronda ven qué motor fue mejor
// y hacen ajustes que puedan ayudar a resolver los issues que los jueces
// detectaron… es importante que alguno de los jueces se ponga el gorro de
// stylist también".
//
// LO QUE LAS DOS RÚBRICAS QUE YA HAY NO DAN. Las dos están escritas con gorro
// de stylist —la de texto dice literalmente "encontrar lo que un buen stylist
// humano marcaría"— pero su salida son SEIS NÚMEROS Y UNA LÍNEA, y esa línea
// justifica el aprobado. Lo que Roberto hace a mano es otra cosa: "la camisa
// negra es la pieza que rompe todo; cámbiala por blanca". Qué pieza, por qué, y
// qué harías. Ninguna rúbrica propone el arreglo, y el arreglo es lo que se
// convierte en el siguiente ajuste del motor.
//
// POR QUÉ NO LLEVA PUNTAJE, y esto es la parte que más importa: en el momento
// en que este juez tenga una nota que subir, alguien va a optimizar contra ella
// y el motor va a aprender a complacer al juez en vez de a la persona. La casa
// ya lo tiene escrito ("un juez Claude prefiere looks escritos por Claude").
// Entrega HALLAZGOS. El puntaje, si hace falta, lo dan las otras dos.
//
// LA VOZ SALE DEL ESPEJO, no se inventa aquí. `lib/espejo.ts` ya contesta "¿me
// veo bien?" con un ajuste concreto y accionable, y ya pasó por la corrección
// que pidió Roberto —la v3 nació de "siento está muy barbero el feedback"—
// contra el elogio hueco y los superlativos genéricos. Esa vara está calibrada
// por él; reusarla es más barato y más fiel que redescubrirla.
//
// MIRA LAS FOTOS, como el juez visual y por lo mismo: el color real, la textura
// y la proporción viven en la imagen y no en el nombre. NO el try-on, que lo
// inventa un modelo de imagen que alucina.
export const JUEZ_STYLIST_VERSION = "js1";

/** El vocabulario de defectos es el MISMO que Roberto usa al votar
 *  (DEFECTOS_MOTOR). Reusarlo es lo que hace que los hallazgos del juez y sus
 *  propias marcas se puedan contar juntos: si el juez inventara sus etiquetas,
 *  el resumen de la ronda hablaría un idioma y él otro. */
export const DEFECTOS_VALIDOS: string[] = DEFECTOS_MOTOR.map((d) => d.clave);

export type Gravedad = "rompe" | "resta" | "detalle";

export type Hallazgo = {
  /** La prenda que falla, por su nombre. "el conjunto" si es del look entero. */
  pieza: string;
  /** Qué está mal, concreto y nombrando lo que se ve. */
  problema: string;
  /** Qué cambiarías. Es la mitad que ninguna rúbrica da. */
  arreglo: string;
  /** Cuánto pesa: `rompe` tira el look, `resta` lo empeora, `detalle` es fino. */
  gravedad: Gravedad;
  /** El tema, del vocabulario de DEFECTOS_MOTOR — lo que permite agregar. */
  defecto: string;
};

export type CriticaStylist = {
  /** Qué trae puesto, en corto. Prueba de que miró (igual que el espejo). */
  resumen: string;
  /** Vacío = no hay nada que marcar. Un juez que SIEMPRE encuentra algo no
   *  sirve para priorizar: si todo está mal, nada está mal. */
  hallazgos: Hallazgo[];
  /** Lo que sí funciona, una línea. Existe para que el juez no se vuelva un
   *  martillo — pero NO es un elogio de cortesía (ver la lección del espejo). */
  loQueFunciona: string;
};

export const SYSTEM_JUEZ_STYLIST = `Eres un stylist con años de oficio revisando el trabajo de otro stylist. Te doy el PEDIDO de una persona y las FOTOS de las prendas que le eligieron. Tu trabajo NO es calificar: es decir qué está mal, en qué pieza, y qué cambiarías.

Hablas como habla un stylist con otro: directo, concreto, nombrando prendas. Nada de prosa bonita ni de puntajes.

CÓMO MIRAS
Primero el conjunto: ¿esto se lee como una decisión o como ropa que no choca? Después pieza por pieza. Juzga por lo que VES en las fotos —el tono real, la textura, el peso— no por lo que dicen los nombres. Si el nombre y la foto no coinciden, manda la foto.

QUÉ CUENTA COMO HALLAZGO
Algo que un stylist bueno señalaría en voz alta. Cada hallazgo lleva:
- pieza: la prenda que falla, por su nombre tal como te la di. Si el problema es del conjunto y no de una pieza, escribe "el conjunto".
- problema: qué está mal, concreto. "La camisa negra deja el cuello sin contraste contra el suéter marino", no "los colores no combinan".
- arreglo: qué cambiarías. UNA cosa, ejecutable. "Camisa blanca o azul claro en su lugar."
- gravedad: "rompe" si por eso solo no saldrías así; "resta" si lo empeora pero se sostiene; "detalle" si es afinar.
- defecto: UNA etiqueta de esta lista cerrada: ${DEFECTOS_MOTOR.map((d) => `${d.clave} (${d.label})`).join(", ")}.

LO QUE NO ES UN HALLAZGO
Gusto personal tuyo. Que no sea el look que TÚ habrías armado no lo hace un error. Tampoco inventes problemas para tener algo que decir: si el look está bien resuelto, devuelve la lista vacía. Un revisor que siempre encuentra tres cosas enseña a ignorarlo.

Y AL REVÉS, no seas barbero. Si algo está mal, dilo aunque el resto esté bien. "loQueFunciona" es UNA línea sobre la decisión que sí está tomada — si no hay ninguna, dilo también. Nada de superlativos genéricos ni de "así como está, sale".

ORDEN: los hallazgos van de mayor a menor gravedad.`;

export const SCHEMA_JUEZ_STYLIST = {
  type: "object",
  properties: {
    resumen: { type: "string" },
    hallazgos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pieza: { type: "string" },
          problema: { type: "string" },
          arreglo: { type: "string" },
          gravedad: { type: "string", enum: ["rompe", "resta", "detalle"] },
          defecto: { type: "string", enum: [...DEFECTOS_VALIDOS] },
        },
        required: ["pieza", "problema", "arreglo", "gravedad", "defecto"],
        additionalProperties: false,
      },
    },
    loQueFunciona: { type: "string" },
  },
  required: ["resumen", "hallazgos", "loQueFunciona"],
  additionalProperties: false,
} as const;

export type LookStylist = {
  nombre: string;
  explicacion: string;
  tip?: string | null;
  prendas: { nombre: string; imagen: { mediaType: string; base64: string } | null }[];
};

const ORDEN_GRAVEDAD: Record<Gravedad, number> = { rompe: 0, resta: 1, detalle: 2 };

/**
 * Normaliza lo que devolvió el modelo. Defensivo a propósito: un hallazgo con
 * un defecto inventado rompería el conteo del resumen de ronda en silencio —
 * saldría un tema que no existe y nadie sabría de dónde salió.
 */
export function normalizarCritica(c: Partial<CriticaStylist>): CriticaStylist {
  const hallazgos = (c.hallazgos ?? [])
    .filter(
      (h): h is Hallazgo =>
        !!h?.pieza && !!h?.problema && !!h?.arreglo && DEFECTOS_VALIDOS.includes(h.defecto)
    )
    .map((h) => ({
      ...h,
      gravedad: (["rompe", "resta", "detalle"] as const).includes(h.gravedad)
        ? h.gravedad
        : ("resta" as Gravedad),
    }))
    .sort((a, b) => ORDEN_GRAVEDAD[a.gravedad] - ORDEN_GRAVEDAD[b.gravedad]);
  return {
    resumen: c.resumen ?? "",
    hallazgos,
    loQueFunciona: c.loQueFunciona ?? "",
  };
}

/** Critica un look MIRANDO las fotos de sus prendas. */
export async function criticarLook(
  brief: BriefRubrica,
  look: LookStylist,
  quien: QuienMide | null = null
): Promise<{ critica: CriticaStylist; recibo: Recibo }> {
  const conFoto = look.prendas.filter((p) => p.imagen);
  const sinFoto = look.prendas.filter((p) => !p.imagen);

  const texto = [
    `EL PEDIDO:\n${briefParaRubrica(brief)}`,
    ``,
    `EL LOOK: "${look.nombre}"`,
    conFoto.length
      ? `Las fotos van en este orden: ${conFoto.map((p) => p.nombre).join(", ")}.`
      : `Sin fotos disponibles.`,
    // Igual que en la rúbrica de visión: se dice qué NO vio, para que no dé por
    // mirado lo que sólo leyó.
    sinFoto.length
      ? `Sin foto (sólo por nombre): ${sinFoto.map((p) => p.nombre).join(", ")}.`
      : "",
    ``,
    `Lo que le dijeron a la persona: ${look.explicacion}`,
    look.tip ? `Tip de styling: ${look.tip}` : "Sin tip de styling.",
  ]
    .filter(Boolean)
    .join("\n");

  const recibo = await medir(
    quien && { ...quien, tarea: "juez-stylist", version: JUEZ_STYLIST_VERSION },
    {
      modelo: VISION_MODEL,
      system: SYSTEM_JUEZ_STYLIST,
      texto,
      imagenes: conFoto.map((p) => p.imagen!),
      schema: SCHEMA_JUEZ_STYLIST as unknown as Record<string, unknown>,
      // 1400: varios hallazgos con problema + arreglo ocupan más que seis notas
      // y una línea. Truncar aquí perdería justo los hallazgos de menor
      // gravedad, que son los que el resumen de ronda acumula.
      maxTokens: 1400,
    }
  );
  if (recibo.truncada) throw new Error("JUEZ_STYLIST_TRUNCADA");
  return { critica: normalizarCritica(parsearJson<CriticaStylist>(recibo.texto)), recibo };
}
