import type { CapsuleItem } from "@/lib/capsule";

// EL JUEZ DE LA CÁPSULA.
//
// Roberto, 2026-09-09: "no se trata de parchear el traje, sino de la lógica
// general para evitar omitir cosas así".
//
// POR QUÉ EXISTE. El motor de outfits tiene tres capas de defensa —reglas de
// ejecución, juez y reparador— y la cápsula no tenía ninguna: un prompt y tres
// guardias en código, las tres nacidas de bugs que Roberto vio A OJO
// (empaquetados, el traje como una pieza, el traje sin lazo). Una lista de 35
// prendas generada por un modelo que "parte de cero" puede salir sin un camino
// completo a la formalidad que la persona declaró, y hoy nadie lo mira.
//
// QUÉ NO ES: no es un juez con IA. Son reglas de código sobre la lista, del
// mismo tipo que `revisarEjecucion` para los looks. Lo que aquí se afirma tiene
// que ser comprobable contra el dato, no una opinión de estilo.
//
// CÓMO SE ELIGIERON LAS REGLAS: corriendo cada candidata contra las 15 cápsulas
// reales de producción. Una regla que no caza nada no gana su sitio, y una que
// caza todo tampoco (no distingue). Las cinco que quedaron cazaron 2 huecos
// reales que nadie había visto: Tatiana con techo "formal" y CERO bottoms
// formales (su blazer no tiene con qué abajo), y mleomarti con sastrería
// completa y CERO calzado formal.
//
// EL EQUIVALENTE FEMENINO DEL TRAJE, y por qué NO se ata (análisis pedido por
// Roberto, 2026-09-09). En hombre el traje es UNA unidad: saco y pantalón
// salen del mismo rollo de tela y mezclarlos con otras piezas se nota. En mujer
// la sastrería se diseña para combinarse — el blazer negro va con jeans, el
// pantalón sastre va con blusa. Medido: de las 7 cápsulas de mujer, 5 ya traen
// blazer + pantalón sastre del MISMO color, y en sus clósets reales hay 14
// piezas de sastrería con CERO conjuntos marcados. Atarlas les quitaría justo
// la versatilidad que las hace útiles.
//
// Lo que sí cambia con el género es CUÁNTOS CAMINOS hacen falta. En hombre un
// traje cubre junta, boda y funeral. En mujer son dos huecos distintos que no
// se sustituyen: el de TRABAJO formal (blazer + bottom formal) y el de NOCHE
// (vestido formal). Por eso `sin-camino-formal` mira los dos por separado.

export type HallazgoCapsula = {
  regla: string;
  /** Qué falta, en una línea, con los nombres de las piezas involucradas. */
  detalle: string;
};

