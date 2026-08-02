// Cómo se lleva de verdad cada estilo — destilado de fotos reales de calle.
//
// EL PROBLEMA QUE RESUELVE
// Hasta v24 el motor recibía los gustos de la clienta como palabras sueltas:
//   "Tags de gusto (en orden de fuerza): pulido, clasico, elegante."
// …y nada más. En 432 líneas de prompt había UNA que hablaba de estilos, y era
// genérica ("si es minimalista, evita mezclar demasiados elementos"). O sea: el
// modelo improvisaba qué significa cada palabra.
//
// Se veía igual que el bug que mató al primer deck de swipes: describir un
// estilo con adjetivos ("utility = funcional, con carácter") produce outfits
// aguados, porque los adjetivos se pueden cumplir sin que el look funcione. Lo
// que hace que un outfit se lea bien son cosas concretas y chiquitas —el nudo
// de la camisa, el peso del zapato, cuántos colores hay— que ningún adjetivo
// obliga.
//
// DE DÓNDE SALE
// De fotos de calle cosechadas de Pinterest, filtradas por visión (se fue el
// 48%: portadas de blog, collages, anuncios) y CURADAS a mano en /admin/destilador.
// Lo que se anota es lo que SE REPITE, no lo que le gusta a quien destila: si 14
// de 20 fotos traen pantalón claro de pinzas, ese patrón es del estilo.
//
// La curaduría pasó por dos vueltas, y la segunda importa. En la primera se
// preguntaba "¿sirve?" con un solo botón, y eso mezcla dos juicios distintos:
// si la foto ES del estilo (taxonomía) y si se ve bien (ojo). Medido contra un
// juez que solo sabe taxonomía, el acuerdo en smart-casual fue de 35%: 17 de 26
// fotos rechazadas SÍ eran del estilo, y quedaron 3 aprobadas de 26. La segunda
// vuelta las separó y smart-casual subió a 12. Sin ese paso, esto describiría el
// guardarropa de una persona en vez del estilo.
//
// Base actual: clásico elegante 35 fotos · minimalista 28 · smart casual 12.
// Smart-casual sigue siendo el más flojo — los patrones de abajo son los que se
// repiten aun así, pero con 12 fotos la cola de variantes no está cubierta.
//
// CÓMO SE USA
// recetasParaTags() elige las recetas de los estilos que empatan con los gustos
// de la clienta y el prompt las inyecta. NO son reglas duras: el motor sigue
// mandando sobre clima, colorimetría y lo que hay en el clóset. Son la
// diferencia entre "combina prendas válidas" y "combina prendas como lo haría
// alguien que sabe del estilo".

export type Receta = {
  /** Coincide con el id del look en lib/looks.ts */
  id: string;
  nombre: string;
  /** Los tags que disparan esta receta (los mismos de LOOKS) */
  tags: string[];
  /** La regla de proporción — lo primero que se rompe si se ignora */
  silueta: string;
  /** Combinaciones concretas a nivel prenda, no vibras */
  formulas: string[];
  /** Los detalles chiquitos que separan "bien puesto" de "aguado" */
  detalles: string[];
  /** Lo que mata el estilo aunque las prendas sean correctas */
  evitar: string[];
  /** Las prendas que más fórmulas generan (alimenta cápsula y viaje) */
  capsula: string[];
};

