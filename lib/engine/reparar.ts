import type { EngineItem } from "./prompt";
import { esCuero, revisarEjecucion, type ContextoReglas, type Violacion } from "./reglas-ejecucion";
import { distanciaPerceptual } from "./color-perceptual";
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
  /** "anadida" = se sumó una prenda; "sustituida" = se cambió una por otra;
   *  "quitada" = se retiró (sólo accesorios — nada estructural sale del look). */
  como: "anadida" | "sustituida" | "quitada";
  /** Nombre de la prenda que entró (no aplica al quitar). */
  entro?: string;
  /** Nombre de la que salió (sustitución o retiro). */
  salio?: string;
};

const nombre = (i: EngineItem) => i.attrs.nombre ?? i.attrs.tipo ?? i.id;
const cat = (i: EngineItem) => (categoriaDeItem(i as never) ?? "").toLowerCase();

/** ¿Es calzado? POR NOMBRE ADEMÁS DE POR CATEGORÍA, y el orden importa: las
 *  prendas nacidas del catálogo no traen `categoria` en attrs (la categoría es
 *  columna del arquetipo, no viaja en la copia), así que confiar sólo en cat()
 *  dejó una vez que el reparador tratara unos mocasines como "accesorio
 *  movible" y los quitara del look. Cazado validando contra los looks reales
 *  de la ronda 283d8d44 — los tests con fixtures no lo veían porque los
 *  fixtures sí traían categoría. */
