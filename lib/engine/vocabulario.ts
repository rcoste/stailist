// El vocabulario de prendas: de un nombre en español a un TIPO canónico.
//
// PARA QUÉ
// Hay tres lugares que necesitan contestar "¿esta prenda y esta otra son la
// misma cosa?" sin preguntárselo a un modelo: la cobertura (¿el clóset da para
// esta receta?), las reglas de ejecución y el match de cápsula. Cada uno tenía su
// propio pedacito de léxico escrito a mano, con los mismos aciertos y los mismos
// huecos repetidos. Esto lo junta.
//
// POR QUÉ NO ES UN MODELO
// "¿Un mocasín es un zapato?" no es un juicio de gusto: es vocabulario. Pedírselo
// a un modelo cuesta una llamada, medio segundo y una respuesta distinta cada
// vez. En código cuesta un regex y se puede probar.
//
// DE DÓNDE SALEN LOS TÉRMINOS
// De los 156 nombres reales del catálogo de hombre y de las 10 cápsulas
// destiladas — no de mi idea de cómo se llama la ropa. Por eso están tanto
// "sudadera" como "crewneck", tanto "botines Chelsea" como "bota chelsea": el
// catálogo y las recetas los escriben distinto y ambos tienen que caer en el
// mismo tipo.
//
// LA REGLA DE ORO: ANTE LA DUDA, null
// Un tipo equivocado es peor que ninguno. Si el nombre no cae claramente en un
// tipo, esto devuelve null y quien llama trata la prenda como desconocida — que
// en cobertura significa "no cuenta como hueco" y en las reglas significa "no
// dispares". Un hueco falso ("no tienes con qué") es el error caro: le dice a la
// persona que no puede vestirse cuando sí puede.

/**
 * Zona del cuerpo. Dos prendas de zonas distintas jamás se sustituyen.
 *
 * "no-calle" no es una zona del cuerpo sino un contexto: traje de baño, pijama,
 * ropa interior y ropa de entrenar. Va aquí porque el error que evita es de
 * vocabulario — un "short de baño" caza el patrón de "short" y se cuenta como si
 * la persona tuviera con qué armar un look de verano. Ya le pasó a Roberto por
 * esta misma vía en el match de cápsula.
 */
export type Zona = "torso" | "capa" | "pierna" | "pie" | "accesorio" | "no-calle";

export type TipoPrenda = {
  /** El id canónico ("polo", "chino", "mocasin"). */
  tipo: string;
  zona: Zona;
};

