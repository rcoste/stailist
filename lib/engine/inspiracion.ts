// Tres fotos reales de looks que funcionan, elegidas para ESTE día y ESTA
// persona, que el motor ve mientras arma.
//
// DE DÓNDE VIENE LA IDEA
// El recetario comprimió 616 fotos de calle a texto: silueta, paleta, fórmulas,
// detalles. Y el A/B ciego dijo que ese texto NO mejora nada — 5 a 4 contra el
// motor de julio, indistinguible del azar. La lectura más probable: al destilar
// a palabras se pierde justo lo que hace que un look funcione. "Suéter de ochos
// sobre camisa oxford, chino crema" describe mil looks, y solo algunos se ven
// bien.
//
// Roberto: "de las imágenes que tenemos destiladas, sacar 3 que caigan en las
// preferencias del usuario y vayan acorde a la ocasión, y con eso se hace la
// inspo — copiando uno tal cual con las prendas del usuario, o como referencia".
//
// La foto no se comprime. Opus 5 ve la proporción, cómo cae la tela, dónde va el
// dobladillo, qué tanto contraste hay — todo lo que el texto tira.
//
// LO QUE ESTO NO ES
// No es copiar. El schema del motor solo acepta ids del clóset real, así que
// jamás puede "usar" una prenda de la foto. Las fotos orientan; las prendas
// siguen siendo las suyas.
//
// POR QUÉ AL AZAR Y NO "LAS 3 MEJORES"
// Todas las de la biblioteca ya pasaron el filtro de visión y la curación a
// mano: no hay unas mejores que otras, hay unas más parecidas al día de hoy. El
// azar además evita que todo el mundo reciba siempre las mismas tres y que los
// looks converjan — que es justo lo que le pasó al deck cuando se generaba
// desde plantillas.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clima } from "./recetario";

export type Inspiracion = {
  path: string;
  estilo: string;
  clima: string;
  paleta: string;
  silueta: string;
  ocasiones?: string[] | null;
  registro?: string | null;
  de_noche?: boolean | null;
};

/** Las paletas con que se etiquetó la biblioteca. */
type PaletaRef = "tierra" | "neutra" | "oscura" | "color";

/**
 * Qué paletas de la biblioteca le quedan a una colorimetría.
 *
 * "neutra" entra siempre: es el vocabulario común (blanco, gris, negro suave) y
 * le funciona a cualquiera. Las otras se eligen por temperatura — cálidas para
 * otoño y primavera, frías y profundas para invierno y verano.
 *
 * Filtro SUAVE a propósito: si el filtro se pone estricto, para un preppy de
 * invierno en frío quedan tres fotos y siempre son las mismas.
 */
function paletasPara(season: string | null): PaletaRef[] {
  const s = (season ?? "").toLowerCase();
  if (s.startsWith("otono") || s.startsWith("otoño") || s.startsWith("primavera"))
    return ["tierra", "neutra", "color"];
  if (s.startsWith("invierno")) return ["oscura", "neutra", "color"];
  if (s.startsWith("verano")) return ["neutra", "oscura", "color"];
  return ["neutra", "tierra", "oscura", "color"];
}

/**
 * Tres looks de la biblioteca para este día y esta persona.
 *
 * `familias` son los ids de las familias que le gustan (los mismos que produce
 * recetasParaTags). Sin familias no devuelve nada: sin saber qué le gusta,
 * enseñarle tres fotos al azar es peor que no enseñarle ninguna.
 *
 * El filtro se AFLOJA en dos pasos si no hay material: primero se suelta la
 * paleta, luego el clima. Es el mismo criterio que el recetario usa con sus
 * fórmulas — mejor una foto de templado adaptada que ninguna. Y si ni así hay,
 * devuelve vacío y el motor arma como siempre: esto enriquece, no es requisito.
 */
