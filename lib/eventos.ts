import { lineaRegistro, registroDe, type RegistroPorPlan } from "@/lib/registro-plan";
import type { Formalidad } from "@/lib/formalidad";

// LOS TIPOS DE EVENTO: un solo lugar para qué eventos existen, qué formalidad
// implica cada uno y qué le dicen al motor.
//
// POR QUÉ EXISTE
// Hasta hoy "evento" preguntaba SOLO el nivel de formalidad (4 opciones) y
// dejaba el resto a un campo de texto libre. Roberto: "podríamos tener ya
// opciones: una comida, cena, cita, boda, cosas así — y sobre eso vamos
// afinando más". Tiene razón y el veredicto lo probó: "evento · noche
// templada" era incalificable porque una boda y una cena con amigos comparten
// la etiqueta y no comparten nada de lo que el motor tiene que acertar.
//
// SUSTITUYE A LA PREGUNTA DE FORMALIDAD, NO SE SUMA A ELLA. Cada tipo trae su
// formalidad por defecto —que es lo que la gente NO sabe traducir ("si lee
// formal, coctel, gala o etiqueta no sabe cuál es el dress code que implica")—
// y se puede corregir si el caso es raro. Si se sumara, "evento" pasaría de una
// pregunta a dos y la promesa de <2 minutos se erosiona un poco cada vez.
//
// EL DEFAULT NO ES UNA LEY. Roberto: "si es una comida familiar, pues quién
// sabe; por alguna razón rara requiero traje sin corbata, pero no debería". Por
// eso el ajuste existe y por eso está detrás de un "no es tan formal / es más
// formal" en vez de la lista cruda de cuatro niveles.

export type TipoEvento = {
  key: string;
  /** Cómo lo llama la persona. */
  label: string;
  /** El default: qué formalidad implica normalmente. */
  formalidad: Formalidad;
  /**
   * Qué es este evento, para el motor y para el juez. NO es la formalidad (esa
   * ya viaja aparte): es lo que el nivel de formalidad NO captura — dónde te
   * sientas, cuánto caminas, si hay foto, qué se ve mal ahí.
   */
  paraElMotor: string;
  /**
   * El copy del paso "detalle" del wizard, personalizado por plan (Roberto:
   * "se siente copy-paste... debería sentirse más personalizado por opción").
   * Es UI pura — NO viaja al motor (eso es paraElMotor).
   */
  preguntaDetalle: string;
  /**
   * Qué niveles de formalidad tienen sentido para ESTE plan — el wizard solo
   * ofrece estos. Nació de la misma queja: ofrecer esmoquin para una cena con
   * amigos es absurdo y delata la máquina. El default de `formalidad` (y su
   * subida de noche) SIEMPRE debe estar en esta lista.
   */
  formalidadesQueAplican: Formalidad[];
  /**
   * Si de noche sube un escalón de formalidad.
   *
   * SOLO la cena con amigos, y esa restricción salió de una corrida: la primera
   * versión también subía boda y fiesta, y el eval lo cazó de inmediato — la
   * boda de noche pasaba a "etiqueta rigurosa" y el juez exigía esmoquin con
   * moño y charol en los dos looks. En México eso es falso: una boda de noche
   * en salón es traje oscuro y corbata; el black tie se especifica en la
   * invitación y se elige a mano (para eso está el ajuste). Subirlo por default
   * habría hecho que el motor pidiera un esmoquin que casi nadie tiene.
   *
   * Lo de la cena sí se sostiene: la diferencia entre comer y cenar con los
   * mismos amigos en el mismo lugar es real y es de un escalón.
   */
  subeDeNoche?: boolean;
};

