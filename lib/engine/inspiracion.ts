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
    /** Inyectable para tests y para que el arnés pueda reproducir una corrida. */
    rand?: () => number;
    tope?: number;
  }
): Promise<Inspiracion[]> {
  const { familias, genero, clima, season, fitPref } = opts;
  const rand = opts.rand ?? Math.random;
  const tope = opts.tope ?? 3;
  if (!familias.length || !genero) return [];

  const base = supabase
    .from("referencias")
    .select("path, estilo, clima, paleta, silueta")
    .eq("sirve", true)
    .eq("genero", genero)
    .in("estilo", familias);

  const paletas = paletasPara(season);
  // 1º: familia + clima + paleta. 2º: sin paleta. 3º: sin clima.
  const intentos = [
    base.eq("clima", clima).in("paleta", paletas),
    base.eq("clima", clima),
    base,
  ];
  for (const q of intentos) {
    const { data } = await q;
    if (!data?.length) continue;
    // Barajar primero (para que no salgan siempre las mismas) y DESPUÉS subir
    // las de su silueta. Al revés, el orden de la base decidiría cuáles ve.
    const mezcladas = barajar(data as Inspiracion[], rand);
    const quiere = fitPref === "recta" || fitPref === "holgada" ? fitPref : null;
    if (!quiere) return mezcladas.slice(0, tope);
    return [
      ...mezcladas.filter((r) => r.silueta === quiere),
      ...mezcladas.filter((r) => r.silueta !== quiere),
    ].slice(0, tope);
  }
  return [];
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
export const INSTRUCCION_INSPIRACION = `LOOKS DE REFERENCIA (fotos reales de calle, ya curadas): te paso 3 imágenes de looks de SU estilo, para ESTE clima. Son de gente real bien vestida, no catálogo.

Cómo usarlas, en este orden:
1. Si con SU clóset puedes reproducir uno de esos looks —mismo tipo de prendas, misma idea— hazlo. Es la mejor opción: sabemos que ese look funciona.
2. Si no da para reproducir ninguno, úsalas como referencia de PROPORCIÓN y de COMBINACIÓN: qué tan holgado va arriba contra abajo, cuántos colores conviven, dónde cae el pantalón sobre el zapato, qué capa va abierta.
3. Si un look de la foto no se puede acercar con lo que tiene, IGNÓRALO. No fuerces prendas para parecerte a una foto: un look forzado se ve peor que uno simple bien resuelto.

REGLA DURA: las prendas del look son SIEMPRE del clóset de la persona (por id). Las fotos orientan; jamás uses ni menciones una prenda que solo está en la imagen.`;