export type ContextoRevision = {
  gender: "hombre" | "mujer" | null;
  /** El techo de formalidad que la persona declaró (lifestyle.formalidad_techo). */
  techo?: string | null;
  /** Banda de clima de su ciudad, si se conoce. */
  clima?: string | null;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const txt = (it: CapsuleItem) => norm(`${it.nombre} ${it.tipo} ${it.hueco ?? ""}`);

/** Techos que exigen un camino formal completo. "smart" NO entra: es el registro
 *  de business casual, y pedirle traje a quien dijo smart es inventarle la vida. */
const TECHO_FORMAL = /formal|coctel|gala|etiqueta/;

export function revisarCapsula(
  items: CapsuleItem[],
  ctx: ContextoRevision
): HallazgoCapsula[] {
  const v: HallazgoCapsula[] = [];
  const de = (cat: string) => items.filter((i) => i.category === cat);
  const formales = (cat: string) => de(cat).filter((i) => i.formalidad === "formal");
  const pideFormal = TECHO_FORMAL.test(norm(ctx.techo ?? ""));

  // 1. UNA CATEGORÍA VACÍA no es una cápsula. Sin bottoms o sin calzado no hay
  //    un solo look completo, y el motor no puede inventar la pieza.
  for (const [cat, etiqueta] of [["bottom", "pantalones"], ["calzado", "calzado"]] as const) {
    // En mujer un vestido cubre el hueco de abajo: no es carencia.
    if (cat === "bottom" && ctx.gender === "mujer" && de("vestido").length > 0) continue;
    if (de(cat).length === 0) {
      v.push({ regla: "categoria-vacia", detalle: `La cápsula no tiene ni una pieza de ${etiqueta}: no alcanza para un solo look completo.` });
    }
  }

  // 2. EL TRAJE COMPLETO (hombre). `enlazarTrajes` ya lo garantiza al generar;
  //    esto es el candado, para las cápsulas viejas y por si esa función cambia.
  //
  //    EMPAREJA POR CLASE, no por "es un pantalón formal". El smoking va con SU
  //    pantalón (galón de satín), no con el de vestir — la misma distinción que
  //    el match aprendió en m7. Sin esto el juez daba una alarma FALSA sobre la
  //    cápsula de Roberto: decía que su "Smoking negro de solapa de satín" no
  //    tenía pantalón, cuando la lista trae "Pantalón de smoking negro" — el
  //    patrón viejo buscaba traje|vestir|sastre y ese nombre no dice ninguna.
  //    Lo cazó correr el juez contra las 15 cápsulas reales, no un test.
  const esEtiqueta = (t: string) => /smoking|esmoquin|tuxedo|frac|jaquet|chaque/.test(t);
  const sacosDeTraje = items.filter(
    (i) =>
      i.category === "saco" &&
      (/traje|sastre/.test(txt(i)) || esEtiqueta(txt(i))) &&
      !/blazer|desestructurad|sport/.test(txt(i))
  );
  for (const saco of sacosDeTraje) {
    const deEtiqueta = esEtiqueta(txt(saco));
    const suPantalon = items.find(
      (p) =>
        p.category === "bottom" &&
        /pantal[oó]n/i.test(p.nombre) &&
        // Etiqueta con etiqueta, calle con calle.
        (deEtiqueta ? esEtiqueta(txt(p)) : /traje|vestir|sastre/.test(txt(p)) && !esEtiqueta(txt(p))) &&
        norm(p.colorFamilia) === norm(saco.colorFamilia)
    );
    if (!suPantalon) {
      const que = deEtiqueta ? "de smoking" : `de traje ${saco.colorFamilia}`;
      v.push({ regla: "traje-sin-pantalon", detalle: `"${saco.nombre}" no tiene su pantalón ${que}: medio traje no viste una ocasión formal.` });
    }
  }

  // 3. EL CAMINO FORMAL, que en mujer son DOS y en hombre uno (ver la cabecera).
  if (pideFormal) {
    if (ctx.gender === "mujer") {
      // Trabajo formal: un saco formal necesita con qué abajo. El caso de
      // Tatiana — techo "formal", blazer estructurado gris perla, y su único
      // bottom era una falda formal-casual.
      const sacoFormal = formales("saco")[0];
      const bottomFormal = formales("bottom")[0];
      if (sacoFormal && !bottomFormal) {
        v.push({ regla: "sin-camino-formal", detalle: `"${sacoFormal.nombre}" no tiene un pantalón ni falda formal con qué armarse: el camino de trabajo formal queda a medias.` });
      }
      // Noche: el vestido formal NO lo sustituye un traje sastre, ni al revés.
      if (formales("vestido").length === 0 && !(sacoFormal && bottomFormal)) {
        v.push({ regla: "sin-camino-formal", detalle: `Dijo que llega a formal y no hay ni vestido formal ni sastrería formal completa: no tiene con qué vestir esa ocasión.` });
      }
    } else {
      // Hombre: el camino es la sastrería. Traje o, como mínimo, saco formal
      // con un pantalón de vestir.
      const hayTraje = sacosDeTraje.length > 0;
      const sacoFormal = formales("saco")[0];
      const bottomFormal = formales("bottom")[0];
      if (!hayTraje && !(sacoFormal && bottomFormal)) {
        v.push({ regla: "sin-camino-formal", detalle: `Dijo que llega a formal y la cápsula no trae traje ni saco con pantalón de vestir: no tiene con qué vestir esa ocasión.` });
      }
    }
  }

  // 4. CALZADO PARA LO QUE HAY ARRIBA. El caso de mleomarti: pantalón sastre y
  //    blazer formales, cero zapatos formales. Un traje con tenis no es el
  //    look que pidió.
  const hayFormalArriba = formales("saco").length + formales("vestido").length + formales("bottom").length > 0;
  if (hayFormalArriba && formales("calzado").length === 0) {
    v.push({ regla: "sin-calzado-formal", detalle: `Hay sastrería o vestido formal y ningún calzado formal: el look se cae en los zapatos.` });
  }

  // 5. ABRIGO EN CLIMA FRÍO. La capa exterior no se improvisa con lo que hay.
  if (/frio|frío/.test(norm(ctx.clima ?? "")) && de("abrigo").length === 0) {
    v.push({ regla: "sin-abrigo-en-frio", detalle: `Su clima es frío y la cápsula no trae una sola capa de abrigo.` });
  }

  return v;
}