export const TIPOS_EVENTO: TipoEvento[] = [
  {
    key: "comida-familiar",
    label: "comida familiar",
    formalidad: "casual",
    preguntaDetalle:
      "con tu familia vas cómodo y presentable — así te veo; si esta vez es más elegante, súbele",
    formalidadesQueAplican: ["casual", "semiformal"],
    paraElMotor:
      "una comida en casa de familia: cómodo y presentable a la vez, se está sentado mucho rato y probablemente hay fotos. Nada de ropa de gimnasio ni de playa, pero tampoco traje",
  },
  {
    key: "cena-amigos",
    label: "cena con amigos",
    formalidad: "casual",
    preguntaDetalle:
      "la cena es donde más se nota si te arreglaste — un escalón arriba de lo diario, sin exagerar",
    formalidadesQueAplican: ["casual", "semiformal", "formal"],
    // v72 (2026-08-25): LA CARNITA INVESTIGADA (docs/registro-por-ocasion.md).
    // Sus palabras, casi literales: "nunca me he vestido de traje para ir a
    // una cena con amigos, a menos que sea una cena evento formal". Y la
    // práctica dice lo mismo: drinks/cena en restaurante casual = smart
    // casual, blazer opcional. Lección de v56 respetada: se dice qué SÍ.
    paraElMotor:
      "una cena con amigos en un restaurante: casual pero con intención — es la ocasión donde más se nota si te arreglaste. Un escalón arriba de lo diario, no un evento: camisa o punto bueno + pantalón con intención + calzado de piel; el blazer suma si el lugar lo pide, y el traje completo NO va — nadie se viste de traje para cenar con amigos, salvo que la cena SEA un evento con código formal explícito, y entonces el código manda. Si es de noche, los tonos profundos mandan: el beige, el caqui y los claros de día son de comida, no de cena",
    subeDeNoche: true,
  },
  {
    key: "cita",
    label: "una cita",
    formalidad: "semiformal",
    preguntaDetalle:
      "que se note el esfuerzo, no el intento — dime a dónde apunta la cita",
    formalidadesQueAplican: ["casual", "semiformal", "formal"],
    // LA LÍNEA DE CITA DE v56 SE RETIRÓ EN v57 (2026-08-19): decía "coctel
    // relajado, saco con pantalón de otro juego, no traje entero". Medida con
    // el voto de Roberto: los trajes desaparecieron, pero lo que los sustituyó
    // fue peor (mezclilla + blazer, lino esmeralda + blazer) y la aprobación de
    // la ronda cayó de 91% a 52%. Si vuelve, tiene que decir qué SÍ va con un
    // blazer, no sólo qué no — y salir medida contra la versión anterior.
    //
    // EL REGISTRO DE LA CITA, con la línea que Roberto dibujó calificando la
    // ronda 8f3647f3 (2026-08-19). El motor le entregó tres trajes completos
    // para "una cita en un restaurante" y su lectura fue la misma tres veces:
    // "para una cita no suele ser así: si acaso un blazer, pero no el traje
    // sin corbata — ese es el look más cóctel para un evento más formal". Y su
    // excepción, también textual: "depende de cómo se vista la persona… si en
    // el diario se viste de traje, pues está bien".
    //
    // VA AQUÍ Y NO EN UNA REGLA DE CÓDIGO a propósito: "traje en cita" no es
    // verificable como un choque de cueros — depende del estilo de la persona
    // y del plan. Este texto lo comparten el generador, las tres rúbricas y
    // producción (lineaTipoEvento), así que la misma vara guía al que arma y
    // al que califica.
    //
    // v72 (2026-08-25): LA LÍNEA VUELVE, esta vez como el comentario de arriba
    // exige — diciendo qué SÍ por tipo de cita, y medida contra v71
    // (docs/registro-por-ocasion.md). El punto dulce de todas las guías es
    // "casual elevado", y la única cita donde el traje entra natural es
    // drinks de noche, siempre sin corbata.
    paraElMotor:
      "una cita: se está cerca y de frente, así que lo que toca la cara y las texturas pesan más que de costumbre. Arreglado sin verse disfrazado — que se note el esfuerzo, no el intento. El punto dulce es casual elevado, y depende del plan: cena de mantel = blazer con pantalón de otro juego y cuello abierto, en tonos profundos (el pantalón beige o caqui es de cita de DÍA, no de cena); drinks de noche = ahí sí cabe el traje oscuro, SIN corbata; comida o plan de día = camisa o polo de calidad, sin saco. La corbata en una cita se lee como entrevista, no como esfuerzo — sólo si el plan nombra un código formal",
  },
  {
    key: "comida-trabajo",
    label: "comida de trabajo",
    formalidad: "semiformal",
    preguntaDetalle:
      "tu registro de trabajo subido un escalón — serio sin verse rígido; dime cuánto pesa la mesa",
    formalidadesQueAplican: ["casual", "semiformal", "formal"],
    // v72: aterrizado (el brief está a 44%, el segundo peor del corpus). El
    // centro del registro es el sastre PARTIDO, no el traje.
    paraElMotor:
      "una comida o cena con clientes o colegas: el registro es el de trabajo subido un escalón. Tiene que verse serio sin verse rígido, y aguantar que te vean sentado varias horas. El centro es saco o blazer con pantalón de otro juego + camisa; el traje completo sólo si la mesa o el cliente lo piden — de más se lee rígido, que es justo lo que este plan no quiere",
  },
  {
    key: "fiesta",
    label: "una fiesta",
    formalidad: "semiformal",
    preguntaDetalle:
      "es tu permiso para arriesgar — dime qué tipo de fiesta es y qué tanto le entramos",
    formalidadesQueAplican: ["casual", "semiformal", "formal", "gala"],
    // v72: EL LUGAR MANDA. Fiesta es el peor brief del corpus (43% en 14
    // looks) y sus tres comentarios piden lo mismo: para un cumpleaños en
    // casa el traje se lee como venir de otro evento. La regla #1 de todas
    // las guías: el error no es el nivel, es el contexto ("¿me mezclaría o
    // destacaría en ese lugar?").
    paraElMotor:
      "una fiesta: se está de pie y se baila, así que el calzado tiene que aguantar. Es la ocasión con más permiso para arriesgar en color y textura. OJO CON EL LUGAR: si es en una casa o un lugar casual, el registro real es mezclilla oscura o chino oscuro + camisa, polo o punto con carácter — el blazer es el techo y el traje completo se lee como venir de otro evento. Y OJO CON LA HORA: bajar el registro NO significa aclarar la ropa — de noche los claros de día (beige, caqui, crema) se apagan; casual de noche se construye con tonos profundos (negro, marino, carbón, mezclilla oscura). Sólo si el plan nombra un código explícito (coctel formal, etiqueta), el código manda y esto no aplica",
  },
  {
    key: "boda",
    label: "una boda",
    formalidad: "formal",
    preguntaDetalle:
      "aquí manda la invitación — si trae dress code, hazle caso; si no, esto es lo normal",
    // La única con "playa": es la boda de destino, que en México es frecuente y
    // que hasta hoy no tenía dónde caer (se pedía como "formal" y llegaba traje
    // oscuro con suela de cuero a la arena). Va al final de la lista porque no
    // es el escalón que sigue de "gala" — es otro eje, el del lugar.
    formalidadesQueAplican: ["casual", "semiformal", "formal", "gala", "playa"],
    paraElMotor:
      "una boda: hay fotos, hay ceremonia y se está de pie y sentado por turnos. NUNCA de blanco entero (es de quien se casa) y nada que compita con el protagonismo de los novios",
  },
  {
    key: "graduacion",
    label: "una graduación",
    formalidad: "formal",
    preguntaDetalle:
      "acto con público y fotos, formal pero de día — se respira más que en una boda",
    formalidadesQueAplican: ["semiformal", "formal"],
    paraElMotor:
      "una graduación: acto con público y fotos. Registro formal pero de día — se puede respirar más que en una boda de noche",
  },
  {
    key: "funeral",
    label: "un funeral",
    formalidad: "formal",
    preguntaDetalle:
      "sobrio y discreto — aquí no se destaca; solo dime el nivel",
    formalidadesQueAplican: ["semiformal", "formal"],
    paraElMotor:
      "un funeral o misa: sobrio y discreto. EL UNIFORME DEL LUTO, en este orden y sin creatividad: traje NEGRO, camisa BLANCA, corbata NEGRA, zapatos NEGROS. Si el clóset tiene esas cuatro piezas, ÉSE es el look — no busques una versión más interesante, aquí no existe. La camisa es BLANCA siempre: una camisa negra bajo traje oscuro se lee como fiesta, no como duelo, y es el error más grave que se puede cometer aquí. REPETIR NO ES DEFECTO EN ESTE PLAN: si tienes que dar varios outfits, el núcleo (traje negro, camisa blanca, corbata negra) se repite igual en todos y lo que varía es el calzado o un detalle; llevar el mismo look a dos funerales es lo normal y lo correcto, así que nunca cambies una pieza del uniforme sólo por dar variedad. Sólo si el clóset NO tiene el uniforme completo se buscan variantes, y en este orden: gris muy oscuro o carbón antes que cualquier otro color; piezas sueltas oscuras (pantalón negro, camisa blanca, saco gris oscuro) antes que un traje entero del color equivocado — el conjunto correcto en el color equivocado se nota más que el conjunto suelto en el color correcto. El AZUL MARINO NO sirve aquí aunque sea un traje impecable: en México el luto es negro y el marino se lee como oficina, no como duelo. Nada llamativo, nada que pida atención. Aquí la regla de no destacar MANDA sobre cualquier preferencia de estilo o de colorimetría. NUNCA esmoquin, smoking, chaqué ni nada de etiqueta: es ropa de CELEBRACIÓN y en un velorio se lee como una falta de respeto, por muy negro que sea — que sea la prenda más oscura del clóset no la vuelve la correcta. Y LA CORBATA VA NEGRA: si no hay negra, mejor ir sin corbata que con una de color",
  },
];

