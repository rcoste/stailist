// Los estilos del swipe de gustos (26 mujer / 25 hombre — coquette es women-only;
// rebrand v3 Gen-Z 2026-06-27, ver docs/designs/estilos.md). Imágenes recasteadas
// a modelos europeo-latinos jóvenes, foto candid limpia. Los tags de los looks con
// ❤️ se convierten en el
// taste vector (profiles.taste_tags) que alimenta el motor — sin ML, puro conteo.
//
// Cada estilo tiene imagen propia para hombre y mujer (un avatar fijo vistiendo
// el outfit del estilo): /looks/<id>-<genero>.png. Por eso TODOS son segment
// "unisex": ambos los ven, looksForGender() resuelve la imagen de su género.
// `prendas` queda como fallback de swatches si faltara la imagen.

export type Look = {
  id: string;
  nombre: string;
  vibe: string; // una línea en voz amiga cool
  tags: string[];
  segment: "hombre" | "mujer" | "unisex";
  prendas: { nombre: string; swatch: string }[];
  image: string | null;
};

// [id, nombre, vibe, tags, segment?] — segment default "unisex". Coquette es
// "mujer" (no hay versión masculina que tenga sentido); su imagen vive en
// /looks/coquette.png (los unisex usan /looks/<id>-<genero>.png).
type EstiloRow = [string, string, string, string[], ("hombre" | "mujer" | "unisex")?];
const ESTILOS: EstiloRow[] = [
  ["minimalista", "Minimalista", "menos es más, todo encaja", ["minimalista", "sobrio", "pulido"]],
  ["casual-effortless", "Casual sin esfuerzo", "fresco y sin pensarlo", ["casual", "fresco", "versatil"]],
  ["clasico-elegante", "Clásico elegante", "elegancia que no grita", ["clasico", "elegante", "minimalista"]],
  ["preppy", "Preppy", "pulido con aire de campus", ["preppy", "clasico", "pulido"]],
  ["sastre", "Sastre", "el traje, con tu sello", ["estructurado", "elegante", "pulido"]],
  ["smart-casual", "Smart casual", "de la junta al after", ["pulido", "versatil", "moderno"]],
  ["streetwear", "Streetwear", "cómodo, con actitud", ["urbano", "atrevido", "deportivo"]],
  ["athleisure", "Athleisure", "deportivo bien hecho", ["deportivo", "casual", "fresco"]],
  ["edgy", "Edgy / rock", "cuero, negro y cero miedo", ["edgy", "atrevido", "urbano"]],
  ["grunge", "Grunge", "noventas, suelto y sin pose", ["grunge", "relajado", "vintage"]],
  ["hipster", "Hipster", "thrift con personalidad", ["hipster", "vintage", "creativo"]],
  ["utility", "Utility", "funcional, con carácter", ["utility", "urbano", "relajado"]],
  ["tonos-tierra", "Tonos tierra", "calidez que te enciende la cara", ["calido", "natural", "relajado"]],
  ["monocromatico", "Monocromático", "un solo tono, todo el impacto", ["minimalista", "sobrio", "moderno"]],
  ["color-protagonista", "Color protagonista", "que el color hable", ["colorido", "atrevido", "creativo"]],
  ["vintage", "Vintage / retro", "con historia, sin disfraz", ["vintage", "retro", "relajado"]],
  ["nautico", "Náutico", "rayas, azul y brisa", ["nautico", "clasico", "fresco"]],
  ["romantico", "Romántico", "delicado y ligero", ["romantico", "suave", "fresco"]],
  ["boho", "Boho", "suelto, con textura y alma", ["boho", "relajado", "romantico"]],
  ["glam-noche", "Glam de noche", "para cuando hay que brillar", ["glam", "elegante", "atrevido"]],
  // Canje 2026-07-22: academia + coastal reemplazan a finance-bro y startup
  // (dos cartas muy masculinas y redundantes con preppy/athleisure) por dos
  // ejes que faltaban — intelectual y resort/clean-girl —, con más balance
  // femenino/andrógino. Imágenes: hombre = Roberto, mujer = morena.
  ["academia", "Academia", "tweed, libros y aire intelectual", ["academia", "clasico", "vintage"]],
  ["coastal", "Coastal", "lino, blancos y brisa de mar", ["coastal", "natural", "fresco"]],
  // Nuevos (2026-06-27, rebrand v3 swipes Gen-Z):
  ["y2k", "Y2K", "los 2000 sin pena: baggy y con actitud", ["y2k", "atrevido", "retro"]],
  ["coquette", "Coquette", "moños, suave y muy femenino", ["coquette", "romantico", "suave"], "mujer"],
  ["gorpcore", "Gorpcore", "técnico de montaña, pero para la ciudad", ["gorpcore", "utility", "deportivo"]],
  // 2026-07-22: K-fashion / minimalismo coreano — el fit oversized drapeado de
  // los K-dramas está muy fuerte. Se diferencia de Monocromático por la
  // SILUETA (abrigo largo + wide-leg fluido, no el tono único ceñido).
  ["coreano", "Coreano", "holgado, fluido y monocromo — muy K-drama", ["fluido", "oversize", "sobrio"]],
  // 2026-07-31: el eje que FALTABA. Tatiana lo dijo revisando el deck — "están
  // muy señoriales, falta algo más sexy" — y al revisar las 26 tenía razón:
  // TODAS eran holgadas y cubiertas. A quien le gusta la ropa que marca la
  // silueta no le aparecía ninguna carta suya, así que el motor no se enteraba
  // nunca de ese gusto.
  //
  // Women-only como coquette: el equivalente masculino de este eje no es "lo
  // mismo pero de hombre", así que no se inventa. El tag `ceñido` es nuevo a
  // propósito — al ser raro pesa más en el vector de gustos (ver tasteTags,
  // que normaliza por frecuencia).
  ["de-salir", "De salir", "ceñido, corto y con actitud", ["ceñido", "atrevido", "glam"], "mujer"],
];