// EL ORDEN IMPORTA: gana la primera que casa, así que va de lo específico a lo
// genérico. Dos trampas reales del español que este orden resuelve:
//
//   "Camisa oxford" vs "Oxford negro de charol" — la misma palabra es una camisa
//   y un zapato. La camisa se caza primero porque trae el sustantivo delante.
//
//   "Polo de punto" vs "Suéter de punto" — "punto" solo no distingue nada; el
//   polo se caza antes de que la regla del suéter pueda reclamarlo.
const REGLAS: [RegExp, string, Zona][] = [
  // --- Lo que NO es ropa de calle va PRIMERO: un "short de baño" caza el patrón
  // de "short" y contaría como si tuviera con qué armar un look de verano.
  [/traje de bano|banador|bikini|trikini|de bano|short(s)? de playa/, "bano", "no-calle"],
  [/pijama|piyama|camison|bata de bano|albornoz/, "dormir", "no-calle"],
  [/calzon|calzoncillo|boxer|brasier|sosten|tanga|bralette/, "interior", "no-calle"],
  [/\bgym\b|gimnasio|entrenamiento|running|para correr|de yoga|sports bra/, "gym", "no-calle"],

  // --- Torso, de lo más específico a lo más genérico
  [/\brugby\b/, "rugby", "torso"],
  [/\bhenley\b/, "henley", "torso"],
  [/\bpolo\b/, "polo", "torso"],
  [/cuello (alto|tortuga)|turtleneck/, "cuello-alto", "torso"],
  [/c[aá]rdigan|cardigan/, "cardigan", "torso"],
  [/(su[eé]ter|jersey)\b.*(ochos|cable|trenza)|(ochos|cable knit)/, "sueter-ochos", "torso"],
  [/su[eé]ter|jersey|knit\b|medio cierre|half-zip/, "sueter", "torso"],
  [/hoodie|con capucha|capucha/, "hoodie", "torso"],
  [/sudadera|crewneck|sweatshirt/, "sudadera", "torso"],
  // "camisa" NO se confunde con "camiseta": la cadena "camisa" no aparece en
  // "camiseta" (camis-e-ta), así que no hace falta un guard extra — pero la
  // camiseta va primero por si algún nombre trae las dos palabras.
  [/camiseta|playera|\btee\b|\bt-shirt/, "camiseta", "torso"],
  [/\btank\b|sin manga/, "tank", "torso"],
  [/camisa .*(oxford)|oxford.*camisa|camisa oxford/, "camisa-oxford", "torso"],
  [/camisa de (mezclilla|denim)/, "camisa-mezclilla", "torso"],
  [/camisa|\bshirt\b/, "camisa", "torso"],

  // --- Capa (lo que va encima). Zona propia: un abrigo no cubre un saco.
  [/overshirt|sobrecamisa|chore coat|chaqueta-camisa/, "overshirt", "capa"],
  [/blazer/, "blazer", "capa"],
  [/\bsaco\b|americana/, "saco", "capa"],
  [/chaleco/, "chaleco", "capa"],
  [/(chamarra|cazadora|chaqueta).*(piel|cuero|biker|racer)|biker|racer/, "chamarra-piel", "capa"],
  [/puffer|acolchad|plumas/, "puffer", "capa"],
  [/\bbomber\b/, "bomber", "capa"],
  [/(chamarra|chaqueta).*(mezclilla|denim)|chamarra denim/, "chamarra-mezclilla", "capa"],
  [/parka|softshell|impermeable|rompevientos|t[eé]cnic|de montaña/, "tecnica", "capa"],
  [/gabardina|trench/, "gabardina", "capa"],
  [/abrigo/, "abrigo", "capa"],
  [/chamarra|chaqueta|cazadora|varsity|de campo/, "chamarra", "capa"],

  // --- Pierna. El largo distingue prendas distintas, no matices: no vas a una
  // junta en bermudas. Lo corto se evalúa primero porque "pantalón corto" ES un
  // short y la regla del pantalón se lo llevaría.
  [/\bshort|bermuda|pantaloneta|pantal[oó]n(es)? corto/, "short", "pierna"],
  [/\bcargo\b/, "cargo", "pierna"],
  [/jogger|sweatpant|\bpants\b|pants deportivo/, "jogger", "pierna"],
  [/jeans|\bjean\b|mezclilla|denim|vaquero/, "jeans", "pierna"],
  [/\bchino/, "chino", "pierna"],
  [/pantal[oó]n de (vestir|traje|smoking|franela)|pantal[oó]n.*pinza|de pinza|franela|slack|trouser/, "pantalon-vestir", "pierna"],
  [/\bfalda\b|\bskirt\b/, "falda", "pierna"],
  [/pantal[oó]n|legging|palazzo/, "pantalon", "pierna"],

  // --- Pie
  [/mocas[ií]n|loafer|penny/, "mocasin", "pie"],
  [/n[aá]utico|boat shoe|topsider/, "nautico", "pie"],
  [/sandalia|hurache|huarache/, "sandalia", "pie"],
  [/bota|bot[ií]n|chelsea|chukka|desert/, "bota", "pie"],
  [/tenis|sneaker|zapatilla deportiva/, "tenis", "pie"],
  [/oxford|derby|brogue|zapato (formal|de vestir)|charol/, "zapato-formal", "pie"],
  [/zapato/, "zapato-formal", "pie"],

  // --- Accesorios
  [/cintur[oó]n/, "cinturon", "accesorio"],
  [/gorra|\bcap\b/, "gorra", "accesorio"],
  [/beanie|gorro/, "gorro", "accesorio"],
  [/bufanda|pashmina|mascada/, "bufanda", "accesorio"],
  [/lentes|gafas|anteojos/, "lentes", "accesorio"],
  [/reloj/, "reloj", "accesorio"],
  // OJO con la ñ: el normalizador la descompone y le quita la virgulilla, así
  // que aquí llegan "mono" y "rinonera". Un patrón con ñ literal no casa NUNCA —
  // es el mismo error que el acento, y en este archivo se cometió: "moño" y
  // "riñonera" no se reconocían hasta que se corrió contra el catálogo real.
  // ("mono" no colisiona con el mono/jumpsuit: no existe en el catálogo.)
  [/corbata|\bmono\b|pajarita/, "corbata", "accesorio"],
  [/bolsa|bolso|mochila|tote|rinonera|crossbody|bandolera|portafolio|maletin/, "bolsa", "accesorio"],
  [/calcet|medias/, "calcetin", "accesorio"],
  [/guante/, "guantes", "accesorio"],
  [/collar|arete|anillo|pulsera|cadena/, "joyeria", "accesorio"],
];

const normaliza = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * El tipo canónico de una prenda por su nombre. null = no se reconoce.
 *
 * Se normaliza sin acentos y las reglas se escriben con las dos formas donde el
 * catálogo y las recetas difieren ("suéter" / "sueter"): normalizar la entrada
 * sin normalizar el patrón es la forma clásica de que un regex con acento no
 * case nunca.
 */
export function tipoDePrenda(nombre: string): TipoPrenda | null {
  const n = normaliza(nombre);
  for (const [re, tipo, zona] of REGLAS) {
    if (re.test(n)) return { tipo, zona };
  }
  return null;
}

/**
 * Los tipos que menciona un texto libre — una fórmula de receta, por ejemplo.
 *
 * Distinto de tipoDePrenda: aquí el texto trae VARIAS prendas ("polo + short +
 * tenis") y hacen falta todas. Se parte por los separadores que usan las
 * fórmulas destiladas (" + " entre prendas, " sobre " entre capas) y cada trozo
 * se resuelve por su cuenta; los trozos que no se reconocen se ignoran.
 */
export function tiposEnTexto(texto: string): TipoPrenda[] {
  const trozos = texto.split(/\s\+\s|\ssobre\s|\scon\s|,/);
  const vistos = new Set<string>();
  const out: TipoPrenda[] = [];
  for (const t of trozos) {
    const tipo = tipoDePrenda(t);
    if (tipo && !vistos.has(tipo.tipo)) {
      vistos.add(tipo.tipo);
      out.push(tipo);
    }
  }
  return out;
}
