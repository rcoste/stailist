import type { EngineItem } from "./prompt";
import { revisarEjecucion, type ContextoReglas, type Violacion } from "./reglas-ejecucion";
import { categoriaDeItem } from "@/lib/item-image";

// REPARACIÓN EN CÓDIGO: arreglar lo que se puede arreglar sin preguntarle a nadie.
//
// LA IDEA ES DE ROBERTO, y su analogía la explica mejor que cualquier comentario:
// "muchas de las cosas que fallaban era nada más 'ay, te faltó esto'. Es como
// decir 'te faltó ponerte calzones' — no es que tengas que cambiarte toda la
// ropa porque no traes calzones."
//
// El segundo intento del juez hacía exactamente eso: le devolvía el look
// completo al mismo prompt, con libertad total sobre las cinco prendas, para
// arreglar que faltara una camiseta. Podía volver con otro look entero —
// perdiendo lo que ya estaba bien y cobrando una llamada por ello.
//
// AQUÍ EL ARREGLO ES QUIRÚRGICO: se toca UNA prenda, la que causa la violación,
// y se comprueba que el resultado no traiga violaciones nuevas. Lo que no se
// pueda arreglar así se le sigue pasando al juez — hay fallos que sí piden
// criterio (un traje desparejado no se resuelve eligiendo "otro pantalón
// cualquiera", hay que ver cuál).
//
// EL ORDEN IMPORTA: primero el código, después el juez. Así el juez recibe menos
// que arreglar, y en los casos que el código resuelve del todo no hay segunda
// llamada — ni latencia ni costo.

/** Qué se hizo, para poder medirlo (y para que el flywheel lo registre). */
export type Reparacion = {
  regla: string;
  /** "anadida" = se sumó una prenda; "sustituida" = se cambió una por otra. */
  como: "anadida" | "sustituida";
  /** Nombre de la prenda que entró. */
  entro: string;
  /** Nombre de la que salió (solo en sustitución). */
  salio?: string;
};

const nombre = (i: EngineItem) => i.attrs.nombre ?? i.attrs.tipo ?? i.id;
const cat = (i: EngineItem) => (categoriaDeItem(i as never) ?? "").toLowerCase();
const texto = (i: EngineItem) =>
  `${i.attrs.nombre ?? ""} ${i.attrs.tipo ?? ""}`.toLowerCase();

/**
 * Prendas NEUTRAS para rellenar, ordenadas por lo invisible que son.
 *
 * Cuando hay que AÑADIR una base, la elección correcta es la que menos cambia
 * el look: una camiseta blanca o negra lisa. Meter una camisa de color a un
 * look ya armado sería reparar una regla rompiendo el criterio de otra — y eso
 * es exactamente lo que esta pieza existe para no hacer.
 */
function puntuarBase(i: EngineItem): number {
  const t = texto(i);
  let p = 0;
  if (/camiseta|playera|t-?shirt/.test(t)) p += 3; // la base por defecto
  if (/camisa/.test(t)) p += 2;
  if (/polo/.test(t)) p += 1;
  const c = (i.attrs.color ?? "").toLowerCase();
  if (/blanc|negr|gris|crudo|hueso/.test(c + " " + t)) p += 2; // neutra
  if (/manga larga/.test(t)) p += 1; // menos probable que asome mal
  return p;
}

/**
 * Intenta arreglar en código lo que se pueda. Devuelve el look nuevo y lo que
 * hizo; si no pudo tocar nada, devuelve el mismo look y una lista vacía.
 *
 * NUNCA empeora: cada arreglo se comprueba contra las reglas antes de
 * aceptarse, y si introduce una violación que no existía se descarta.
 */
