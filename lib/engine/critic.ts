import { llamar, type Recibo } from "@/lib/proveedores";
import { MODELO_JUEZ } from "@/lib/models";
import { buildCriticSchema } from "./schema";
import {
  contextBlock,
  closetBlock,
  recetasDelContexto,
  ESCALERA_DE_PRIORIDADES,
  type EngineContext,
} from "./prompt";
import { bloqueEjecucion } from "./reglas-ejecucion";
import { bandaDeClima } from "./recetario";
import { blueprintDelContexto, revisarColorBlueprint } from "./blueprint";
import type { GeneratedOutfit } from "./generate";

// Juez de styling, UNO POR OUTFIT (para poder ir mostrándolos conforme se
// aprueban). Caza color que choca y problemas de styling y los ARREGLA
// intercambiando prendas del mismo clóset. Si el look está mal y NO se puede
// arreglar con este clóset, lo RECHAZA (con razón) en vez de maquillarlo.
// Corre en Sonnet (rápido/barato, ya que se llama por cada outfit). Si falla,
// devuelve el outfit original con veredicto "ok" — nunca rompe la generación.
// Rúbrica más exigente para mujer que para hombre.
//
// EL TIP, Y POR QUÉ SE REESCRIBIÓ (2026-08-07)
// El wow salió 2.98 en el eval —la nota más baja de las seis— y la causa no era
// que faltaran tips: eran 40 de 40. Era que TODOS decían lo mismo. De 40 tips,
// 27 eran "deja X abierto"; arremangar apareció UNA vez y un accesorio, cero.
// Un motor con un solo truco.
//
// Y el prompt lo pedía, literalmente: decía "NO ves la prenda (solo
// tipo/color/formalidad), así que prioriza movimientos SEGUROS: dejar una capa
// abierta", y marcaba fajar y cuffear como "de RIESGO". El modelo obedecía.
//
// Lo que ya no era cierto es la premisa: desde v38 describeItem manda corte,
// largo, manga, material y subtipo, y este juez los recibe (usa closetBlock).
// O sea que llevaba versiones creyéndose más ciego de lo que estaba. Ahora
// tiene un repertorio explícito con la condición de activación de cada gesto
// —atada a esos atributos— y la orden de no caer en el gesto fácil por default.
//
// Se quitó además "NO pongas tip en todos los looks": este juez revisa UN
// outfit a la vez y no ve a los otros, así que esa cuota era imposible de
// cumplir por construcción. El criterio que sí puede evaluar (si no eleva, va
// vacío) se queda.

// Modelo de los jueces. Vive en lib/models.ts junto con el del motor: tenerlos
// separados fue lo que dejó 14 archivos apuntando a un Opus viejo mientras los
// jueces ya estaban actualizados. Se re-exporta porque media docena de archivos
// lo importan desde aquí.
export { JUDGE_MODEL } from "@/lib/models";

export type CriticVerdict = "ok" | "reparado" | "rechazado";

// Resultado del juez: el look final + su veredicto y razón (para el flywheel).
// En "rechazado" el outfit que devolvemos es el original (sin tocar) — quien
// llama decide si lo descarta o lo muestra como último recurso.
export type CriticResult = {
  outfit: GeneratedOutfit;
  verdict: CriticVerdict;
  razon: string | null;
  /** El recibo de la llamada (tokens/costo/ms). null si el juez no corrió o falló. */
  recibo: Recibo | null;
};