const esCalzado = (i: EngineItem) =>
  cat(i) === "calzado" ||
  /zapat|mocas[ií]n|bot[ií]n|\bbota|tenis|sandalia|derby|oxford|loafer|flats|tac[oó]n|bailarina/.test(
    texto(i)
  );
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
    const intento = intentarUna(v, ids, closet, porId, violacionesDe);
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
  /** Contar violaciones de un look hipotético — para pre-comprobar arreglos
   *  que tienen plan B (si el reemplazo no sirve, se intenta el retiro). */
  violacionesDe: (ids: string[]) => Violacion[]
): { ids: string[]; hecha: Reparacion } | null {
  const puestas = new Set(ids);
  const disponibles = closet.filter((i) => !puestas.has(i.id));
  // El look VIGENTE, de los ids de esta vuelta. Antes esto era un closure
  // sobre los ids ORIGINALES ("enLook"), y en la segunda vuelta el reparador
  // buscaba prendas que ya habían salido del look — se rendía sin arreglar lo
  // que su propia primera vuelta había dejado pendiente. Cazado con "Casual
  // con Filo" (283d8d44): cambió café→negro, y el negro-que-también-chocaba ya
  // no lo pudo ni ver.
  const enLook = () => ids.map((id) => porId.get(id)).filter((x): x is EngineItem => !!x);

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
      // esCalzado y no cat(): mismo hueco que cazó la rama de cueros — las
      // prendas de catálogo no traen categoria en attrs.
      const actual = enLook().find(esCalzado);
      const otro = disponibles.filter(esCalzado)[0];
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

    // ── EL CUERO ACCESORIO SE ALINEA CON EL CALZADO, O SE VA. Esta regla
    //    vivió meses en la lista de "criterio, que la vea el juez" de abajo —
    //    y medido en la primera ronda calificada (283d8d44), el juez la reparó
    //    3 de 7 veces y entregó 4 looks que él mismo veía rotos. Roberto
    //    confirmó el fallo CINCO veces calificando esos hallazgos ("Agree, no
    //    va café con negro").
    //
    //    Y para el par cinturón/zapato NO es criterio: el calzado es
    //    estructural (los pies no se quedan descalzos), así que lo único
    //    movible es el accesorio — se cambia por uno del color del calzado y,
    //    si el clóset no lo tiene, se retira. Un look sin cinturón está bien;
    //    uno con el cinturón que choca, no.
    if (v.regla === "cueros-que-no-se-hablan") {
      const cueros = enLook().filter((i) => esCuero(i) && i.attrs.color_hex);
      const calzado = cueros.find(esCalzado);
      // Sólo accesorios de cuero se mueven (cinturón, reloj, correa): una
      // chamarra de piel también es cuero, pero quitarla no es quirúrgico.
      const moviles = cueros.filter(
        (i) => !esCalzado(i) && /cintur[oó]n|reloj|correa/.test(texto(i))
      );
      const actuales = violaciones.length;
      for (const movil of moviles) {
        // Mismo rol, otra pieza: cinturón por cinturón, reloj por reloj. La
        // clase sale del nombre, que es como la propia regla reconoce cueros.
        const clase = [/cintur[oó]n/, /reloj/, /correa/].find((r) => r.test(texto(movil)));
        const candidatos = clase
          ? disponibles
              .filter((i) => clase.test(texto(i)))
              // Primero el más cercano al color del calzado: "café con café,
              // negro con negro", que es la receta que la regla cita.
              .sort(
                (a, b) =>
                  (distanciaPerceptual(a.attrs.color_hex, calzado?.attrs.color_hex) ?? 9) -
                  (distanciaPerceptual(b.attrs.color_hex, calzado?.attrs.color_hex) ?? 9)
              )
          : [];
        for (const cand of candidatos) {
          const nuevos = ids.map((id) => (id === movil.id ? cand.id : id));
          // Se pre-comprueba AQUÍ y no sólo en la guarda de afuera, para poder
          // caer al retiro si ningún reemplazo sirve: la guarda exterior corta
          // el bucle al primer intento fallido.
          if (violacionesDe(nuevos).length < actuales) {
            return {
              ids: nuevos,
              hecha: {
                regla: v.regla,
                como: "sustituida",
                entro: nombre(cand),
                salio: nombre(movil),
              },
            };
          }
        }
        // Plan B: retirarlo. Con tope de 3 prendas — por debajo, quitar deja
        // de ser quirúrgico y el look ya tiene un problema más grande.
        const sin = ids.filter((id) => id !== movil.id);
        if (sin.length >= 3 && violacionesDe(sin).length < actuales) {
          return {
            ids: sin,
            hecha: { regla: v.regla, como: "quitada", salio: nombre(movil) },
          };
        }
      }
    }

    // ── EL RELOJ DEPORTIVO SE CAMBIA POR UNO DE VESTIR, O SE VA. Nace ya con
    //    reparación a propósito: las reglas anteriores se escribieron sin ella
    //    y el motor entregaba roto lo que sabía roto. La muñeca desnuda es más
    //    elegante que la muñeca equivocada, así que el retiro es plan B legal.
    if (v.regla === "reloj-deportivo-con-sastre") {
      const esReloj = (i: EngineItem) => /reloj|\bwatch/.test(texto(i));
      const movil = enLook().find(esReloj);
      if (movil) {
        const candidatos = disponibles.filter(esReloj);
        for (const cand of candidatos) {
          const nuevos = ids.map((id) => (id === movil.id ? cand.id : id));
          if (violacionesDe(nuevos).length < violaciones.length) {
            return {
              ids: nuevos,
              hecha: { regla: v.regla, como: "sustituida", entro: nombre(cand), salio: nombre(movil) },
            };
          }
        }
        const sin = ids.filter((id) => id !== movil.id);
        if (sin.length >= 3 && violacionesDe(sin).length < violaciones.length) {
          return { ids: sin, hecha: { regla: v.regla, como: "quitada", salio: nombre(movil) } };
        }
      }
    }

    // ── LA CORBATA DE PUNTO SE CAMBIA POR UNA LISA — Y NO SE QUITA. La
    //    diferencia con el reloj es deliberada: en una ceremonia el código
    //    pide corbata, así que retirarla arreglaría esta regla rompiendo el
    //    pedido. Si el clóset no tiene otra corbata, esto se queda como está
    //    y el hallazgo sigue su camino al juez.
    if (v.regla === "corbata-de-punto-en-ceremonia") {
      const movil = enLook().find(
        (i) => /corbata/.test(texto(i)) && /punto|tejid|knit/.test(texto(i))
      );
      if (movil) {
        const candidatos = disponibles.filter(
          (i) => /corbata/.test(texto(i)) && !/punto|tejid|knit/.test(texto(i))
        );
        for (const cand of candidatos) {
          const nuevos = ids.map((id) => (id === movil.id ? cand.id : id));
          if (violacionesDe(nuevos).length < violaciones.length) {
            return {
              ids: nuevos,
              hecha: { regla: v.regla, como: "sustituida", entro: nombre(cand), salio: nombre(movil) },
            };
          }
        }
      }
    }

  }

  // El resto (traje-desparejado, capa-invisible, codigo-de-smoking…) NO se
  // toca aquí a propósito: elegir "otro pantalón cualquiera" no arregla un
  // traje desparejado — hay que ver CUÁL, y eso es criterio. Esas siguen su
  // camino al juez.
  return null;
}