export function repararEnCodigo(
  itemIds: string[],
  closet: EngineItem[],
  ctx: ContextoReglas
): { itemIds: string[]; hechas: Reparacion[] } {
  const porId = new Map(closet.map((i) => [i.id, i]));
  const enLook = () => itemIds.map((id) => porId.get(id)).filter((x): x is EngineItem => !!x);

  const violacionesDe = (ids: string[]) =>
    revisarEjecucion(
      ids.map((id) => porId.get(id)).filter((x): x is EngineItem => !!x),
      ctx
    );

  const hechas: Reparacion[] = [];
  let ids = [...itemIds];

  // Se itera porque arreglar una puede destapar otra; con tope, para que dos
  // reglas que se contradigan no dejen esto girando.
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const v = violacionesDe(ids);
    if (v.length === 0) break;

    const antes = v.length;
    const intento = intentarUna(v, ids, closet, porId, enLook);
    if (!intento) break; // ninguna de las que quedan se arregla en código

    // LA GUARDA: el arreglo solo vale si de verdad deja menos roto. Sin esto,
    // "reparar" podría añadir una prenda que dispara otra regla y quedarnos
    // peor que al principio, sin que nadie lo note.
    if (violacionesDe(intento.ids).length >= antes) break;

    ids = intento.ids;
    hechas.push(intento.hecha);
  }

  return { itemIds: ids, hechas };
}

/** El primer arreglo posible de la lista. null si ninguna es reparable así. */
function intentarUna(
  violaciones: Violacion[],
  ids: string[],
  closet: EngineItem[],
  porId: Map<string, EngineItem>,
  enLook: () => EngineItem[]
): { ids: string[]; hecha: Reparacion } | null {
  const puestas = new Set(ids);
  const disponibles = closet.filter((i) => !puestas.has(i.id));

  for (const v of violaciones) {
    // ── AÑADIR: la clase de "te faltó ponerte X". Es la reparación más segura
    //    que existe, porque no quita nada de lo que ya estaba bien.
    if (v.regla === "sueter-sin-base") {
      const base = disponibles
        .filter((i) => cat(i) === "top")
        .filter((i) => /camiseta|playera|camisa|polo|t-?shirt/.test(texto(i)))
        .sort((a, b) => puntuarBase(b) - puntuarBase(a))[0];
      if (base) {
        return {
          ids: [base.id, ...ids],
          hecha: { regla: v.regla, como: "anadida", entro: nombre(base) },
        };
      }
    }

    if (v.regla === "frio-sin-abrigo") {
      const abrigo = disponibles.filter((i) => cat(i) === "abrigo")[0];
      if (abrigo) {
        return {
          ids: [...ids, abrigo.id],
          hecha: { regla: v.regla, como: "anadida", entro: nombre(abrigo) },
        };
      }
    }

    // Llueve y no hay capa que repela: es el mismo "te faltó ponerte X" que el
    // frío, con otra condición. Se busca una capa exterior que aguante agua —
    // si el clóset no la tiene, no es fallo reparable sino carencia, y la regla
    // ya se calla sola en ese caso.
    if (v.regla === "lluvia-sin-impermeable") {
      const capa = disponibles
        .filter((i) => cat(i) === "abrigo")
        .filter((i) => /impermeable|lluvia|chubasquero|gabardina|sint[eé]tico|nylon|shell/.test(
          `${texto(i)} ${i.attrs.material ?? ""}`.toLowerCase()
        ))[0];
      if (capa) {
        return {
          ids: [...ids, capa.id],
          hecha: { regla: v.regla, como: "anadida", entro: nombre(capa) },
        };
      }
    }

    // ── SUSTITUIR EL CALZADO: mismo rol, otra pieza. Mecánico porque el
    //    reemplazo tiene que cumplir una condición comprobable (aguantar el
    //    agua, o no ser mocasín en frío), no una de criterio.
    if (v.regla === "lluvia-calzado" || v.regla === "mocasin-en-frio") {
      const actual = enLook().find((i) => cat(i) === "calzado");
      const otro = disponibles.filter((i) => cat(i) === "calzado")[0];
      if (actual && otro) {
        const nuevos = ids.map((id) => (id === actual.id ? otro.id : id));
        return {
          ids: nuevos,
          hecha: {
            regla: v.regla,
            como: "sustituida",
            entro: nombre(otro),
            salio: nombre(actual),
          },
        };
      }
    }
  }

  // El resto (traje-desparejado, cueros-que-no-se-hablan, capa-invisible,
  // codigo-de-smoking…) NO se toca aquí a propósito: elegir "otro pantalón
  // cualquiera" no arregla un traje desparejado — hay que ver CUÁL, y eso es
  // criterio. Esas siguen su camino al juez.
  return null;
}