export function tipoEventoPorClave(k: string | null | undefined): TipoEvento | null {
  return TIPOS_EVENTO.find((t) => t.key === k) ?? null;
}

/**
 * ¿El plan escrito con sus palabras nombra uno de los DOS planes que perdieron
 * su chip? (graduación y funeral, 2026-08-11).
 *
 * POR QUÉ EXISTE Y POR QUÉ ES TAN ANGOSTO
 * Al quitarlos de la rejilla quedaron solo alcanzables por el campo libre, y el
 * campo libre manda `objective: "diario"`. O sea que escribir "un funeral"
 * llegaba al motor como un día normal: sin piso de formalidad y —lo caro— sin
 * la regla del catálogo que dice EL COLOR ES NEGRO, EL AZUL MARINO NO. Esa
 * regla se escribió porque el motor se equivocó justo ahí.
 *
 * NO es un parser de planes. Reconoce las palabras de esos dos casos y nada
 * más: el resto del texto libre sigue viajando tal cual, que es la promesa.
 * Tampoco añade un paso al wizard — solo deja que la formalidad por defecto del
 * catálogo y su línea al motor sigan aplicando, como cuando había chip.
 */
const PLANES_ESCRITOS: { key: string; re: RegExp }[] = [
  // "misa" a secas NO entra: también la hay de boda y de bautizo.
  { key: "funeral", re: /\b(funeral(es)?|velorio|sepelio|entierro|novenario)\b/ },
  { key: "graduacion", re: /\b(graduacion(es)?|titulacion)\b/ },
];