export const RECETAS_HOMBRE: Receta[] = [
  {
    id: "smart-casual",
    nombre: "Smart casual",
    tags: ["pulido", "versatil", "moderno"],
    silueta:
      "Tres piezas, y el pantalón AMPLIO —de tela, con caída, nunca entallado—. Encima casi siempre hay una tercera pieza (camisa abierta, overshirt, suéter, saco o abrigo); sin ella queda ropa, no outfit.",
    formulas: [
      "camisa abierta + playera blanca lisa + jeans claros rectos + tenis blanco de piel",
      "camisa gris abierta + playera blanca + pantalón negro amplio + tenis crema",
      "suéter negro fino + pantalón negro + cinturón + zapato negro (monocromo de arriba abajo)",
      "playera lisa oversize + pantalón de pinzas amplio + mocasín café",
      "suéter azul marino + camisa con el cuello asomando + chino crema + mocasín",
      "camisa de lino azul claro abierta + pantalón gris topo amplio + cinturón + mocasín café",
      "abrigo largo negro + playera y pantalón del mismo tono + tenis blanco",
      "saco azul marino + playera blanca + pantalón crema + cinturón + zapato oscuro",
      "overshirt azul marino + playera blanca + chino crema",
    ],
    detalles: [
      "La camisa va ABIERTA sobre una playera lisa, no abotonada sola: es lo que la baja de formal a smart casual.",
      "La camisa abierta NUNCA del mismo tono que el pantalón: se lee como conjunto y no como outfit. Es la misma trampa del \"traje desparejado\" —saco y pantalón del mismo color sin ser un traje real—, con otra prenda.",
      "El pantalón amplio es la mitad del estilo. Con pantalón entallado el mismo outfit se ve de oficina.",
      "El monocromo oscuro (todo negro, todo gris) es una variante completa del estilo, no una salida perezosa.",
      "Mangas dobladas a media antebrazo cuando la camisa va sola.",
      "Cinturón visible cuando el pantalón es de pinzas; a juego con el zapato.",
      "El pantalón cae al tobillo o con un quiebre mínimo — nunca amontonado sobre el zapato.",
    ],
    evitar: [
      "Traje completo de dos piezas: eso ya es sastre, no smart casual.",
      "Tenis deportivos técnicos, de correr o con logo grande.",
      "Jeans rotos, deslavados o con parches.",
      "Dos estampados en el mismo look.",
      "Camisa fajada con la playera asomando por debajo.",
    ],
    capsula: [
      "camisa de tela clara (crema o azul claro)",
      "overshirt azul marino",
      "playera blanca lisa de buen cuello",
      "playera negra lisa",
      "suéter fino de cuello redondo azul marino",
      "suéter negro fino",
      "pantalón de pinzas amplio gris",
      "pantalón de tela negro",
      "chino crema",
      "jeans claro de corte recto",
      "tenis blanco de piel",
      "mocasín café",
    ],
  },
  {
    id: "clasico-elegante",
    nombre: "Clásico elegante",
    tags: ["clasico", "elegante", "minimalista"],
    silueta:
      "Pantalón claro de pinzas, cintura alta y pierna recta y amplia; arriba algo más oscuro y de corte limpio. El pantalón claro es el ancla del estilo — es lo primero que se ve y lo que lo distingue.",
    formulas: [
      "camisa azul claro con cuello abierto + pantalón de pinzas crema + mocasín café",
      "camisa azul marino + pantalón crema + cinturón café + mocasín café",
      "polo tejido (camel, negro o marino) + pantalón crema de pinzas + mocasín",
      "saco azul marino + camisa blanca + pantalón crema + mocasín café",
      "suéter fino crema + pantalón azul marino de pinzas + mocasín",
      "camisa de lino café + pantalón crema + tenis blanco de piel",
      "playera lisa oscura + pantalón camel de pinzas + cinturón de piel",
      "camisa de lino crema + pantalón crema (total claro, un solo tono de arriba abajo)",
      "polo blanco + suéter atado al hombro + pantalón crema",
      "chamarra de gamuza café + cuello alto negro + pantalón oscuro",
    ],
    detalles: [
      "El pantalón claro de pinzas, talle alto y pierna amplia, es LA firma: aparece en dos de cada tres looks.",
      "Cuello abierto uno o dos botones, sin corbata. Abotonado hasta arriba sin corbata se ve incómodo.",
      "La textura hace el trabajo que en otros estilos hace el estampado: lino, punto, franela, gamuza.",
      "El mocasín café es el zapato firma; el tenis blanco de piel es la única alternativa que no rompe.",
      "El oscuro de arriba casi siempre es azul marino o café, no negro.",
      "Reloj y cinturón de piel, nada más. Cero logos a la vista.",
      "Dos colores en total: uno claro abajo, uno medio u oscuro arriba. El total claro también vale.",
    ],
    evitar: [
      "Pantalón slim o entallado: mata la caída y con ella el estilo.",
      "Negro de pies a cabeza — pertenece a otro registro.",
      "Estampados llamativos, logos, hardware brillante.",
      "Tenis deportivos de cualquier tipo.",
      "Mezclilla oscura rígida con camisa formal.",
    ],
    capsula: [
      "pantalón de pinzas crema",
      "pantalón camel",
      "pantalón azul marino",
      "camisa blanca",
      "camisa azul claro",
      "camisa de lino crema",
      "polo tejido camel",
      "polo tejido negro",
      "suéter fino crema",
      "saco azul marino",
      "mocasín café",
      "cinturón café",
    ],
  },
  {
    id: "minimalista",
    nombre: "Minimalista",
    tags: ["minimalista", "sobrio", "pulido"],
    silueta:
      "Silueta relajada, nunca ajustada: hombro que cae, pierna amplia y recta, largo al tobillo. Se ve limpio por la proporción, no por ir entallado.",
    formulas: [
      // Esta fórmula decía "pantalón de tela crema" y contradecía el detalle de
      // que la pieza de encima nunca va del mismo tono que el pantalón. El
      // generador obedeció la fórmula —es lo concreto— y salió el conjunto
      // crema-sobre-crema. Las fórmulas mandan sobre los detalles: una fórmula
      // que viola una regla la deja muerta.
      "camisa de lino crema abierta + playera blanca + pantalón taupe amplio + tenis blanco",
      "playera blanca oversize + pantalón de tela crema amplio + tenis blanco liso",
      "suéter gris de punto + chino beige + tenis blanco",
      "playera café + pantalón crema + tenis blanco",
      "camisa de lino crema abierta + playera blanca + pantalón negro amplio",
      "camisa de lino clara + pantalón verde olivo amplio + tenis blanco",
      // "cardigan beige + pantalón crema" violaba la regla del tono igual que la
      // fórmula 1. Gris contra crema sí contrasta.
      "cardigan gris + playera blanca + pantalón crema",
      "suéter negro + pantalón crema de tela",
      "chamarra ligera taupe + playera blanca + pantalón crema",
    ],
    detalles: [
      "DOS colores en todo el look. Es la regla más fuerte del estilo y la que lo separa de los demás.",
      // Redactado como CONDICIONAL a propósito. Antes decía "la camisa de lino
      // abierta es la tercera pieza más repetida", que es cierto como estadística
      // pero se lee como orden: el generador le metía camisa a fórmulas que no la
      // pedían, y de paso rompía la regla del tono. Un dato de frecuencia tiene
      // que decir CUÁNDO aplica, o se vuelve un imperativo.
      "CUANDO el look lleve una tercera pieza, la más típica es la camisa de lino abierta sobre playera lisa, más que el suéter. Si la fórmula no pide tercera pieza, no se agrega ninguna.",
      "El contraste es de claridad, no de color: crema con café, blanco con negro, gris con gris. Dos tonos vecinos (café sobre crema) se leen apagados, no minimalistas.",
      "El pantalón tiene PESO y cae limpio desde la cadera, con el dobladillo justo al tobillo. Amontonado sobre el zapato o arrugado en la rodilla se ve como pijama, y ahí se cae el estilo entero.",
      "La pieza abierta de encima NUNCA va del mismo tono que el pantalón: camisa crema sobre pantalón crema se lee como conjunto de dormir, no como outfit. En las referencias la camisa clara va con pantalón taupe, olivo o negro.",
      "El verde olivo es el único color que entra sin romper la regla; funciona como si fuera un neutro.",
      "La textura evita que se vea plano: punto grueso, lino, sarga. Sin textura, dos colores se ven pobres.",
      "Tenis blanco liso, sin detalles ni suela gruesa.",
      "Nada de hardware: sin cierres a la vista, sin herrajes, sin cadenas.",
    ],
    evitar: [
      "Un tercer color. Dos y se acabó.",
      "Camisa o cardigan del mismo tono que el pantalón — se lee como conjunto, no como look armado.",
      "Estampados de cualquier tipo, incluidos los pequeños.",
      "Logos visibles, aunque sean chicos.",
      "Prendas entalladas — el minimalismo aquí es de silueta amplia, no de corte ceñido.",
      "Saco estructurado y mocasín: eso lo empuja a clásico elegante, que es otro estilo.",
    ],
    capsula: [
      "camisa de lino crema",
      "playera blanca oversize",
      "playera negra lisa",
      "playera taupe o café",
      "suéter de punto crema",
      "suéter negro",
      "cardigan gris",
      "pantalón de tela crema amplio",
      "chino beige",
      "pantalón verde olivo amplio",
      "pantalón negro amplio",
      "tenis blanco liso",
    ],
  },
];