export async function elegirInspiracion(
  supabase: SupabaseClient,
  opts: {
    familias: string[];
    genero: "hombre" | "mujer" | null;
    clima: Clima;
    season: string | null;
    /**
     * Cómo le gusta que le quede la ropa (profiles.fit_pref). Ordena, NO filtra.
     *
     * Hizo falta al mirar la primera selección: para alguien de fit "recta"
     * salieron tres fotos holgadas, porque la biblioteca tiene 67 holgadas de
     * casual-limpio contra 30 rectas. Enseñarle tres looks holgados a quien
     * prefiere recto empuja al motor justo contra su preferencia.
     *
     * Preferencia y no filtro porque en algunas familias hay una sola foto de
     * una silueta (preppy ceñida: 1), y un filtro duro dejaría a esa persona sin
     * inspiración o siempre con la misma imagen.
     */
    fitPref?: "recta" | "holgada" | "mixta" | null;
    /**
     * La ocasión del día ("diario" | "oficina" | "evento" | "viaje").
     *
     * Lo que Roberto pidió desde el principio y la primera versión no hacía: para
     * un evento de noche se le enseñaban al motor looks casuales, y en 4 de 12
     * casos la referencia no podía ayudar. La biblioteca no tenía el dato; se
     * etiquetó aparte (scripts/etiquetar-ocasion.mjs).
     */
    ocasion?: string | null;
    /**
     * Fotos que NO volver a usar en esta corrida.
     *
     * En la primera prueba salieron 20 fotos distintas para 36 espacios: una se
     * repitió 4 veces y otra 3. Pasa porque al priorizar la silueta el conjunto
     * efectivo se achica. Repetir la misma referencia entre casos le quita
     * variedad a lo que se mide y a lo que la persona acabaría viendo.
     */
    evitar?: Set<string>;
    /** Inyectable para tests y para que el arnés pueda reproducir una corrida. */
    rand?: () => number;
    tope?: number;
  }
): Promise<Inspiracion[]> {
  const { familias, genero, clima, season, fitPref, ocasion, evitar } = opts;
  const rand = opts.rand ?? Math.random;
  const tope = opts.tope ?? 3;
  if (!familias.length || !genero) return [];

  const base = () =>
    supabase
      .from("referencias")
      .select("path, estilo, clima, paleta, silueta, ocasiones, registro, de_noche")
      .eq("sirve", true)
      .eq("genero", genero)
      .in("estilo", familias);

  const paletas = paletasPara(season);
  // La ocasión es el filtro MÁS importante —una foto casual no sirve de
  // referencia para un evento— así que es lo último que se suelta. Se aflojan
  // antes la paleta y el clima.
  const conOcasion = <T extends { contains: (c: string, v: string[]) => T }>(q: T) =>
    ocasion ? q.contains("ocasiones", [ocasion]) : q;
  const intentos = [
    conOcasion(base().eq("clima", clima).in("paleta", paletas) as never),
    conOcasion(base().eq("clima", clima) as never),
    conOcasion(base() as never),
    base().eq("clima", clima),
    base(),
  ];
  for (const q of intentos) {
    const { data } = (await (q as unknown as Promise<{ data: Inspiracion[] | null }>)) ?? {};
    const libres = (data ?? []).filter((r) => !evitar?.has(r.path));
    if (!libres.length) continue;
    // Barajar primero (para que no salgan siempre las mismas) y DESPUÉS subir
    // las de su silueta. Al revés, el orden de la base decidiría cuáles ve.
    const mezcladas = barajar(libres, rand);
    const quiere = fitPref === "recta" || fitPref === "holgada" ? fitPref : null;
    const ordenadas = quiere
      ? [
          ...mezcladas.filter((r) => r.silueta === quiere),
          ...mezcladas.filter((r) => r.silueta !== quiere),
        ]
      : mezcladas;
    return repartirPorFamilia(ordenadas, familias, tope);
  }
  return [];
}

