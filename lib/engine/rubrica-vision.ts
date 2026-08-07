import { llamar, parsearJson, type Recibo } from "@/lib/proveedores";
import { VISION_MODEL } from "@/lib/models";
import {
  briefParaRubrica,
  normalizarNota,
  SCHEMA_RUBRICA,
  type BriefRubrica,
  type NotaRubrica,
} from "./rubrica";

// LA RÚBRICA QUE MIRA, no la que lee.
//
// POR QUÉ EXISTE
// Idea de Roberto: "hemos visto que yo veo cosas que tú no ves. Igual el
// modelo de visión ve cosas que yo hubiera visto, y nos podemos ahorrar; lo
// metemos como última capa del loop".
//
// El diagnóstico es correcto y se puede nombrar con precisión: cuando Roberto
// vota, ve una CUADRÍCULA DE FOTOS de las prendas. La rúbrica de texto solo ve
// nombres ("Camisa oxford blanca", "Chinos carbón"). Todo lo que vive en la
// imagen y no en el nombre —el tono real, la textura, la proporción, si dos
// piezas se pelean a la vista— es invisible para ella. Y en el veredicto hubo
// 11 de 21 👎 que ni el código ni el juez de texto cazaron.
//
// LO QUE JUZGA Y LO QUE NO
// Las fotos de las PRENDAS, que es el mismo campo visual del humano. NO el
// try-on renderizado: ese lo inventa un modelo de imagen que alucina, así que
// juzgarlo sería juzgar la interpretación del renderizador y no la decisión
// del motor — un buen outfit con mal render saldría castigado. Además cuesta
// ~$0.13 y 16s por look, contra las fotos que ya existen.
//
// MISMA RÚBRICA, OTRO SENTIDO. Comparte brief y schema con rubrica.ts a
// propósito: si cambiara la vara, la comparación entre las dos no diría cuál
// ve más, diría que miden cosas distintas.
export const RUBRICA_VISION_VERSION = "rv1";

export const SYSTEM_RUBRICA_VISION = `Eres el evaluador visual de stailist. Te doy el PEDIDO de una persona y las FOTOS de las prendas que un stylist con IA eligió para ella. Tu ventaja sobre un evaluador de texto es que TÚ VES: el tono real de cada pieza, la textura, el peso de la tela, y cómo se ven juntas.

Primero llena "analisis" describiendo lo que VES —no lo que dicen los nombres—: qué tonos son de verdad, qué texturas, y si las piezas conviven o se pelean. Apóyate en lo que la imagen muestra; si algo del nombre no coincide con la foto, manda la foto.

Después puntúa de 1 a 5, igual que el evaluador de texto:

1. ocasion — ¿el registro que se VE corresponde al pedido? Una prenda puede llamarse formal y verse deportiva.
2. clima — ¿los pesos y materiales que se ven corresponden al clima del pedido? Aquí la foto manda: un punto grueso se ve grueso.
3. armado — ¿las piezas se hablan? Tonos que conviven o chocan, texturas que contrastan o se funden, proporciones que funcionan. ESTE es el punto donde más ves tú que un evaluador de texto.
4. wow — ¿se ve que hubo un stylist detrás, o es ropa que no choca? 3 = correcto pero plano; 5 = una decisión con chispa Y un gesto de styling concreto y ejecutable en el tip.

aprobado: ¿alguien que se viste bien saldría así? Un choque visual claro lo tira aunque los nombres suenen bien.

porQue: una línea concreta, nombrando lo que VISTE.`;

export type LookVision = {
  nombre: string;
  explicacion: string;
  tip?: string | null;
  /** Las prendas CON su imagen: la cuadrícula que ve el humano al votar. */
  prendas: { nombre: string; imagen: { mediaType: string; base64: string } | null }[];
};

/**
 * Califica un look MIRANDO las fotos de sus prendas.
 *
 * Las prendas sin imagen viajan solo por nombre: se dice explícitamente para
 * que el juez no dé por visto lo que no vio.
 */
export async function evaluarLookConVision(
  brief: BriefRubrica,
  look: LookVision
): Promise<{ nota: NotaRubrica; recibo: Recibo }> {
  const conFoto = look.prendas.filter((p) => p.imagen);
  const sinFoto = look.prendas.filter((p) => !p.imagen);

  const texto = [
    `EL PEDIDO:\n${briefParaRubrica(brief)}`,
    ``,
    `EL LOOK: "${look.nombre}"`,
    `Las fotos van en este orden: ${conFoto.map((p) => p.nombre).join(", ")}.`,
    sinFoto.length
      ? `SIN foto (júzgalas solo por el nombre, y no des por visto lo que no viste): ${sinFoto
          .map((p) => p.nombre)
          .join(", ")}.`
      : "",
    `Explicación al usuario: ${look.explicacion}`,
    look.tip ? `Tip de styling: ${look.tip}` : "Sin tip de styling.",
  ]
    .filter(Boolean)
    .join("\n");

  const recibo = await llamar({
    modelo: VISION_MODEL,
    system: SYSTEM_RUBRICA_VISION,
    texto,
    imagenes: conFoto.map((p) => p.imagen!),
    schema: SCHEMA_RUBRICA as unknown as Record<string, unknown>,
    maxTokens: 900,
  });
  if (recibo.truncada) throw new Error("RUBRICA_VISION_TRUNCADA");
  return { nota: normalizarNota(parsearJson<NotaRubrica>(recibo.texto)), recibo };
}