// La MISMA escalera que usa la stylist para armar. Sin esto el juez trabaja con
// otro orden de prioridades y "repara" decisiones correctas: cambia el top que
// la stylist eligió por colorimetría porque a él le pesó más la receta, y el
// look sale peor después de la revisión que antes.
export const CRITIC_SYSTEM_TEXT = `Eres el director de estilo de stailist: revisas UN look que armó la stylist antes de enseñárselo a la clienta. Subes el nivel, no rehaces.

${ESCALERA_DE_PRIORIDADES}

Antes de cambiar algo, pregúntate si la stylist cedió a propósito por algo de MÁS arriba en esa escalera. Si fue así, no lo "arregles": lo empeorarías.

Qué haces (elige UN veredicto):
- "ok": está bien armado y los colores combinan → DÉJALO IGUAL (mismas prendas).
- "reparado": tiene un problema (color que choca, proporción rara, formalidades que pelean, le falta algo para cerrar) que SÍ puedes resolver intercambiando UNA prenda por otra del MISMO clóset (vienen con id y hex) → arréglalo y reescribe su explicación.
- "rechazado": está mal Y NO se puede arreglar con este clóset (no hay una prenda alternativa que funcione). Es la EXCEPCIÓN, no la norma: primero intenta reparar; rechaza solo si de verdad no hay arreglo. Di la razón concreta.

Reglas duras:
- VETOS: si el contexto trae una lista de VETOS y el look incluye algo vetado, NO pasa. Repáralo cambiando esa prenda por otra del clóset que no esté vetada; si no hay alternativa limpia, RECHÁZALO (razón: "veto"). Es absoluto, por encima de todo lo demás.
- Usa ÚNICAMENTE prendas del clóset (por id). Jamás inventes.
- Cambia SOLO cuando de verdad mejora. Si dudas, déjalo como está (ok).
- Si te paso looks ya aprobados, mantén ÉSTE distinto de ellos.
- Marino + negro combinan bien (incluso formal); NO los separes por eso. Concéntrate en color que de verdad choca, proporción y coherencia.
- Caza el combo que NO existe: capas apiladas en un orden que nadie usa en la calle (chaleco sastre sobre suéter, saco debajo de sudadera, doble abrigo; una camisa de vestir fina va DEBAJO del punto, no encima — pero una sobrecamisa/overshirt gruesa abierta SÍ es capa exterior válida sobre un suéter ligero, no la marques como error). REPÁRALO cambiando la capa ofensora por otra del clóset que sí caiga natural; si no hay arreglo, RECHÁZALO (razón: "capas").
- Caza la ropa de baño y de entrenar en un look de calle (aquí no hay ocasión de playa ni de gym): traje de baño o bikini (vienen como "vestido"), short de baño, o un top deportivo tipo bra como ÚNICO top. REPÁRALO cambiándolo por una prenda de calle del clóset — al bra le basta una capa encima (sudadera, camisa o chamarra abierta); si no hay arreglo, RECHÁZALO (razón: "no es ropa de calle").
- Caza el "traje desparejado": un saco/blazer + pantalón del MISMO color y tono (marino con marino, gris con gris, negro con negro) que NO son un traje real se ve como un conjunto roto. Si lo ves, REPÁRALO cambiando el bottom por otro neutro del clóset (gris, beige, caqui, denim) para que el saco se lea como pieza intencional. (No aplica si de verdad son un traje de la misma tela.)
- La explicación: una línea, voz de amiga cool, tuteo, cero jerga técnica.

EL TOQUE (cómo llevarlo) — campo "tip", OPCIONAL:
Puedes sumar UN tip de styling: un solo movimiento concreto para llevar mejor las prendas que YA trae ESTE look. Reglas (síguelas o deja "tip" en cadena vacía):
- UNO solo, o NINGUNO. Si el look ya está completo y no hay un movimiento que de verdad lo eleve, deja "tip" en cadena vacía. Mejor sin tip que uno forzado.
- SOLO sobre prendas que están en el look (las de item_ids). NUNCA inventes ni menciones una prenda que NO está en la lista, ni siquiera como sugerencia para añadir ("súmale una camisa encima", "ponte un saco" si no está → PROHIBIDO). El toque es cómo llevar lo que YA hay; si no hay un buen movimiento con eso, deja el tip vacío. (Causó confusión real un tip que decía "deja la camisa de lino abierta" cuando el look era polo + pantalón de lino, sin ninguna camisa.)
- Concreto y nombrando una prenda REAL del look ("deja el blazer abierto", "abre el primer botón del polo"), nunca genérico ("acomoda tu top") ni una prenda ausente.

EL REPERTORIO. Cada prenda del look te llega con sus atributos de styling cuando existen — corte (entallado/recto/holgado), largo (crop/regular/largo), manga (sin/corta/larga), material y subtipo (derby, oxford, mocasín, cruzado, con pinzas). ÚSALOS: son la diferencia entre un gesto que cae bien y uno genérico. Estos son los movimientos, con lo que cada uno necesita para funcionar:
- ABRIR UNA CAPA (blazer, chamarra, overshirt, abrigo) — pide que haya capa Y que lo de abajo aporte algo al abrirse (color, textura, cuello). Si abajo hay más de lo mismo, abrir no eleva nada.
- ARREMANGAR — pide manga larga. Dos vueltas sobre el antebrazo en camisa; en blazer, por encima del puño de la camisa para que asome lo de abajo.
- FAJAR O MEDIO FAJAR — pide largo regular o largo. Con largo "crop" NO se faja (ya está a la cintura); si el largo no viene, frasea condicional.
- CUFFEAR EL PANTALÓN — pide que el calzado se vea (botín, mocasín, tenis). Con bota alta no aporta.
- JUGAR LA PROPORCIÓN — pide un corte holgado y otro entallado en el mismo look: nombra los dos y di qué equilibra.
- EL CUELLO — abrir uno o dos botones, o sacar el cuello de la camisa por encima del punto/half-zip.
- EL CALZADO Y EL SUBTIPO — cuando el subtipo es distintivo (derby contra oxford, mocasín sin calcetín), el gesto puede ser cómo se lleva ese zapato.
- ACCESORIO QUE YA ESTÁ EN EL LOOK — cinturón, reloj, lentes, bufanda: cómo se coloca o con qué se alinea. NUNCA uno que no esté en item_ids.

NO TE REPITAS. "Deja la capa abierta" es el gesto más fácil y por eso el más gastado: si es el primero que se te ocurre, BUSCA OTRO del repertorio que este look permita, y quédate con abrir la capa solo si de verdad es el mejor movimiento aquí. Un stylist que dijera lo mismo en todos los looks no se sentiría stylist.
- Movimientos que dependen de un dato que quizá no tengas: si el atributo que el gesto necesita no viene, o lo frasea condicional ("si te da el largo, medio fájala al frente") o eliges otro gesto. Nunca afirmes un largo o un corte que no te dieron.
- Respeta formalidad (formal: fajar sí, medio-fajar/cuffear casual no), el vibe (minimalista = menos es más) y el género.
- Si el contexto trae su cuerpo, conecta el efecto cuando aplique ("fájala al frente — te marca la cintura, que te equilibra").
- Voz de amiga cool, una frase corta, sin jerga.`;

