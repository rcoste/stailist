// ¿ESTA PRENDA YA ESTÁ EN EL CLÓSET?
//
// El hueco medido: de las 31 prendas repetidas que hay en la base, las 31
// entraron por foto. El flujo de biblioteca sí se protege (no reinserta un
// arquetipo que ya tienes); el de foto no tenía ninguna guarda, y el detector
// de duplicados que existe vive en /admin — o sea, limpieza después del
// desastre, no aviso antes.
//
// AVISA, NO BORRA — y ésta es la decisión que manda sobre el diseño. De los 25
// grupos con nombre repetido, 8 son prendas DISTINTAS de verdad: los tres
// "Pantalón negro" de Roberto son de sintético, lana y algodón. Él ya lo dijo
// cuando se construyó el detector: "puedo tener dos o tres grises que son
// diferentes". Apagar la prenda sola le borraría ropa real del clóset sin que
// se entere. Un aviso que se ignora cuesta una mirada; un borrado silencioso
// cuesta una prenda.
//
// LO QUE SEPARA ES EL MATERIAL, NO EL COLOR — y eso salió de medir, no de
// suponer (scripts/calibrar-ya-la-tienes.mjs, contra la base real):
//
//   categoría + nombre + color            caza 10/10 · 12 falsas alarmas
//   + material distinto descarta          caza 10/10 ·  2 falsas alarmas
//   + material y corte descartan          caza 10/10 ·  0 falsas alarmas
//   + corte SÓLO si es de fiar            caza 10/10 ·  2 falsas alarmas  ← ésta
//
// El umbral de color dio EXACTAMENTE lo mismo de 0.04 a 0.20, o sea que no
// estaba haciendo ningún trabajo: dos prendas con el mismo nombre tienen el
// mismo color, y lo que las distingue es de qué están hechas. La primera
// versión habría avisado mal más veces de las que acierta — y un aviso que
// falla más de lo que atina se aprende a ignorar en dos días.
//
// SE ELIGIÓ LA ÚLTIMA, con 2 falsas alarmas en vez de 0, y a propósito: la
// medición no puede ver los avisos que el corte inventado CALLA (el conjunto de
// referencia son duplicados que ya existen, no los que se habrían evitado), y
// ese caso se vio en vivo. Una falsa alarma cuesta una mirada; un aviso callado
// cuesta una prenda repetida.
//
// Y EL COLOR SÍ HACE FALTA, aunque la tabla de arriba diga que da igual: esa
// tabla sólo compara prendas con el MISMO nombre, que siempre tienen el mismo
// color. En cuanto los nombres se parecen sin ser iguales —"Pantalón chino azul
// marino" contra "Pantalón negro"— el color es lo único que las separa. Ver
// COLOR_CERCA.

import { distanciaPerceptual } from "@/lib/engine/color-perceptual";

/** Una prenda que ya está en el clóset, con lo justo para comparar. */
export type PrendaExistente = {
  id: string;
  nombre: string;
  categoria: string | null;
  colorHex: string | null;
  material?: string | null;
  corte?: string | null;
  /** La marca, si la tecleó. Ver por qué separa, abajo. */
  marca?: string | null;
  /**
   * ¿El corte de ESTA prenda es de fiar? Sólo lo es si salió de su foto o si
   * la persona lo confirmó a mano.
   *
   * Existe por un caso que se vio en vivo: subiendo una camisa blanca de vestir,
   * el aviso NO salió porque la "Camisa blanca" del clóset traía corte "recto"
   * copiado del arquetipo y la nueva se leyó "entallado". Un dato que nadie
   * confirmó —491 de 670 prendas asumidas lo traen— estaba callando un aviso
   * legítimo. Medido, gatearlo cuesta 2 falsas alarmas y las pago: una falsa
   * alarma es una mirada, un aviso callado es una prenda repetida.
   */
  corteDeFiar?: boolean;
  imagen: string | null;
};

/** Lo que la visión acaba de leer. */
export type PrendaNueva = {
  nombre: string;
  categoria: string | null;
  colorHex: string | null;
  material?: string | null;
  corte?: string | null;
  marca?: string | null;
};

/**
 * Palabras que no distinguen nada. Sin esta lista, "camisa DE vestir" y
 * "pantalón DE lino" comparten "de" y todo se parecería con todo.
 */
const VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "con", "sin", "para", "por", "un", "una", "y",
  "mi", "tu", "su", "muy", "más", "mas", "tipo", "estilo",
]);

/**
 * Los colores TAMPOCO cuentan como nombre — y esto lo cazó un test que escribí
 * mal a propósito de otra cosa.
 *
 * "Camisa negra" y "Camiseta negra" comparten la palabra "negra", son las dos
 * categoría `top` y las dos negras: sin esta lista, el aviso las daba por la
 * misma prenda. El color ya se compara aparte y con matemática de verdad —
 * dejar que además cuente como identidad es medirlo dos veces y encima mal.
 */
