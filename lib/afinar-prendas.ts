// QUÉ PRENDA VALE LA PENA PREGUNTAR — y, sobre todo, cuáles NO.
//
// La otra mitad de la certeza (migración 0124). Guardar que un dato es asumido
// hace al motor prudente; preguntarlo lo hace exacto. Pero preguntar TODO es
// exactamente la fricción que este producto existe para no tener: el checklist
// de básicos nació para que catalogar el clóset no tomara horas, y devolver 78
// preguntas lo desharía.
//
// LA REGLA: se pregunta donde el dato CAMBIA EL LOOK y donde la prenda SE USA.
// Medido en el clóset de Roberto: 78 prendas asumidas, 43 usadas en algún look,
// y 29 con un corte inventado que sí llegó a un outfit. Preguntar esas 29 de a
// poco es un producto; preguntar las 78 es un formulario.

/** Lo que hace falta para decidir si una prenda vale la pena preguntar. */
export type PrendaAfinable = {
  id: string;
  nombre: string;
  categoria: string | null;
  certeza: string | null;
  /** El valor que el catálogo le puso (y que nadie confirmó). */
  corte: string | null;
  /** Los atributos que la persona YA confirmó a mano. */
  confirmados?: string[];
  /** Cuántas veces ha aparecido en un look. */
  usos: number;
  /** La imagen con que se muestra en el clóset — para poder identificarla. */
  imagen?: string | null;
};

export type Pregunta = {
  id: string;
  nombre: string;
  /** Qué silueta dibujar. Un pantalón y una camisa no se ven igual de anchos. */
  familia: "bottom" | "top";
  /** Qué atributo se pregunta. Hoy solo el corte: es el que mueve el look. */
  atributo: "corte";
  /** La pregunta, en la voz del producto. */
  texto: string;
  opciones: { valor: string; label: string }[];
  /** Para ordenar y para explicar por qué se pregunta ésta. */
  usos: number;
  /**
   * La misma imagen con la que la prenda aparece en el clóset.
   *
   * NO ES UNA FOTO SUYA, y la card lo dice: por definición estas prendas
   * llegaron marcando el checklist, así que la imagen es la del catálogo. Sirve
   * para reconocer CUÁL de sus tres pantalones oscuros es "Jeans negros", que
   * es lo único que hace contestable la pregunta.
   */
  imagen: string | null;
};

/**
 * Dónde el corte CAMBIA el look, y dónde da igual.
 *
 * El corte de un pantalón decide la proporción entera; el de unos lentes o un
 * cinturón no significa nada. Preguntar por categorías donde el dato no se usa
 * sería gastar la paciencia de la persona en algo que el motor ignora.
 */
const EL_CORTE_IMPORTA = new Set(["bottom", "top", "saco", "vestido", "abrigo"]);

/** Las tres respuestas posibles, en palabras de persona y no de catálogo. */
const OPCIONES_CORTE = [
  { valor: "entallado", label: "ajustados al cuerpo" },
  { valor: "recto", label: "rectos" },
  { valor: "holgado", label: "holgados / anchos" },
];

/** La misma escala, en singular, para prendas de arriba. */
const OPCIONES_CORTE_TOP = [
  { valor: "entallado", label: "entallada" },
  { valor: "recto", label: "recta" },
  { valor: "holgado", label: "holgada / oversize" },
];

const esPlural = (nombre: string) =>
  /jeans|pantal[oó]n(es)?|chinos|shorts|leggings|joggers/i.test(nombre);

/**
 * Las preguntas que valen la pena, ya ordenadas por lo que más pesa.
 *
 * `tope` es bajo a propósito: la pantalla debe caber en un minuto. Se vuelve a
 * preguntar otro día, con las siguientes — es un goteo, no un formulario.
 */
export function preguntasPendientes(
  prendas: PrendaAfinable[],
  tope = 3
): Pregunta[] {
  return prendas
    .filter((p) => p.certeza === "asumida")
    // Sin categoría no se puede saber si el corte importa: no se pregunta.
    .filter((p) => !!p.categoria && EL_CORTE_IMPORTA.has(p.categoria.toLowerCase()))
    // El corte inventado tiene que EXISTIR: si el catálogo no le puso ninguno,
    // el motor no está afirmando nada falso y no hay nada que corregir.
    .filter((p) => !!p.corte)
    // Lo ya confirmado no se vuelve a preguntar: es el atributo, no la prenda,
    // lo que queda resuelto.
    .filter((p) => !(p.confirmados ?? []).includes("corte"))
    // Y la prenda tiene que USARSE. Una que nunca entró a un look puede estar
    // mal descrita sin consecuencia; preguntarla es cobrar sin dar.
    .filter((p) => p.usos > 0)
    .sort((a, b) => b.usos - a.usos)
    .slice(0, tope)
    .map((p) => {
      const plural = esPlural(p.nombre);
      const familia = (p.categoria ?? "").toLowerCase() === "bottom" ? "bottom" : "top";
      return {
        id: p.id,
        nombre: p.nombre,
        familia,
        atributo: "corte" as const,
        texto: plural ? "¿cómo te quedan?" : "¿cómo te queda?",
        opciones: plural ? OPCIONES_CORTE : OPCIONES_CORTE_TOP,
        usos: p.usos,
        imagen: p.imagen ?? null,
      };
    });
}

/**
 * Cuántas quedan por afinar en total — para poder decir "van 3 de 12" sin
 * prometer que se acaban hoy.
 */
export function cuantasFaltan(prendas: PrendaAfinable[]): number {
  return preguntasPendientes(prendas, Number.MAX_SAFE_INTEGER).length;
}