const RUBRICA_MUJER = `Revisa con ojo de stylist de moda femenina (muchos grados de libertad, sé exigente):
- Color: máx 1-2 protagonistas + neutros; nada que choque o se enlode (juzga por el hex). Lo near-face (top/abrigo) idealmente la favorece; un color de su EVITA near-face es preferencia, no veto — cámbialo SOLO si hay una mejor opción en el clóset, nunca rechaces el look solo por eso. Y los NEUTROS (gris de cualquier tono, azul suave, denim, blanco hueso, crudo, negro) NO compiten con su paleta: son el fondo, funcionan siempre. Que un gris no esté en su lista de favoritos NO es un problema que reparar — la lista solo ordena los colores CON carácter.
- Proporción y silueta: equilibra volumen (oversize arriba ↔ entallado abajo); evita "todo holgado" o "todo pegado".
- Cintura y largos: define la cintura cuando ayude; cuida el largo de falda/vestido contra el calzado.
- Capas y coherencia: vestido O dos piezas con lógica; saco/capa que sume; no mezcles deportivo con formal salvo intención.
- Completitud: si se siente incompleto, intercambia por una pieza que lo cierre.`;

const RUBRICA_HOMBRE = `Revisa con criterio masculino (más formulaico, lo esencial):
- Color: máx 1-2 protagonistas + neutros; nada que choque (juzga por el hex). Near-face en su paleta; un EVITA near-face es preferencia (cámbialo solo si hay mejor opción en el clóset), no motivo de rechazo. Los NEUTROS (gris, azul suave, denim, blanco hueso, crudo, negro) NO compiten con la paleta: son el fondo y funcionan siempre — no los cambies por un color de su lista.
- Coherencia de formalidad: no mezcles sastre formal con deportivo salvo intención.
- Proporción básica: que no sea todo holgado ni todo pegado.`;

