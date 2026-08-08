import { PATRONES, type Patron } from "@/lib/prenda-atributos";
import { llamar, type Modelo } from "@/lib/proveedores";
import type { Recibo } from "@/lib/proveedores";

// Leer UNA prenda de una foto: el prompt, el schema y la llamada, en un solo
// lugar.
//
// POR QUÉ SE SACÓ DE LA RUTA
// Vivía dentro de app/api/analizar-prenda/route.ts. Mientras fuera el único
// lugar que lo usaba, ahí estaba bien. Dejó de estarlo cuando hubo que
// comparar modelos: la única forma de que el comparador mida lo que de verdad
// corre en producción es que los dos llamen EXACTAMENTE el mismo prompt y el
// mismo schema.
//
// Esa es la lección cara de agosto. Los arneses de prueba de aquel día no
// llamaban al motor: lo IMITABAN. Uno barajaba el clóset una sola vez cuando
// producción lo baraja en cada llamada; otro consultaba la cuenta equivocada;
// otro pasaba el historial vacío. Los tres produjeron "hallazgos" que no eran
// del producto sino del arnés. Copiar un prompt para probarlo es exactamente
// la misma trampa, más difícil de ver.
//
// POR QUÉ ES LA PRIMERA COMPARACIÓN QUE VALE LA PENA
// Aquí está el gasto: en julio se leyeron 436 prendas contra ~34 generaciones
// de looks — la visión cuesta unas tres veces lo que el motor. Y a diferencia
// del motor, esta pregunta tiene respuesta correcta: la prenda existe y está
// en la foto. No necesita el voto de nadie, sólo contar aciertos.


// Campos que el modelo puede marcar como inseguros (los que el usuario puede
// corregir). Fuente única para el schema y la UI. Nombres = claves de PrendaAnalisis.
export const INSEGURO_CAMPOS = [
  "nombre",
  "categoria",
  "color",
  "formalidad",
  "temporada",
  "material",
  "patron",
] as const;
export type InseguroCampo = (typeof INSEGURO_CAMPOS)[number];

export type PrendaAnalisis = {
  nombre: string;
  categoria: "top" | "saco" | "bottom" | "calzado" | "abrigo" | "vestido" | "accesorio";
  color: string;
  color_hex: string;
  formalidad: "casual" | "formal-casual" | "formal";
  temporada: "calor" | "templado" | "frio" | "todo-el-año";
  // Atributos de styling (opcionales): habilitan tips de "cómo llevarlo"
  // (fajar/arremangar/proporción). El modelo los llena cuando aplican.
  largo?: "crop" | "regular" | "largo";
  corte?: "entallado" | "recto" | "holgado";
  manga?: "sin" | "corta" | "larga";
  // CONTEXTO de uso: solo cuando la prenda NO es de calle. Ausente = calle, que
  // es el caso normal. Lo usa el match para no dar por cubierta una prenda de
  // calle con un traje de baño (y viceversa). Se pide explícitamente en el
  // prompt que NO marque athleisure: leggings y sudaderas deportivas se llevan
  // en la calle todos los días.
  contexto?: "bano" | "dormir" | "interior" | "gym";
  // Atributos de combinación (opcionales): el motor los usa para juzgar mejor
  // (no lana en calor, no dos estampados que pelean, color real de bicolores).
  material?: string; // tela/material aparente: "algodón", "lana", "mezclilla", "piel"…
  // El tipo FINO, cuando cambia con qué se combina o qué tan formal es: "derby"
  // contra "oxford", "cruzado" contra "sencillo", "con pinzas". Nació de Roberto
  // calificando el comparador: "el correcto era Derby, pero sólo venía en el
  // nombre, no como categoría para yo decir si está bien o mal". Vivía dentro
  // del texto libre —nombre y descripcion— y por eso el motor NUNCA lo veía.
  subtipo?: string;
  patron?: Patron; // vocabulario compartido en lib/prenda-atributos
  color_secundario?: string; // segundo color visible si la prenda es claramente bicolor; ausente si no
  // Anti-alucinación ("prefer omission over invention"): en vez de adivinar con
  // falsa seguridad, el modelo declara su confianza y qué campos dudó. La UI
  // resalta esos campos para que el usuario confirme justo lo que importa.
  confianza?: "alta" | "media" | "baja";
  inseguro?: InseguroCampo[]; // campos de los que NO está seguro
  /**
   * ¿La foto tiene MÁS de una prenda de ropa?
   *
   * Este lector devuelve UNA prenda por diseño, y ante varias elige la
   * principal — o sea que las demás se pierden EN SILENCIO. Así nacieron los
   * "Traje marino de lana" que hay en la base: una foto del traje puesto
   * entrando por "una prenda", el saco leído como la prenda principal, el
   * pantalón desaparecido, y un nombre que dice "traje" para algo que es sólo
   * el saco.
   *
   * Con esta bandera el flujo puede ofrecer lo correcto: separarlas todas con
   * el lector de varias, que es el que sabe hacerlo.
   */
  varias?: boolean;
  /**
   * EL MODELO NO LO PRODUCE — por eso no está en SCHEMA_PRENDA. Lo pone la
   * persona al confirmar: es el lazo entre el saco y el pantalón de UN traje.
   *
   * Un traje se guarda como dos prendas (guardarlo como una hacía que el motor
   * armara looks sin pantalón), pero nada decía que esas dos van juntas, y la
   * regla `traje-desparejado` castiga exactamente ese par. Sin el lazo, subir un
   * traje de verdad creaba el par prohibido.
   *
   * NO SE DEDUCE SOLO a propósito: un blazer con un pantalón del mismo tono que
   * NO son traje es justo el error que la regla existe para cazar. Atarlos por
   * parecido apagaría la regla en el único caso donde sirve.
   */
  conjunto?: string;
};