// Rompe-caché de las imágenes del deck.
//
// Las cartas se rehacen conservando el nombre de archivo (minimalista-hombre.png
// sigue siendo minimalista-hombre.png), así que para el navegador es la misma
// imagen de siempre y sirve la que ya tenía guardada — se rehízo el deck entero
// y en el teléfono seguían saliendo las cartas viejas. Subir este número cambia
// la URL sin renombrar 50 archivos ni tocar los scripts que los generan.
//
// SÚBELO cada vez que se regeneren las imágenes del deck.
//
// Se exporta porque next.config.ts TIENE que declarar exactamente esta query en
// images.localPatterns: el componente <Image> valida el `search` con igualdad
// exacta —`search: ""` significa "sin query", no "cualquier query"— y si no
// coincide LANZA en render y tumba la pantalla entera. Importarlo de aquí evita
// que los dos números se separen (ya pasó: subí el `?v=` sin la config buena y
// el deck reventó en producción).
export const LOOKS_V = "4";
const V = LOOKS_V;

export const LOOKS: Look[] = ESTILOS.map(([id, nombre, vibe, tags, segment = "unisex"]) => ({
  id,
  nombre,
  vibe,
  tags,
  segment,
  prendas: [],
  // Imagen por defecto: unisex usa el archivo de hombre; los específicos (p. ej.
  // coquette/mujer) usan /looks/<id>.png. looksForGender() resuelve por género.
  image:
    segment === "unisex" ? `/looks/${id}-hombre.png?v=${V}` : `/looks/${id}.png?v=${V}`,
}));

export const LOOK_IDS = new Set(LOOKS.map((l) => l.id));

/** Familias del mazo. El contraste que la gente percibe NO es por tag suelto
 *  ("versatil" vs "moderno" no le dice nada a nadie): es por familia — la calle
 *  contra lo pulido, lo suave contra lo que brilla. Se deriva de los tags que ya
 *  existen, en orden de prioridad, para no tener que tocar las 27 filas ni
 *  mantener dos listas que se desincronicen. */
