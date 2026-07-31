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
// De leer ~60 fotos de calle por estilo, cosechadas de Pinterest, y anotar lo
// que se REPITE. No es el gusto de quien escribe esto: si 40 de 50 fotos traen
// calzado limpio sin logo, ese patrón es del estilo, no mío. El volumen es
// justo la defensa contra el criterio de quien destila.
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
      "Tres capas, no dos: una pieza abierta encima (camisa, overshirt, chamarra o suéter) sobre una base lisa, y pantalón de tela. La tercera pieza ES el estilo — sin ella queda ropa, no outfit.",
    formulas: [
      "camisa de tela abierta + playera blanca lisa + chino crema + tenis blanco de piel",
      "overshirt azul marino + playera blanca + chino camel + mocasín café",
      "suéter fino de cuello redondo + camisa con cuello asomando + pantalón de tela gris + mocasín",
      "camisa oscura arremangada + pantalón negro de pinzas + tenis blanco limpio",
      "chamarra de mezclilla oscura + sudadera lisa crema + chino camel + tenis",
      "playera lisa + chino verde olivo + cinturón café + tenis blanco",
      "abrigo largo negro + playera y pantalón del mismo tono + tenis blanco",
    ],
    detalles: [
      "La camisa va ABIERTA sobre una playera lisa, no abotonada sola: es lo que la baja de formal a smart casual.",
      "Mangas dobladas a media antebrazo cuando la camisa va sola.",
      "El pantalón cae al tobillo o con un quiebre mínimo — nunca amontonado sobre el zapato.",
      "Cinturón del mismo tono que el zapato en los looks con pantalón de vestir.",
      "Máximo dos colores más un neutro. Si hay un color fuerte, todo lo demás se apaga.",
    ],
    evitar: [
      "Traje completo de dos piezas: eso ya es sastre, no smart casual.",
      "Tenis deportivos técnicos, de correr o con logo grande.",
      "Jeans rotos, deslavados o con parches.",
      "Dos estampados en el mismo look.",
      "Camisa fajada con la playera asomando por debajo.",
    ],
    capsula: [
      "overshirt azul marino",
      "camisa de tela crema",
      "playera blanca lisa de buen cuello",
      "playera negra lisa",
      "suéter fino de cuello redondo",
      "chino crema",
      "chino camel",
      "pantalón de tela negro o gris",
      "jeans claro de corte recto",
      "tenis blanco de piel",
      "mocasín café",
      "cinturón café",
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
      "polo tejido camel + pantalón crema de pinzas + mocasín",
      "saco azul marino + camisa blanca + pantalón crema + mocasín café",
      "suéter fino crema + pantalón azul marino de pinzas + mocasín",
      "camisa de lino café + pantalón crema + tenis blanco de piel",
      "polo negro + pantalón camel de cintura alta + cinturón negro",
      "saco color crema + camisa blanca + pantalón azul marino",
    ],
    detalles: [
      "Cuello abierto uno o dos botones, sin corbata. Abotonado hasta arriba sin corbata se ve incómodo.",
      "La textura hace el trabajo que en otros estilos hace el estampado: lino, punto, franela, gamuza.",
      "Cintura alta con el pantalón de pinzas — se ve la línea del cinturón, no la esconde la camisa.",
      "El mocasín café es el zapato firma; el tenis blanco de piel es la única alternativa que no rompe.",
      "Reloj y cinturón de piel, nada más. Cero logos a la vista.",
      "Dos colores en total: uno claro abajo, uno medio u oscuro arriba.",
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
      "camisa azul marino",
      "polo tejido camel",
      "suéter fino crema",
      "saco azul marino",
      "mocasín café",
      "tenis blanco de piel",
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
      "playera blanca oversize + pantalón de tela crema amplio + tenis blanco liso",
      "suéter gris de punto + chino beige + tenis blanco",
      "playera café + pantalón crema + tenis blanco",
      "camisa de lino crema abierta + playera blanca + pantalón negro amplio",
      "overshirt verde olivo + playera blanca + pantalón crema",
      "cardigan beige + playera blanca + pantalón crema",
      "suéter negro + pantalón crema de tela",
      "playera taupe oversize + pantalón café",
    ],
    detalles: [
      "DOS colores en todo el look. Es la regla más fuerte del estilo y la que lo separa de los demás.",
      "El contraste es de claridad, no de color: crema con café, blanco con negro, gris con gris.",
      "La textura evita que se vea plano: punto grueso, lino, sarga. Sin textura, dos colores se ven pobres.",
      "Tenis blanco liso, sin detalles ni suela gruesa.",
      "Nada de hardware: sin cierres a la vista, sin herrajes, sin cadenas.",
      "Un solo accesorio como mucho, y discreto — reloj delgado.",
    ],
    evitar: [
      "Un tercer color. Dos y se acabó.",
      "Estampados de cualquier tipo, incluidos los pequeños.",
      "Logos visibles, aunque sean chicos.",
      "Prendas entalladas — el minimalismo aquí es de silueta amplia, no de corte ceñido.",
      "Saco estructurado y mocasín: eso lo empuja a clásico elegante, que es otro estilo.",
    ],
    capsula: [
      "playera blanca oversize",
      "playera negra lisa",
      "playera taupe o café",
      "suéter de punto crema",
      "suéter negro",
      "overshirt crema",
      "camisa de lino crema",
      "cardigan gris",
      "pantalón de tela crema amplio",
      "chino beige",
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