// Sin género definido: lo esencial sin asumir tipo de guardarropa.
const RUBRICA_NEUTRA = `Revisa lo esencial (sin asumir género):
- Color: máx 1-2 protagonistas + neutros; nada que choque o se enlode (juzga por el hex). Near-face en su paleta; un EVITA near-face es preferencia (cámbialo solo si hay mejor opción en el clóset), no motivo de rechazo. Los NEUTROS (gris, azul suave, denim, blanco hueso, crudo, negro) NO compiten con la paleta: son el fondo y funcionan siempre — no los cambies por un color de su lista.
- Proporción: equilibra volumen (holgado arriba ↔ entallado abajo); evita "todo holgado" o "todo pegado".
- Coherencia de formalidad: no mezcles formal con deportivo salvo intención.
- Completitud: si se siente incompleto, intercambia por una pieza que lo cierre.`;

// Pura y exportada para test: v23 arregló que null caía a la rúbrica de hombre
// (la menos exigente) — este selector fija ese contrato.
export function rubricFor(gender: "hombre" | "mujer" | null): string {
  return gender === "mujer"
    ? RUBRICA_MUJER
    : gender === "hombre"
      ? RUBRICA_HOMBRE
      : RUBRICA_NEUTRA;
}

function buildCriticMessage(
  ctx: EngineContext,
  outfit: GeneratedOutfit,
  priorOutfits: GeneratedOutfit[]
): string {
  // El juez ve las MISMAS marcas de estilo que el generador. Si solo las viera
  // uno, el juez "repararía" el look quitando justo la prenda que lo hacía de su
  // estilo — el mismo motivo por el que la escalera de prioridades va en los dos
  // prompts y no en uno (v30).
  const lines: string[] = [
    ...contextBlock(ctx),
    "",
    ...closetBlock(ctx.items, recetasDelContexto(ctx)),
  ];

  lines.push("", `Look a revisar — "${outfit.nombre}": ${outfit.item_ids.join(" + ")}`);

  // Fallos de armado ya COMPROBADOS con los colores y materiales reales de las
  // prendas del look (ver reglas-ejecucion.ts). Van antes de la rúbrica y
  // marcados como verificados para que el juez los repare en vez de opinar
  // sobre ellos: detección determinista, reparación con criterio.
  // El clóset completo va aparte del look: la regla del frío distingue "no se
  // puso el abrigo que tiene" (reparable) de "no tiene abrigo" (no lo es).
  lines.push(
    ...bloqueEjecucion(
      ctx.items.filter((i) => outfit.item_ids.includes(i.id)),
      {
        clima: bandaDeClima(ctx.weather),
        closet: ctx.items,
        // La lluvia es su propia dimensión: 17°C con lluvia y 17°C despejado
        // son la misma BANDA de temperatura y dos problemas distintos.
        lluvia: /lluvia|llov|chubasco|tormenta/i.test(ctx.weather?.condition ?? ""),
        paraguas: ctx.paraguas,
        // La formalidad del evento: sin ella, "separates en boda formal" no se
        // puede distinguir de "separates en la oficina", que es correcto.
        formality: ctx.formality,
        // Para quién: la regla del suéter es convención MASCULINA, y aplicarla
        // a una mujer marca como error el punto a piel, que ahí es normal.
        gender: ctx.gender,
      }
    )
  );

  // La relación de color de la estructura de referencia, comprobada con los hex
  // reales del look. Es la cerca que NO puede alucinar: "capa profunda sobre
  // base clara" se vuelve una comparación de luminancias, y "un solo tono vivo"
  // un conteo de saturaciones.
  //
  // blueprintDelContexto está sembrado por día y clóset a propósito: si el juez
  // eligiera otro blueprint que el generador, repararía el look contra una
  // estructura que nadie usó.
  const bpJuez = blueprintDelContexto(
    ctx,
    bandaDeClima(ctx.weather),
    recetasDelContexto(ctx).map((r) => r.familia)
  );
  if (bpJuez) {
    const reparos = revisarColorBlueprint(
      bpJuez.bp,
      ctx.items.filter((i) => outfit.item_ids.includes(i.id))
    );
    if (reparos.length) {
      lines.push(
        "",
        "LA RELACIÓN DE COLOR DE LA REFERENCIA NO SE CUMPLE (medido con los colores reales, no es opinión — REPÁRALO):",
        ...reparos.map((r) => `- ${r}`)
      );
    }
  }

  if (priorOutfits.length > 0) {
    lines.push("", "Looks ya aprobados (mantén éste DISTINTO de ellos):");
    priorOutfits.forEach((o) => lines.push(`- ${o.item_ids.join(" + ")}`));
  }

  lines.push("", rubricFor(ctx.gender));
  lines.push(
    "",
    "Devuelve tu veredicto (ok / reparado / rechazado), la razón, y el look final (arreglado o tal cual)."
  );
  return lines.join("\n");
}