const FAMILIA_POR_TAG: [string, string][] = [
  ["ceñido", "brillo"],
  ["glam", "brillo"],
  ["colorido", "brillo"],
  ["y2k", "calle"],
  ["gorpcore", "calle"],
  ["urbano", "calle"],
  ["deportivo", "calle"],
  ["grunge", "calle"],
  ["edgy", "calle"],
  ["utility", "calle"],
  ["romantico", "suave"],
  ["coquette", "suave"],
  ["boho", "suave"],
  ["coastal", "suave"],
  ["natural", "suave"],
  ["calido", "suave"],
  ["vintage", "retro"],
  ["retro", "retro"],
  ["hipster", "retro"],
  ["academia", "retro"],
  ["nautico", "retro"],
  ["oversize", "limpio"],
  ["fluido", "limpio"],
  ["minimalista", "limpio"],
  ["clasico", "limpio"],
  ["estructurado", "limpio"],
  ["preppy", "limpio"],
  ["pulido", "limpio"],
];
const ORDEN_FAMILIAS = ["limpio", "calle", "suave", "brillo", "retro"];

function familiaDe(l: Look): string {
  for (const [tag, fam] of FAMILIA_POR_TAG) if (l.tags.includes(tag)) return fam;
  return "limpio";
}

/** Reordena el mazo alternando familias, para que las primeras cartas
 *  contrasten de verdad.
 *
 *  EL PROBLEMA, medido el 2026-08-09 sobre el orden de este archivo: las seis
 *  primeras cartas —minimalista, casual sin esfuerzo, clásico elegante, preppy,
 *  sastre, smart casual— eran todas del mismo cluster pulido/clásico, y el mazo
 *  NO se baraja, así que ese arranque monótono era idéntico para todo el mundo.
 *  Las polarizantes vivían al fondo: y2k en la 23, gorpcore en la 24, coquette
 *  en la 24 y `de-salir` en la 27 de 27 — la última. Y esa carta existe
 *  justamente porque Tatiana señaló que faltaba el eje "marca la silueta": el
 *  parche al hueco estaba puesto donde menos se ve, y quien abandonaba a media
 *  tanda no lo veía nunca.
 *
 *  QUÉ HACE: round-robin entre familias. Primera de limpio, primera de calle,
 *  primera de suave, primera de brillo, primera de retro, segunda de limpio…
 *  Dentro de cada familia se respeta el orden del archivo (curado a mano), así
 *  que una carta nueva sólo se une a la rotación de la suya y no hay que
 *  reordenar nada.
 *
 *  ANTES DE ESTO probé un greedy de "la carta que menos tags comparta con lo ya
 *  visto". No sirvió —19 tags contra 18 en las diez primeras, y `de-salir`
 *  seguía en la 27— porque a media lista todo solapa con todo y el criterio se
 *  apaga. Queda escrito para que nadie lo reintente.
 *
 *  LO QUE NO HACE, a propósito: podar. Roberto propuso quitar del mazo los
 *  estilos que los primeros swipes descarten. Un mazo que se poda con su propia
 *  hipótesis deja de medir: las cartas que quedan sólo pueden confirmarla, y
 *  después no se puede distinguir "no le gusta" de "nunca le apareció". Es el
 *  mismo error que el comparador pareado existe para evitar.
 *
 *  DETERMINISTA: el mismo mazo para todo el mundo, así que los taste_tags
 *  siguen siendo comparables entre personas y a lo largo del tiempo. */
function porContraste(looks: Look[]): Look[] {
  const porFamilia = new Map<string, Look[]>();
  for (const l of looks) {
    const f = familiaDe(l);
    if (!porFamilia.has(f)) porFamilia.set(f, []);
    porFamilia.get(f)!.push(l);
  }
  const familias = [
    ...ORDEN_FAMILIAS.filter((f) => porFamilia.has(f)),
    ...[...porFamilia.keys()].filter((f) => !ORDEN_FAMILIAS.includes(f)),
  ];
  const orden: Look[] = [];
  for (let ronda = 0; orden.length < looks.length; ronda++) {
    for (const f of familias) {
      const c = porFamilia.get(f)![ronda];
      if (c) orden.push(c);
    }
    if (ronda > looks.length) break; // red de seguridad
  }
  return orden;
}

