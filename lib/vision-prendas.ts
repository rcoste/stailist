import { PATRONES } from "@/lib/prenda-atributos";
import { type Modelo, type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import type { PrendaAnalisis } from "@/lib/vision-prenda";

// Leer VARIAS prendas de UNA foto: el prompt, el schema y la llamada.
//
// POR QUÉ ESTE ES EL CASO QUE IMPORTA
// De las 953 prendas de la base, 303 entraron por este camino y sólo 5 por el
// de una prenda a la vez. Y de las 25 que resultaron estar mal y hubo que
// borrar, 16 salieron de aquí. El suéter esmeralda que Roberto no tenía y que
// aparecía en un tercio de sus looks vino de una foto múltiple leída de más.
//
// Lo que hace único a este caso: el modelo puede equivocarse de TRES formas
// distintas, y sólo una de ellas se parece a leer mal una prenda sola.
//   INVENTAR   una prenda que no está en la foto  ← la cara, la invisible
//   OMITIR     una prenda que sí está
//   LEER MAL   una que sí vio
// Un error de invención no se detecta nunca desde la app: la prenda queda
// guardada con su render limpio y se ve igual de real que las demás. Sólo
// aparece cuando sale en un outfit, y para entonces ya pasaron semanas.

export type PrendaDetectada = PrendaAnalisis & {
  confianza: "alta" | "media" | "baja";
  /** Descripción visual detallada para que el generador recree la prenda. */
  descripcion: string;
};

/** El prompt, palabra por palabra. Compartido con producción. */
export const SYSTEM_PRENDAS =
"Eres experta en moda. Miras UNA foto y listas CADA prenda visible, para un clóset digital. La foto puede ser de dos tipos: (a) una PERSONA VESTIDA — listas cada prenda que lleva puesta; o (b) PRENDAS SUELTAS sin persona — extendidas sobre una cama o el piso, colgadas en ganchos o apiladas — listas cada prenda distinguible. Detecta el tipo tú sola; no preguntes. Reglas: (1) una entrada por prenda real; no inventes prendas que no se ven. En fotos de prendas sueltas, ignora lo que NO es ropa (cobijas, sábanas, almohadas, muebles, ganchos vacíos, cajas). (2) Si una prenda está tapada, doblada de forma que oculte su corte, en perspectiva difícil, o el color es dudoso por la luz, márcala confianza 'baja' (NO la omitas, pero avisa). (3) El nombre es corto y natural en español ('Jeans rectos azules', 'Tenis blancos', 'Blusa blanca de seda', 'Falda midi plisada negra'). Identifica con cuidado el TIPO exacto, que es lo que más se confunde: un POLO (tejido de punto, cuello tejido con botonadura corta de 2-3 botones) NO es una camisa (tela plana, botonadura de arriba a abajo); una playera/camiseta tampoco es una camisa; una sudadera no es un suéter; unos chinos no son jeans. Ante la duda entre polo y camisa, fíjate si la botonadura llega hasta abajo (camisa) o solo al pecho (polo). En ropa de mujer distingue igual de fino: una BLUSA (tela fluida, con o sin botones) no es una camisa de vestir ni una playera; una falda (cualquier largo) va en 'bottom'; un vestido o un enterizo/jumpsuit van en 'vestido'; tacones, flats, sandalias y botas van en 'calzado'; una bolsa va en 'accesorio'. CATEGORÍA: 'saco' = saco/blazer/saco de traje/smoking (torso estructurado por FORMALIDAD, no por frío); 'abrigo' = solo capas por clima (abrigo/gabardina/parka/cárdigan/suéter grueso). Un traje = saco (categoría 'saco') + su pantalón (categoría 'bottom') por separado. FORMALIDAD — calibra con cuidado, es donde más te equivocas: 'formal' se reserva para sastrería y prendas de evento (saco de traje, camisa de vestir estructurada, vestido de coctel, tacón de vestir); una camisa o blusa del diario suele ser 'formal-casual' (versátil, juega para ambos lados) o 'casual' si es relajada. Ante la duda entre dos niveles, elige 'formal-casual'. (4) color_hex es el color dominante real de la prenda (el de la TELA, ignorando sombras y luz). Si es claramente bicolor o estampada con un segundo color protagonista, da color_secundario (nombre); si no, omítelo. Da el material aparente ('algodón', 'lana', 'mezclilla', 'lino', 'piel', 'punto', 'sintético'…); si no se distingue, omítelo en vez de adivinar. Da el patron: 'liso' o el que tenga (rayas/cuadros/floral/animal-print/grafico/estampado). (5) descripcion: una descripción VISUAL detallada en español, pensada para que un generador de imágenes recree la prenda fielmente — incluye tipo de prenda, corte/silueta, material/textura aparente, color exacto, y detalles distintivos (cuello, mangas, botones, estampado, cierre, suela, montura, etc.). Ej: 'chaqueta tipo bomber de nylon negro mate, cierre metálico frontal, puños y cintura elásticos acanalados, sin capucha'. Máximo 8 prendas; si hay más, prioriza las que se ven completas y con color claro. (6) subtipo: UNA a TRES palabras con el tipo fino de la prenda, SOLO cuando cambia qué tan formal es o con qué se combina. Es el dato que distingue prendas que se llaman igual y NO funcionan igual. Calzado: 'oxford', 'derby', 'monk', 'mocasín', 'chelsea', 'chukka', 'tenis de lona', 'tenis deportivo', 'sandalia', 'tacón de aguja', 'balerina'. Saco: 'cruzado', 'sencillo', 'smoking'. Pantalón: 'con pinzas', 'sin pinzas', 'cargo', 'chino', 'jean recto', 'wide leg'. Camisa: 'cuello button-down', 'cuello italiano', 'cuello mao'. Punto: 'cuello redondo', 'cuello V', 'cuello alto', 'cárdigan'. Falda: 'lápiz', 'plisada', 'línea A'. Abrigo: 'gabardina', 'parka', 'peacoat', 'puffer'. Un oxford negro pide traje y un derby café va con jeans, aunque los dos sean 'zapatos de vestir cafés': por eso importa. Si no lo distingues con seguridad, OMÍTELO — es peor un subtipo inventado que ninguno, porque el motor le hace caso.";

/** El schema de salida. Uno solo para los dos caminos. */
export const SCHEMA_PRENDAS = {
  type: "object",
  properties: {
    prendas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          categoria: {
            type: "string",
            enum: ["top", "saco", "bottom", "calzado", "abrigo", "vestido", "accesorio"],
          },
          color: { type: "string" },
          color_hex: { type: "string" },
          formalidad: {
            type: "string",
            enum: ["casual", "formal-casual", "formal"],
          },
          temporada: {
            type: "string",
            enum: ["calor", "templado", "frio", "todo-el-año"],
          },
          largo: { type: "string", enum: ["crop", "regular", "largo"] },
          corte: { type: "string", enum: ["entallado", "recto", "holgado"] },
          manga: { type: "string", enum: ["sin", "corta", "larga"] },
          material: { type: "string" },
          subtipo: { type: "string" },
          patron: { type: "string", enum: [...PATRONES] },
          color_secundario: { type: "string" },
          confianza: {
            type: "string",
            enum: ["alta", "media", "baja"],
          },
          descripcion: { type: "string" },
        },
        required: [
          "nombre",
          "categoria",
          "color",
          "color_hex",
          "formalidad",
          "temporada",
          "patron",
          "confianza",
          "descripcion",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["prendas"],
  additionalProperties: false,
} as Record<string, unknown>;

export type LecturaPrendas = { prendas: PrendaDetectada[]; recibo: Recibo };

/**
 * Lee todas las prendas de una foto con el modelo que se le diga.
 *
 * El tope de salida es alto a propósito: ocho prendas con descripción larga no
 * caben en poco, y un JSON truncado pierde la lectura entera — no una prenda,
 * TODAS.
 */
export async function leerPrendas(
  imagen: { mediaType: string; base64: string },
  modelo: Modelo,
  /** De quién es la foto. `null` = comparador o script. */
  quien: QuienMide | null = null
): Promise<LecturaPrendas> {
  const recibo = await medir(quien && { ...quien, tarea: "vision-prendas" }, {
    modelo,
    maxTokens: 2800,
    system: SYSTEM_PRENDAS,
    texto: "Lista cada prenda que lleva puesta esta persona.",
    imagen,
    schema: SCHEMA_PRENDAS,
  });
  const json = JSON.parse(recibo.texto) as { prendas?: PrendaDetectada[] };
  // Sin la llave `prendas` NO es "no vio nada": es que la respuesta no respetó
  // el formato. Devolver una lista vacía haría ver a un modelo roto como uno
  // que simplemente no encontró ropa — y en el comparador eso lo premiaría por
  // no inventar nada. Que truene, y que se registre como el fallo que es.
  if (!Array.isArray(json.prendas)) throw new Error("la respuesta no trae la lista de prendas");
  return { prendas: json.prendas, recibo };
}