/**
 * Las recetas que aplican a unos gustos dados, de la más fuerte a la más débil.
 *
 * `tasteTags` viene EN ORDEN DE FUERZA de computeTasteTags, así que un tag en
 * primera posición pesa más que uno en la sexta. Pero ordenar solo por la mejor
 * posición no basta: los estilos COMPARTEN tags —"minimalista" lo llevan tanto
 * el look minimalista como el clásico elegante— y entonces varias recetas
 * empatan en la posición 0 y el desempate acaba siendo el orden del array, que
 * es arbitrario. Con eso, quien pone "minimalista" de primer gusto podía
 * llevarse la receta de clásico elegante.
 *
 * score = Σ 1/(posición+1) sobre los tags que empatan. Premia las dos cosas que
 * importan: qué tan arriba está el tag Y cuántos tags de la receta aparecen.
 *
 * El tope existe porque inyectar cinco recetas es lo mismo que no inyectar
 * ninguna: el modelo acaba con una sopa de reglas que se contradicen (el
 * minimalista veta el mocasín que el clásico exige) y vuelve a improvisar.
 */
export function recetasParaTags(
  tasteTags: string[],
  genero: "hombre" | "mujer",
  tope = 2
): Receta[] {
  if (genero !== "hombre") return []; // mujer: pendiente de destilar
  const posicion = new Map(tasteTags.map((t, i) => [t, i]));
  return RECETAS_HOMBRE.map((receta) => ({
    receta,
    score: receta.tags.reduce((suma, t) => {
      const p = posicion.get(t);
      return p === undefined ? suma : suma + 1 / (p + 1);
    }, 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, tope)
    .map((x) => x.receta);
}

/** Formatea las recetas para el prompt. Vacío si no aplica ninguna. */
export function recetasParaPrompt(recetas: Receta[]): string {
  if (recetas.length === 0) return "";
  const bloques = recetas.map((r) =>
    [
      `### ${r.nombre}`,
      `Silueta: ${r.silueta}`,
      `Fórmulas que funcionan:`,
      ...r.formulas.map((f) => `  - ${f}`),
      `Detalles que lo hacen:`,
      ...r.detalles.map((d) => `  - ${d}`),
      `Lo que lo arruina:`,
      ...r.evitar.map((e) => `  - ${e}`),
    ].join("\n")
  );
  return [
    "Cómo se lleva su estilo (destilado de fotos reales de calle):",
    ...bloques,
    "Usa esto para ELEGIR entre combinaciones válidas y para armar la silueta. No inventes prendas que no estén en su clóset para cumplirlo.",
  ].join("\n\n");
}