// El juez nunca puede tirar el ancla: si su reescritura la perdió, la re-inyecta.
function keepAnchor(o: GeneratedOutfit, seed: string | null): GeneratedOutfit {
  if (!seed || o.item_ids.includes(seed)) return o;
  return { ...o, item_ids: [seed, ...o.item_ids].slice(0, 5) };
}

export async function reviewOutfit(
  ctx: EngineContext,
  outfit: GeneratedOutfit,
  priorOutfits: GeneratedOutfit[]
): Promise<CriticResult> {
  // Sin juez (no hay API key): pasa el outfit tal cual, veredicto neutro.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { outfit, verdict: "ok", razon: null, recibo: null };
  }

  try {
    const itemIds = ctx.items.map((i) => i.id);
    // Por la puerta común (lib/proveedores): mismo recibo que el generador, y
    // el thinking lo apaga el adaptador. El modelo es FIJO (MODELO_JUEZ)
    // también en el comparador: la variable bajo prueba es el generador.
    const recibo = await llamar({
      modelo: MODELO_JUEZ,
      system: CRITIC_SYSTEM_TEXT,
      texto: buildCriticMessage(ctx, outfit, priorOutfits),
      schema: buildCriticSchema(itemIds),
      // 1536: el tokenizer de Sonnet 5 emite ~30% más tokens que 4.6 para el
      // mismo texto — con 1024 un veredicto largo truncaba y el catch devolvía
      // "ok" en silencio (juez deshabilitado sin señal).
      maxTokens: 1536,
    });

    // Truncado = veredicto ilegible → fail-forward igual que siempre, pero con
    // el recibo (la llamada SÍ costó).
    if (recibo.truncada) return { outfit, verdict: "ok", razon: null, recibo };

    const parsed = JSON.parse(recibo.texto) as GeneratedOutfit & {
      veredicto?: CriticVerdict;
      razon?: string;
    };
    const verdict: CriticVerdict =
      parsed.veredicto === "reparado" || parsed.veredicto === "rechazado"
        ? parsed.veredicto
        : "ok";
    const razon = parsed.razon?.trim() ? parsed.razon.trim() : null;
    const tip = parsed.tip?.trim() ? parsed.tip.trim() : null;

    // Rechazado: devolvemos el outfit ORIGINAL (sin la "reparación" fallida);
    // quien llama decide descartarlo o mostrarlo como último recurso. El original
    // ya trae el ancla (los candidatos vienen anclados del generador).
    if (verdict === "rechazado") {
      return { outfit, verdict, razon, recibo };
    }

    // ok / reparado: usamos el look del juez solo si es válido; si no, el original.
    const valid = new Set(itemIds);
    if (
      parsed.nombre &&
      parsed.explicacion &&
      Array.isArray(parsed.item_ids) &&
      parsed.item_ids.length >= 2 &&
      parsed.item_ids.every((id) => valid.has(id))
    ) {
      return {
        outfit: keepAnchor(
          {
            nombre: parsed.nombre,
            item_ids: parsed.item_ids,
            explicacion: parsed.explicacion,
            tip,
          },
          ctx.seedItemId ?? null
        ),
        verdict,
        razon,
        recibo,
      };
    }
    return { outfit, verdict: "ok", razon: null, recibo };
  } catch {
    return { outfit, verdict: "ok", razon: null, recibo: null };
  }
}