export function reconocerPlanEscrito(texto: string): string | null {
  const t = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return PLANES_ESCRITOS.find((p) => p.re.test(t))?.key ?? null;
}

/**
 * La formalidad que implica un tipo de evento, ya considerando el momento.
 * Solo sube un escalón, nunca dos: una cena con amigos no llega a formal por
 * ser de noche.
 */
export function formalidadDeEvento(
  k: string | null | undefined,
  momento: "dia" | "noche" | null
): Formalidad | null {
  const t = tipoEventoPorClave(k);
  if (!t) return null;
  if (momento !== "noche" || !t.subeDeNoche) return t.formalidad;
  // "playa" NO está aquí: no es un escalón, es el eje del lugar (ver
  // lib/formalidad.ts). Si un default no vive en la escalera se queda como
  // está — sin este guard, indexOf(-1) lo degradaba en silencio a "casual".
  const ESCALERA: Formalidad[] = ["casual", "semiformal", "formal", "gala"];
  const i = ESCALERA.indexOf(t.formalidad);
  if (i === -1) return t.formalidad;
  return ESCALERA[Math.min(i + 1, ESCALERA.length - 1)];
}

/** La línea que va al prompt y a la rúbrica. Vacía si no se eligió un tipo. */
export function lineaTipoEvento(
  k: string | null | undefined,
  /** El dial de la persona para este plan (lib/registro-plan.ts). Va DENTRO de esta
   *  línea a propósito: todo el que sabe qué evento es, sabe cómo va ella. */
  registro?: RegistroPorPlan | null
): string {
  const base = tipoEventoPorClave(k)?.paraElMotor ?? "";
  if (!base) return base;
  const dial = lineaRegistro(registroDe(registro, k));
  return dial ? `${base}. ${dial}` : base;
}