/** El prompt, palabra por palabra. Lo comparte producción con el comparador. */
export const SYSTEM_PRENDA =
"Eres experta en moda. Miras la foto de UNA prenda y describes sus atributos para un clóset digital. El nombre es corto y natural en español ('Jeans rectos azules', 'Tenis blancos de piel', 'Blusa blanca de seda', 'Falda midi plisada negra'). Identifica con cuidado el TIPO exacto de prenda, que es lo que más se confunde: un POLO (tejido de punto, cuello tejido con botonadura corta de 2-3 botones, sin abertura completa) NO es una camisa (tela plana, botonadura de arriba a abajo); una playera/camiseta (sin botones ni cuello rígido) tampoco es una camisa; una sudadera no es un suéter; unos chinos no son jeans. Ante la duda entre polo y camisa, fíjate en si la botonadura llega hasta abajo (camisa) o solo al pecho (polo). En ropa de mujer distingue igual de fino: una BLUSA (tela fluida, con o sin botones) no es una camisa de vestir ni una playera; una falda (cualquier largo) va en 'bottom'; un vestido o un enterizo/jumpsuit van en 'vestido'; tacones, flats, sandalias y botas van en 'calzado'; una bolsa va en 'accesorio'. CATEGORÍA — distingue con cuidado: 'saco' = saco, blazer, saco de traje o smoking (prenda estructurada de torso que se usa por FORMALIDAD, no por frío); 'abrigo' = SOLO capas por clima (abrigo, gabardina, parka, cárdigan, suéter grueso de capa). Un traje se registra como dos prendas: el saco (categoría 'saco') y su pantalón (categoría 'bottom'), por separado. FORMALIDAD — calibra con cuidado, es donde más te equivocas: 'formal' se reserva para sastrería y prendas de evento (saco de traje, camisa de vestir estructurada, vestido de coctel, tacón de vestir). Una camisa o una blusa del diario NO es automáticamente 'formal': la mayoría vive en 'formal-casual' (la prenda versátil que juega para ambos lados) o en 'casual' si es relajada (denim, lino arrugado, estampado playero, tirantes). Ante la duda entre dos niveles, elige 'formal-casual'. El color_hex es el color dominante real de la prenda (el de la TELA, ignorando sombras y luz de la foto). Si la prenda es claramente bicolor o estampada con un segundo color protagonista (rayas azul/blanco, colorblock), da también color_secundario (nombre del segundo color); si es de un solo color, omítelo. Da el material aparente de la tela ('algodón', 'lana', 'mezclilla', 'lino', 'piel', 'ante', 'punto', 'sintético', 'seda'…) — importa para clima y combinación; si no se distingue, omítelo en vez de adivinar. Da el patron: 'liso' si no tiene estampado, o el que tenga (rayas/cuadros/floral/animal-print/grafico/estampado). Si hay varias prendas o ninguna clara, elige la prenda principal Y marca 'varias' en true — es importante: quien mira esta foto sólo va a guardar la prenda que tú elijas, y las demás se perderían sin que se entere. 'varias' es true en cuanto haya DOS O MÁS prendas de ropa distintas (un traje puesto son dos: saco y pantalón; una persona vestida son varias), y false si la foto es de una sola prenda, aunque salga sobre una percha, doblada o puesta sin que se vea nada más. Cuando apliquen a la prenda, agrega también largo (crop/regular/largo), corte (entallado/recto/holgado) y manga (sin/corta/larga) — sirven para sugerir cómo llevarla. IMPORTANTE — prefiere marcar inseguridad antes que inventar: si la foto no te deja distinguir bien un atributo (el tipo exacto, el material, la formalidad, el color real bajo la luz), da tu mejor estimación PERO agrégalo a 'inseguro' con el nombre del campo (nombre/categoria/color/formalidad/temporada/material/patron). Es mejor una duda honesta que un dato inventado con falsa seguridad — el usuario la confirma en un tap. 'confianza' resume qué tan clara está la foto: 'alta' si todo se ve nítido, 'media' si algo cuesta, 'baja' si la foto es ambigua (mala luz, prenda arrugada, varias prendas). Si estás seguro de todo, deja 'inseguro' vacío y 'confianza' en 'alta'. (6) subtipo: UNA a TRES palabras con el tipo fino de la prenda, SOLO cuando cambia qué tan formal es o con qué se combina. Es el dato que distingue prendas que se llaman igual y NO funcionan igual. Calzado: 'oxford', 'derby', 'monk', 'mocasín', 'chelsea', 'chukka', 'tenis de lona', 'tenis deportivo', 'sandalia', 'tacón de aguja', 'balerina'. Saco: 'cruzado', 'sencillo', 'smoking'. Pantalón: 'con pinzas', 'sin pinzas', 'cargo', 'chino', 'jean recto', 'wide leg'. Camisa: 'cuello button-down', 'cuello italiano', 'cuello mao'. Punto: 'cuello redondo', 'cuello V', 'cuello alto', 'cárdigan'. Falda: 'lápiz', 'plisada', 'línea A'. Abrigo: 'gabardina', 'parka', 'peacoat', 'puffer'. Un oxford negro pide traje y un derby café va con jeans, aunque los dos sean 'zapatos de vestir cafés': por eso importa. Si no lo distingues con seguridad, OMÍTELO — es peor un subtipo inventado que ninguno, porque el motor le hace caso.";