// Cada estilo tiene su imagen por género: /looks/<id>-<genero>.png.
export function looksForGender(gender: "hombre" | "mujer"): Look[] {
  return porContraste(
    LOOKS.filter((l) => l.segment === "unisex" || l.segment === gender)
  ).map((l) => ({
    ...l,
    image:
      l.segment === "unisex"
        ? `/looks/${l.id}-${gender}.png?v=${V}`
        : `/looks/${l.id}.png?v=${V}`,
  }));
}

// Cuántos de los estilos llevan cada tag. Tags raros (edgy, grunge, glam…)
// salen en 1; tags genéricos (pulido, atrevido, relajado…) en varios.
const TAG_DF: Map<string, number> = (() => {
  const df = new Map<string, number>();
  for (const l of LOOKS) for (const t of l.tags) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
})();

// Deriva los tags de gusto de los swipes. NO es conteo crudo: normaliza por
// frecuencia para que la preferencia distintiva no la entierren los tags
// genéricos — pero con amortiguación (√DF), no división plena. La división
// plena (n/DF) tenía un bug de calibración: un ÚNICO ❤️ al look "edgy" (DF=1,
// rate 1.0) le ganaba a "pulido" con +3 netos (3/5 = 0.6) — un like suelto
// pesaba más que una preferencia consistente.
//
// score(tag) = (likes − dislikes) / √(estilos que llevan ese tag)
//   → edgy con 1 ❤️ = 1.0; pulido con +3 = 3/√5 ≈ 1.34: la consistencia gana,
//   y el tag raro sigue rankeando arriba de señales débiles.
// Empate → desempata por evidencia cruda (likes netos).
// El array devuelto queda EN ORDEN DE FUERZA (los motores lo aprovechan).
export function computeTasteTags(
  results: { id: string; liked: boolean }[]
): string[] {
  const net = new Map<string, number>(); // likes − dislikes
  for (const r of results) {
    const look = LOOKS.find((l) => l.id === r.id);
    if (!look) continue;
    for (const tag of look.tags) {
      net.set(tag, (net.get(tag) ?? 0) + (r.liked ? 1 : -1));
    }
  }
  return [...net.entries()]
    .map(([tag, n]) => ({ tag, n, score: n / Math.sqrt(TAG_DF.get(tag) ?? 1) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.n - a.n)
    .slice(0, 8)
    .map((x) => x.tag);
}

// ── El apetito de acentos: cuánto volumen de color quiere la persona ────────
//
// LA DIMENSIÓN ES DE STYLIST, NO NUESTRA: en un intake profesional se pregunta
// "¿cuánta atención quieres que atraiga tu ropa?" — independiente de la
// colorimetría (qué colores le van) y del arquetipo (qué vibe es). Nació de
// Roberto viendo "Cobalto Bajo Cero" (2026-08-25): "abusas de los colores que
// son acentos… probablemente no me lo hubiera puesto; hubiera usado marino".
// El marco completo: docs/designs/acentos-y-colorimetria-por-zona.md.
//
// SE DERIVA DE LOS SWIPES QUE YA EXISTEN — por eso vive aquí, pegado al mazo:
// las cartas del deck ya varían en audacia de color, así que el apetito sale
// retroactivo para todos los usuarios sin añadir ni una pantalla al
// onboarding. Verificado sobre las 24 cuentas con swipes: 7 discretos, 2
// protagonistas, 15 medios — y el propio Roberto sale DISCRETO (2 audaces /
// 5 discretas), consistente con lo que dijo del cobalto semanas después.
//
// LAS LISTAS SON POR CARTA, no por tag, a propósito: los tags mezclan audacia
// de color con audacia de actitud ("atrevido" está en streetwear Y en y2k),
// y aquí el eje es COLOR. Si el mazo cambia, actualizar estas listas en el
// mismo commit (mismo contrato que TAG_DF con ESTILOS).
//
// EL MOTOR TODAVÍA NO LO CONSUME (2026-08-25): el loop está en pausa y
// activarlo cambia las generaciones — eso pide su vuelta medida. Hoy esto
// alimenta el campo del perfil y su UI, donde la persona lo puede corregir
// (el manual siempre gana, como en registro_por_plan).

export type ApetitoAcentos = "discreto" | "medio" | "protagonista";

/** Cartas donde el COLOR es protagonista o el look pide brillar. */
const CARTAS_AUDACES = new Set([
  "color-protagonista",
  "glam-noche",
  "y2k",
  "de-salir",
  "edgy",
  "streetwear",
]);

/** Cartas de paleta contenida: neutros, un tono, elegancia que no grita. */
const CARTAS_DISCRETAS = new Set([
  "minimalista",
  "monocromatico",
  "clasico-elegante",
  "coreano",
  "tonos-tierra",
]);

/**
 * Deriva el apetito de los swipes. Umbral de 2 a propósito: una sola carta de
 * diferencia es ruido de mazo (hay más cartas discretas que audaces); dos ya
 * es dirección. Con menos señal, "medio" — el default que no rompe nada.
 */
export function apetitoDeAcentos(
  results: { id: string; liked: boolean }[]
): ApetitoAcentos {
  const liked = results.filter((r) => r.liked).map((r) => r.id);
  const audaz = liked.filter((id) => CARTAS_AUDACES.has(id)).length;
  const discreto = liked.filter((id) => CARTAS_DISCRETAS.has(id)).length;
  if (audaz - discreto >= 2) return "protagonista";
  if (discreto - audaz >= 2) return "discreto";
  return "medio";
}

/**
 * La línea del apetito que viaja al motor y a los jueces.
 *
 * DICE QUÉ SÍ, NO SÓLO QUÉ NO — la lección de v56, que quitó los trajes de la
 * cita sin decir con qué sustituirlos y trajo mezclilla con blazer. Cada nivel
 * nombra dónde poner el color, no sólo cuánto.
 *
 * Y NO INVENTA PRENDAS: si el clóset no tiene la pieza chica de color que el
 * nivel discreto preferiría, la línea deja explícito que un look tonal es una
 * respuesta correcta — forzar el suéter de color porque no había bufanda es el
 * error que este dial existe para evitar
 * (docs/designs/acentos-y-colorimetria-por-zona.md §3).
 */
export function lineaApetitoAcentos(valor: ApetitoAcentos | null): string {
  if (valor === "discreto")
    return "CUÁNTO COLOR QUIERE (lo eligió viendo fotos, no lo declaró): DISCRETO — el color entra en piezas CHICAS y lejos de la cara: bufanda, calzado, cinturón, bolso, corbata. Las piezas grandes (suéter, camisa, saco, abrigo, pantalón) van en neutros o en tonos profundos y apagados. Si su clóset no tiene una pieza chica de color, un look TONAL es la respuesta correcta y la decisión visible del look pasa a ser la textura, el corte o la proporción — no le metas un suéter de color para compensar.";
  if (valor === "protagonista")
    return "CUÁNTO COLOR QUIERE (lo eligió viendo fotos, no lo declaró): PROTAGONISTA — el color puede mandar en una pieza GRANDE (suéter, abrigo, pantalón, vestido) y ése es el punto del look. Sigue siendo UNA pieza la que manda: dos piezas grandes saturadas compiten entre sí. El resto, neutros que la dejen brillar.";
  if (valor === "medio")
    return "CUÁNTO COLOR QUIERE (lo eligió viendo fotos, no lo declaró): MEDIO — una pieza de color de tamaño medio cerca de la cara (suéter, camisa, polo, top) con el resto en neutros, o un acento chico bien puesto. Ni look tonal ni bloque grande de color.";
  return "";
}

// ── ¿Su clóset da para el color que pidió? ──────────────────────────────────
//
// EL MISMO PRINCIPIO QUE `cobertura.ts` (el chequeo del pastel de manzana):
// decir la carencia en voz alta en vez de compensarla en silencio. Aquí el
// hueco no es de estilo sino de VEHÍCULO: alguien que pidió el color en dosis
// chicas necesita bufandas, calzado de color, cinturones o corbatas — y si no
// los tiene, el motor sólo puede darle color con un suéter entero, que es
// justo lo que pidió evitar.
//
// MEDIDO, no supuesto (2026-08-25): el clóset de referencia tiene 12 acentos
// en piezas grandes y 6 en chicas, y con el apetito "discreto" activo los
// looks tonales subieron 14 puntos — el motor obedeció y se quedó sin con qué.
// Ver docs/designs/acentos-y-colorimetria-por-zona.md §6.
//
// LO QUE ESTO NO HACE: sugerir la compra concreta. Eso es "compras sugeridas",
// que está fuera del MVP. Aquí sólo se nombra el hueco.

/** Colores que cuentan como ACENTO: vivos. Los neutros y los básicos de
 *  guardarropa (marino, beige, café, camel) son fondo, no acento. */
const COLOR_DE_ACENTO =
  /cobalto|azul rey|vino|burdeos|granate|esmeralda|verde bosque|verde botella|verde lima|rojo|rosa|lavanda|amarillo|mostaza|coral|olivo|oliva|turquesa|morado|lila|naranja/;

/** Las categorías donde un acento ocupa poca superficie — el 10% del 60-30-10. */
const CATEGORIAS_CHICAS = ["accesorio", "calzado"];

export type CoberturaAcentos = {
  /** Piezas chicas de color que sí tiene. */
  chicas: number;
  /** Piezas grandes de color. */
  grandes: number;
  /** Le falta con qué cumplir el apetito que pidió. */
  hueco: boolean;
};

/**
 * ¿Tiene con qué llevar el color donde dijo que lo quiere?
 *
 * Sólo aplica al apetito DISCRETO: es el único que depende de tener piezas
 * chicas. Quien pidió "protagonista" usa sus suéteres de color y no hay hueco
 * que avisar; sin apetito elegido, tampoco hay nada que prometer.
 *
 * El umbral es 2 y no 1 a propósito: con una sola pieza chica de color, el
 * motor la repetiría en todos los looks — que es la queja de rotación con otro
 * nombre.
 */
export function coberturaDeAcentos(
  prendas: { nombre?: string | null; color?: string | null; categoria?: string | null }[],
  apetito: ApetitoAcentos | null
): CoberturaAcentos {
  const esAcento = (p: (typeof prendas)[number]) =>
    COLOR_DE_ACENTO.test(`${p.color ?? ""} ${p.nombre ?? ""}`.toLowerCase());
  const acentos = prendas.filter(esAcento);
  const chicas = acentos.filter((p) =>
    CATEGORIAS_CHICAS.includes((p.categoria ?? "").toLowerCase())
  ).length;
  return {
    chicas,
    grandes: acentos.length - chicas,
    hueco: apetito === "discreto" && chicas < 2,
  };
}

/** El aviso para el motor. Vacío si no hay hueco — igual que bloqueCobertura. */
export function bloqueCoberturaAcentos(c: CoberturaAcentos): string {
  if (!c.hueco) return "";
  return `HONESTIDAD — PIDIÓ EL COLOR EN DOSIS CHICAS Y SU CLÓSET NO TIENE CON QUÉ: sólo ${c.chicas === 0 ? "no tiene ninguna" : "tiene una"} pieza chica de color (bufanda, calzado, cinturón, bolso o corbata) contra ${c.grandes} prendas grandes de color. NO compenses metiéndole un suéter o un abrigo de color: eso es exactamente lo que pidió evitar. Arma el look TONAL y que la decisión visible sea la textura, el corte o la proporción. Si viene al caso, dilo en la explicación en UNA frase y sin disculpas: que hoy su clóset da para lo sobrio, y que una bufanda o unos zapatos de color le abrirían el juego.`;
}