/**
 * Una foto por familia antes de repetir familia.
 *
 * Sin esto, a alguien con dos estilos le podían tocar las tres fotos del mismo —
 * y con "un look por foto", los tres looks acabarían siendo del mismo estilo.
 * Roberto: "si me gustan minimalista, coreano e hipster, no vas a promediar y
 * hacer una quimera; la respuesta es una de las tres, o las tres". Repartir es
 * lo que hace posible ese "las tres".
 *
 * Round-robin: primero una de cada familia en el orden en que le gustan (las
 * familias vienen ordenadas por fuerza), y si sobran espacios se rellena con lo
 * que haya.
 */
function repartirPorFamilia<T extends { estilo: string }>(
  xs: T[],
  familias: string[],
  tope: number
): T[] {
  const porFamilia = new Map<string, T[]>();
  for (const x of xs) porFamilia.set(x.estilo, [...(porFamilia.get(x.estilo) ?? []), x]);
  const out: T[] = [];
  // Vueltas de round-robin hasta llenar el tope o agotar el material.
  for (let vuelta = 0; out.length < tope && vuelta < tope; vuelta++) {
    for (const f of familias) {
      const cola = porFamilia.get(f);
      if (cola?.length && out.length < tope) out.push(cola.shift()!);
    }
    // Familias que no estaban en la lista (el filtro se aflojó): también entran.
    for (const [f, cola] of porFamilia) {
      if (familias.includes(f)) continue;
      if (cola.length && out.length < tope) out.push(cola.shift()!);
    }
  }
  return out;
}

function barajar<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * La instrucción que acompaña a las fotos.
 *
 * Dice las DOS cosas que Roberto pidió, en orden de preferencia: si el clóset da
 * para reproducir uno, hazlo; si no, úsalos de referencia. Y una tercera que no
 * pidió pero hace falta: que no fuerce. Sin esa línea, un modelo con tres fotos
 * enfrente intenta parecerse a ellas con lo que sea, y ahí es donde salen los
 * looks Frankenstein.
 */
export const INSTRUCCION_INSPIRACION = `LOOKS DE REFERENCIA (fotos reales de calle, ya curadas): te paso 3 imágenes de looks que a esta persona le gustan, para ESTE clima y ESTA ocasión. Son de gente real bien vestida, no catálogo.

UNA FOTO POR LOOK. Arma UN outfit por cada foto, EN ORDEN: el primero responde a la primera imagen, el segundo a la segunda, el tercero a la tercera. NO mezcles las tres en cada look.

Esto es lo más importante de toda la instrucción, así que va con su porqué: a alguien le pueden gustar tres estilos distintos —minimalista, coreano, vintage— y la respuesta correcta NO es promediarlos. Un promedio de tres estilos no es un estilo: es un look que no es de ninguno y que no le sirve a nadie. La respuesta correcta es darle uno de cada uno y que ELLA elija cuál se pone hoy. Un look tibio que intenta ser las tres cosas es peor que tres looks con carácter.

Cómo usar cada foto, en este orden:
1. Si con SU clóset puedes reproducir ese look —mismo tipo de prendas, misma idea— hazlo. Es la mejor opción: sabemos que funciona.
2. Si no da para reproducirlo, úsalo como referencia de PROPORCIÓN y de COMBINACIÓN: qué tan holgado va arriba contra abajo, cuántos colores conviven, dónde cae el pantalón sobre el zapato, qué capa va abierta.
3. Si no se puede acercar con lo que tiene, IGNORA esa foto y arma el mejor look posible con lo que hay. No fuerces prendas para parecerte a una imagen: un look forzado se ve peor que uno simple bien resuelto.

EL COLOR DE LA FOTO NO ES LITERAL — importante. De la foto se toma la ESTRUCTURA: qué tipo de prenda va con cuál y en qué proporción. NO el color exacto. Si la foto trae un polo azul y ella tiene uno verde que le favorece más por su colorimetría, el verde es la respuesta CORRECTA, no una concesión. Su colorimetría manda sobre el color de la referencia, siempre.

REGLA DURA: las prendas del look son SIEMPRE del clóset de la persona (por id). Las fotos orientan; jamás uses ni menciones una prenda que solo está en la imagen.`;