/** El schema de salida. Mismo comentario: uno solo, para los dos. */
export const SCHEMA_PRENDA = {
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
    contexto: {
      type: "string",
      enum: ["bano", "dormir", "interior", "gym"],
      description:
        "SOLO si la prenda no es ropa de calle: traje de baño/bikini ('bano'), pijama ('dormir'), ropa interior ('interior'), o ropa técnica de entrenar ('gym'). Omítelo para todo lo demás. NO marques 'gym' athleisure que se usa en la calle (leggings, joggers, sudaderas, tenis): eso es ropa de calle.",
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
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    varias: {
      type: "boolean",
      description:
        "true si en la foto hay DOS O MÁS prendas de ropa distintas (un traje puesto, una persona vestida). false si es una sola prenda.",
    },
    inseguro: {
      type: "array",
      items: { type: "string", enum: [...INSEGURO_CAMPOS] },
    },
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
  ],
  additionalProperties: false,
} as Record<string, unknown>;

export type LecturaPrenda = { analisis: PrendaAnalisis; recibo: Recibo };

/**
 * Lee una prenda de una foto con el modelo que se le diga.
 *
 * Producción le pasa el de lib/models.ts y el comparador el que esté probando:
 * ésa es toda la diferencia entre los dos caminos, y por eso lo que se mida
 * aquí vale para lo que corre allá.
 */
export async function leerPrenda(
  imagen: { mediaType: string; base64: string },
  modelo: Modelo
): Promise<LecturaPrenda> {
  const recibo = await llamar({
    modelo,
    maxTokens: 500,
    system: SYSTEM_PRENDA,
    texto: "Describe esta prenda para mi clóset.",
    imagen,
    schema: SCHEMA_PRENDA,
  });
  return { analisis: JSON.parse(recibo.texto) as PrendaAnalisis, recibo };
}
