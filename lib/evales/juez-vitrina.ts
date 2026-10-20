import { MODELO_JUEZ_VITRINA } from "@/lib/models";
import { parsearJson, type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import type { CandidatoMedicion, HuecoMedicion } from "./vitrina-medicion";

// EL JUEZ DE LA VITRINA: una pregunta cerrada por candidato (2026-10-21).
//
// No decide nada en producción —la vitrina no usa IA— y no sustituye a
// Roberto: su veredicto se guarda junto al de él y la pantalla mide cuánto
// coinciden. Si coinciden mucho, la próxima vez que cambie el diccionario de
// términos o de colores el juez puede vigilar solo las ~2,000 preguntas; si
// coinciden poco, el juez se tira y se queda el voto humano. Esa es la única
// razón de que exista: comprar una segunda lectura barata para calibrarla.
//
// La pregunta es la del hueco, no la del catálogo: "¿ESTA prenda es LA PIEZA
// que pide la maleta?". Un pantalón de sudadera para "sweater" es no aunque
// sea bonito; un vestido de lino para un vestido de noviembre es no aunque el
// color coincida. El precio va como dato, no como criterio.

export const JUEZ_VITRINA_VERSION = "jv1";

export const SYSTEM_JUEZ_VITRINA = `Eres un stylist profesional revisando una tienda en línea para una clienta o cliente.
La maleta de un viaje le pide una PIEZA concreta que no tiene. Te enseñan UNA prenda de Uniqlo y contestas si esa prenda ES la pieza que pide la maleta: la compraría para cubrir ese hueco, tal cual.

Criterios, en este orden:
1. Tipo de prenda: tiene que ser la misma clase de prenda (un suéter no es un pantalón de sudadera; una camisa no es una playera; un cárdigan abierto no es un suéter cerrado salvo que el hueco lo admita).
2. Color: tiene que caer dentro de la familia de color que pide el hueco (el color de Uniqlo viene en inglés).
3. Temporada y materia: coherente con la temporada del hueco (lino de verano no sirve para "frio"; lana gruesa no sirve para "calor").
4. Formalidad: coherente con la del hueco (una sudadera no cubre un hueco formal).
5. Corte y detalles de la descripción visual: los detalles chicos se perdonan; el carácter de la pieza no.

El precio es dato de contexto, NO criterio. El nombre de la prenda puede venir en inglés, japonés o coreano.
Contesta en español, en el JSON pedido: es_la_pieza (true/false) y una línea de máximo 20 palabras con el motivo principal.`;

export const SCHEMA_JUEZ_VITRINA = {
  type: "object",
  properties: {
    es_la_pieza: { type: "boolean" },
    linea: { type: "string" },
  },
  required: ["es_la_pieza", "linea"],
  additionalProperties: false,
};

type HuecoParaJuez = Pick<HuecoMedicion, "nombre" | "segmento" | "colorFamilia" | "temporada" | "formalidad" | "visual" | "porque">;
type CandidatoParaJuez = Pick<CandidatoMedicion, "nombre" | "color" | "precioTexto" | "genero">;

/** El texto de la pregunta, puro para poder probarlo. */
export function textoJuezVitrina(hueco: HuecoParaJuez, c: CandidatoParaJuez): string {
  const linea = (k: string, v: string | null | undefined) => (v ? `${k}: ${v}` : null);
  return [
    "LA PIEZA QUE PIDE LA MALETA",
    `Nombre: ${hueco.nombre}`,
    `Para: ${hueco.segmento}`,
    `Familia de color: ${hueco.colorFamilia}`,
    linea("Temporada", hueco.temporada),
    linea("Formalidad", hueco.formalidad),
    linea("Descripción", hueco.visual),
    linea("Por qué la necesita", hueco.porque),
    "",
    "LA PRENDA DE UNIQLO",
    `Nombre: ${c.nombre}`,
    linea("Color", c.color),
    linea("Sección", c.genero),
    linea("Precio", c.precioTexto),
    "",
    "¿Esta prenda de Uniqlo es la pieza que pide la maleta?",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export type VeredictoJuez = { esLaPieza: boolean; linea: string; recibo: Recibo };

/**
 * Una pregunta al juez. `quien` es null desde el script (sin sesión: el
 * recibo se guarda en la fila del candidato, no en ai_calls — medir una
 * corrida de laboratorio como uso real ensuciaría los promedios del panel).
 */
export async function juzgarCandidato(
  quien: QuienMide | null,
  hueco: HuecoParaJuez,
  candidato: CandidatoParaJuez
): Promise<VeredictoJuez> {
  const recibo = await medir(quien && { ...quien, tarea: "juez-vitrina", version: JUEZ_VITRINA_VERSION }, {
    modelo: MODELO_JUEZ_VITRINA,
    system: SYSTEM_JUEZ_VITRINA,
    texto: textoJuezVitrina(hueco, candidato),
    schema: SCHEMA_JUEZ_VITRINA,
    maxTokens: 200,
  });
  if (recibo.truncada) throw new Error("JUEZ_VITRINA_TRUNCADO");
  const r = parsearJson<{ es_la_pieza: boolean; linea: string }>(recibo.texto);
  return { esLaPieza: Boolean(r.es_la_pieza), linea: String(r.linea ?? "").trim().slice(0, 300), recibo };
}