const COLORES = new Set([
  "negro","negra","blanco","blanca","gris","azul","marino","marina","beige","cafe",
  "verde","vino","rosa","rojo","roja","amarillo","amarilla","crema","camel","oliva",
  "marron","plateado","plateada","dorado","dorada","claro","clara","oscuro","oscura",
  "carbon","hueso","arena","celeste","turquesa","morado","morada","lila","coral",
  "mostaza","terracota","burdeos","borgona","nude","khaki","caqui","denim",
]);

const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Las palabras con contenido de un nombre: "Jeans azul oscuro" → jeans, azul, oscuro. */
export function palabras(nombre: string): Set<string> {
  return new Set(
    sinTildes(nombre)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p) && !COLORES.has(p))
  );
}

/**
 * Cuán cerca de color para sospechar. Medido, no puesto a ojo:
 *
 *   dos lecturas de la MISMA prenda   0.006 – 0.010
 *   ────────── hueco ──────────
 *   colores DISTINTOS                 0.054 – 0.208
 *     marino vs negro   0.071
 *     café vs vino      0.073
 *     blanco vs beige   0.095
 *
 * 0.03 cae en medio del hueco: el triple de la mayor distancia entre dos
 * lecturas de la misma prenda, y la mitad de la menor entre dos colores que
 * nadie confundiría.
 *
 * ESTABA EN 0.08 Y ERA DEMASIADO FLOJO. La calibración no podía verlo: su
 * conjunto de referencia son prendas con el MISMO nombre, y ésas tienen siempre
 * el mismo color, así que el umbral daba igual de 0.04 a 0.20. El fallo salió
 * probando en el navegador — unos "Pantalón chino azul marino" avisaban contra
 * un "Pantalón negro" del clóset. Una medición sin el caso que importa no dice
 * que el número esté bien: dice que no lo midió.
 */
const COLOR_CERCA = 0.03;

/**
 * ¿Un atributo las separa? Sólo cuenta si AMBAS lo declaran.
 *
 * Que falte no es "distinto": media base no tiene material leído, y tratar la
 * ausencia como diferencia apagaría el aviso justo en las prendas viejas, que
 * son las que más se repiten.
 */
const choca = (a?: string | null, b?: string | null) =>
  !!a?.trim() && !!b?.trim() && a.trim().toLowerCase() !== b.trim().toLowerCase();

/**
 * La prenda del clóset que probablemente sea ésta, o null.
 *
 * Devuelve UNA —la más parecida— y no una lista: el aviso vive junto a una
 * prenda en una pantalla de confirmación, y "puede que ya tengas 4 de éstas" no
 * ayuda a decidir nada.
 */
export function yaLaTienes(
  nueva: PrendaNueva,
  existentes: PrendaExistente[]
): PrendaExistente | null {
  const cat = (nueva.categoria ?? "").trim().toLowerCase();
  if (!cat || !nueva.colorHex) return null;
  const suyas = palabras(nueva.nombre);
  if (suyas.size === 0) return null;

  let mejor: { p: PrendaExistente; d: number } | null = null;
  for (const p of existentes) {
    if ((p.categoria ?? "").trim().toLowerCase() !== cat) continue;
    const comparte = [...palabras(p.nombre)].some((w) => suyas.has(w));
    if (!comparte) continue;
    // Lo que de verdad separa dos prendas que se llaman igual (medido: pasa de
    // 12 falsas alarmas a 0). Los tres "Pantalón negro" de Roberto son de
    // sintético, lana y algodón — tres pantalones distintos.
    if (choca(nueva.material, p.material)) continue;
    // LA MARCA SEPARA IGUAL QUE EL MATERIAL, y el caso lo puso Roberto: "tengo
    // dos playeras similares, pero una es de Express y otra es de Uniqlo".
    // Mismo nombre, mismo color, mismo material — y son dos prendas de verdad.
    // Sin esto el aviso le diría "creo que ya la tienes" y estaría equivocado,
    // que es la clase de error que enseña a ignorar el aviso.
    //
    // `choca` sólo descarta cuando las DOS tienen dato y difieren: casi ninguna
    // prenda trae marca (la visión la vio en 2 de 336), así que esto no cambia
    // nada salvo en el caso donde la persona se molestó en escribirla — o sea,
    // exactamente donde le importa distinguir.
    if (choca(nueva.marca, p.marca)) continue;
    // El corte de la nueva SIEMPRE es de fiar (sale de su propia foto); el de
    // la vieja, sólo si lo dice. Ver `corteDeFiar`.
    if (p.corteDeFiar && choca(nueva.corte, p.corte)) continue;
    const d = distanciaPerceptual(nueva.colorHex, p.colorHex);
    if (d === null || d > COLOR_CERCA) continue;
    if (!mejor || d < mejor.d) mejor = { p, d };
  }
  return mejor?.p ?? null;
}
