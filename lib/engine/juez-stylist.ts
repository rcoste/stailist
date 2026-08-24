import { parsearJson, type Recibo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";
import { VISION_MODEL } from "@/lib/models";
import { briefParaRubrica, type BriefRubrica } from "./rubrica";
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import { REGLAS_DE_LA_CASA } from "./reglas-ejecucion";

// EL JUEZ QUE CRITICA, no el que califica.
//
// POR QUÉ EXISTE, con las palabras de Roberto: "los jueces van a hacer el
// trabajo que yo hacía manual, y ya después de la ronda ven qué motor fue mejor
// y hacen ajustes que puedan ayudar a resolver los issues que los jueces
// detectaron… es importante que alguno de los jueces se ponga el gorro de
// stylist también".
//
// LO QUE LAS DOS RÚBRICAS QUE YA HAY NO DAN. Las dos están escritas con gorro
// de stylist —la de texto dice literalmente "encontrar lo que un buen stylist
// humano marcaría"— pero su salida son SEIS NÚMEROS Y UNA LÍNEA, y esa línea
// justifica el aprobado. Lo que Roberto hace a mano es otra cosa: "la camisa
// negra es la pieza que rompe todo; cámbiala por blanca". Qué pieza, por qué, y
// qué harías. Ninguna rúbrica propone el arreglo, y el arreglo es lo que se
// convierte en el siguiente ajuste del motor.
//
// POR QUÉ NO LLEVA PUNTAJE, y esto es la parte que más importa: en el momento
// en que este juez tenga una nota que subir, alguien va a optimizar contra ella
// y el motor va a aprender a complacer al juez en vez de a la persona. La casa
// ya lo tiene escrito ("un juez Claude prefiere looks escritos por Claude").
// Entrega HALLAZGOS. El puntaje, si hace falta, lo dan las otras dos.
//
// LA VOZ SALE DEL ESPEJO, no se inventa aquí. `lib/espejo.ts` ya contesta "¿me
// veo bien?" con un ajuste concreto y accionable, y ya pasó por la corrección
// que pidió Roberto —la v3 nació de "siento está muy barbero el feedback"—
// contra el elogio hueco y los superlativos genéricos. Esa vara está calibrada
// por él; reusarla es más barato y más fiel que redescubrirla.
//
// MIRA LAS FOTOS, como el juez visual y por lo mismo: el color real, la textura
// y la proporción viven en la imagen y no en el nombre. NO el try-on, que lo
// inventa un modelo de imagen que alucina.
// js1 → js2 (2026-08-18), tras la PRIMERA corrida real. Dos fallos medidos, no
// supuestos:
//
//   1. ENCONTRÓ ALGO EN EL 100% DE LOS LOOKS (14/14 y 15/15). El prompt ya le
//      decía que devolviera lista vacía si el look estaba bien resuelto y no lo
//      hizo ni una vez. Un revisor que siempre encuentra algo no prioriza nada.
//      El arreglo no es repetirle la instrucción más fuerte: es DARLE LA TASA
//      BASE. Sobre los 62 looks que Roberto calificó a mano en los evales,
//      aprobó 54 — el 87%. Un juez que marca el 100% no está viendo lo que ve
//      la persona para la que trabaja.
//
//   2. REPITIÓ UN MITO QUE ESTA CASA YA DESMINTIÓ. Marcó en rojo "blazer marino
//      con pantalón negro es un error de paleta". Esa regla se metió al prompt
//      del motor en v5 y se REVIRTIÓ en v6 tras investigarla. Un juez que trae
//      sabiduría convencional sin medir vale menos que no tener juez: manda a
//      arreglar lo que está bien. Por eso ahora lleva la lista de lo que aquí
//      YA se midió y resultó falso.
// js2 → js3 (2026-08-19), tras la segunda ronda calificada por Roberto. El
// acierto cayó de 88% a 47% y al leer los desacuerdos uno por uno casi todos
// eran EL MISMO: el juez recomendando quitar la base de abajo del suéter — en
// contra de `sueter-sin-base`, una regla que nació de Roberto votando a ciegas.
// El juez no conocía las reglas de la casa: sólo veía las violaciones del look
// que miraba, así que un look que CUMPLÍA una regla le parecía mejorable
// rompiéndola. Ahora las recibe completas (REGLAS_DE_LA_CASA, co-ubicada con el
// código que las ejecuta) con la orden de no proponer arreglos que las rompan.
// js3 → js4 (2026-08-22), tras el primer EXAMEN contra los votos de Roberto
// (scripts/examen-juez.ts, 95 looks: 27 👎 / 68 👍). El diagnóstico: VE PERO NO
// PESA. Con cualquier hallazgo cazaba el 85% de sus 👎; con "rompe", el 22%.
// "Camisa negra para una boda es como de cholo… fatal" era color/resta;
// "mezclilla con blazer, hazme el puto favor" era plano/resta. Y al revés,
// marcaba con "resta" el 56% de los looks que él aprobó — casi siempre por lo
// mismo: cinturón negro con mocasín burdeos (lo aprueba siempre), reloj de
// caucho en oficina, traje entero en cita, "plano" (18 de 21 veces en looks
// que le gustaron). El arreglo no es un umbral numérico: es darle SU vara —
// qué le hace decir "ni al caso" y qué deja pasar sin comentario— con los
// casos reales, y sacar "plano" de la lista de lo que pesa.
// js4 → js5 (2026-08-22, mismo día). js4 subió "rompe" de 22% a 44% de sus 👎
// pero las falsas alarmas graves pasaron de 7% a 25%, y al leerlas eran dos
// cosas: generalizó "café en total black" a "café con jeans negros" (que él
// aprueba siempre), y siguió marcando negro+burdeos y dejando pasar el lino en
// oficina porque REGLAS_DE_LA_CASA decía lo contrario en las dos. Se corrigió
// la fuente (las dos líneas de la casa) y aquí se dice qué defecto y qué nivel
// lleva cada caso, para que no los reclasifique a su gusto.
// js5 → js6 (2026-08-22, mismo día): js5 decía que cinturón negro con mocasín
// burdeos "es ruido". Falso: Roberto lo confirmó CINCO veces calificando al
// juez ("Agree, no va café con negro") — lo que pasa es que aprueba el look
// igual. Es "detalle", no ruido ni rompe. Y entran a la casa dos reglas nuevas
// medidas contra sus votos (negro-con-beige, mezclilla-con-saco).
// js6 → js7 (2026-08-24): LA VARA DEJA DE SER DE ROBERTO. El system llevaba
// su vara personal escrita en prosa ("traje completo en una cita: le gusta") —
// deuda dicha el día que se escribió: funcionaba mientras el comparador sólo
// juzgara su clóset, y juzgando a cualquier otra persona la vara era la
// equivocada. Lo PERSONAL ahora llega por el brief: el dial de registro por
// plan (lib/registro.ts) viaja dentro de la línea del evento, y la instrucción
// del system es leerlo y juzgar contra ÉL. Se quedan aquí sólo las
// calibraciones de la CASA (universales, medidas con votos): qué pesa un
// registro que no se habla, qué no es defecto (tonal/total black), la tasa
// base. Los umbrales finos personales (burdeos=detalle) se quedan porque son
// de mecánica de cueros, no de gusto — están también en REGLAS_DE_LA_CASA.
export const JUEZ_STYLIST_VERSION = "js7";

/** El vocabulario de defectos es el MISMO que Roberto usa al votar
 *  (DEFECTOS_MOTOR). Reusarlo es lo que hace que los hallazgos del juez y sus
 *  propias marcas se puedan contar juntos: si el juez inventara sus etiquetas,
 *  el resumen de la ronda hablaría un idioma y él otro. */
export const DEFECTOS_VALIDOS: string[] = DEFECTOS_MOTOR.map((d) => d.clave);

export type Gravedad = "rompe" | "resta" | "detalle";

export type Hallazgo = {
  /** La prenda que falla, por su nombre. "el conjunto" si es del look entero. */
  pieza: string;
  /** Qué está mal, concreto y nombrando lo que se ve. */
  problema: string;
  /** Qué cambiarías. Es la mitad que ninguna rúbrica da. */
  arreglo: string;
  /** Cuánto pesa: `rompe` tira el look, `resta` lo empeora, `detalle` es fino. */
  gravedad: Gravedad;
  /** El tema, del vocabulario de DEFECTOS_MOTOR — lo que permite agregar. */
  defecto: string;
};

export type CriticaStylist = {
  /** Qué trae puesto, en corto. Prueba de que miró (igual que el espejo). */
  resumen: string;
  /** Vacío = no hay nada que marcar. Un juez que SIEMPRE encuentra algo no
   *  sirve para priorizar: si todo está mal, nada está mal. */
  hallazgos: Hallazgo[];
  /** Lo que sí funciona, una línea. Existe para que el juez no se vuelva un
   *  martillo — pero NO es un elogio de cortesía (ver la lección del espejo). */
  loQueFunciona: string;
};

export const SYSTEM_JUEZ_STYLIST = `Eres un stylist con años de oficio revisando el trabajo de otro stylist. Te doy el PEDIDO de una persona y las FOTOS de las prendas que le eligieron. Tu trabajo NO es calificar: es decir qué está mal, en qué pieza, y qué cambiarías.

Hablas como habla un stylist con otro: directo, concreto, nombrando prendas. Nada de prosa bonita ni de puntajes.

CÓMO MIRAS
Primero el conjunto: ¿esto se lee como una decisión o como ropa que no choca? Después pieza por pieza. Juzga por lo que VES en las fotos —el tono real, la textura, el peso— no por lo que dicen los nombres. Si el nombre y la foto no coinciden, manda la foto.

QUÉ CUENTA COMO HALLAZGO
Algo que un stylist bueno señalaría en voz alta. Cada hallazgo lleva:
- pieza: la prenda que falla, por su nombre tal como te la di. Si el problema es del conjunto y no de una pieza, escribe "el conjunto".
- problema: qué está mal, concreto. "La camisa negra deja el cuello sin contraste contra el suéter marino", no "los colores no combinan".
- arreglo: qué cambiarías. UNA cosa, ejecutable. "Camisa blanca o azul claro en su lugar."
- gravedad: "rompe" si por eso solo no saldrías así; "resta" si lo empeora pero se sostiene; "detalle" si es afinar. Abajo está LA VARA DE LA PERSONA para cada nivel — úsala, no la tuya.
- defecto: UNA etiqueta de esta lista cerrada: ${DEFECTOS_MOTOR.map((d) => `${d.clave} (${d.label})`).join(", ")}.

LA VARA, Y ES LA PARTE QUE MÁS IMPORTA
La persona para la que trabajas aprueba alrededor del 85% de los looks que ve. Eso es el dato, no una forma de hablar: de 62 looks calificados a mano, aprobó 54. Si tú marcas algo en todos, no estás viendo lo que ella ve — estás inventando trabajo.

Así que la pregunta no es "¿qué le mejoraría?" sino "¿qué le diría a un colega EN VOZ ALTA?". A un look correcto no se le dice nada. La mayoría de los looks no tienen ningún hallazgo, y devolver la lista vacía es la respuesta correcta y frecuente.

Y reserva "rompe" para lo que de verdad lo tira: saldrías a detener a la persona en la puerta. Un look que se sostiene aunque mejorable NO tiene un hallazgo que rompe.

EL REGISTRO ES DE LA PERSONA, NO TUYO. Si el pedido trae "SU REGISTRO PARA ESTE PLAN", esa frase manda: lo que para la norma sería "demasiado formal" o "demasiado casual" NO es hallazgo si va en la dirección de su dial — y quedarse del lado contrario de su dial SÍ lo es. Sin esa frase, juzga contra la norma del evento y sé prudente con "demasiado formal/casual": es la llamada más personal que existe, y márcala como "detalle" salvo que el desfase sea de dos escalones.

CALIBRACIÓN DE LA CASA, medida con votos reales a ciegas. Esto se marca "rompe" con el defecto indicado, aunque a ti te parezca un detalle:
- [ocasion] Registros que no se hablan: camisa de mezclilla con blazer, saco o pantalón de vestir; camisa de vestir (popelina, cuello) debajo de una overshirt; overshirt encima de un suéter; tenis de color o deportivos con piezas de traje.
- [capas] Manga corta debajo de chamarra, bomber o chaqueta.
- [color] Zapato o cinturón NEGRO con chinos beige o caqui. Botín, cinturón o derby CAFÉ/chocolate en un look negro de arriba abajo (pantalón negro + capa negra).
- [ocasion] En boda o ceremonia: camisa negra, o traje sin corbata.
- [clima] Con 8° o menos: blazer, chaqueta ligera, softshell o bomber como ÚNICA capa exterior. Si lleva abrigo de lana o acolchado, el frío está resuelto aunque los tenis no te gusten.
- [clima] Con lluvia sin paraguas: tenis de tela o malla.
Esto es "resta", nunca "rompe":
- [ocasion] Lino en la oficina, aunque sea una sola pieza. Márcalo SIEMPRE; no lo dejes pasar.
- [capas] Demasiado abrigado o demasiadas capas para la temperatura.
- [clima] Mocasín escotado con lluvia.
Y esto NO es hallazgo — si lo marcas, es ruido; como mucho "detalle", y casi siempre nada:
- Cinturón negro con mocasines burdeos, o café con burdeos: burdeos dialoga con los dos. "Detalle" como mucho.
- Botines o cinturón café con jeans negros o con suéter vino en un look casual. Solo rompe dentro de un look negro completo.
- Tenis con abrigo de lana a 8°. Camisa de mezclilla debajo de un suéter.
- Reloj negro de caucho en oficina, diario o cita sin traje. Solo con piezas de sastre o en formal/gala es un hallazgo, y aun ahí es "detalle".
- Corbata de punto en boda: "detalle" como mucho.
- Un look "plano", "monótono" o "sin punto de atención". El tonal y el total black son decisiones de estilo, no defectos: NO es un hallazgo, salvo que su estilo declarado pida color.
- Lana o pantalón de vestir con lluvia templada; camiseta de algodón bajo un suéter "que no abriga".

LO QUE NO ES UN HALLAZGO
Gusto personal tuyo. Que no sea el look que TÚ habrías armado no lo hace un error.

Y ESTO EN PARTICULAR, que aquí YA SE MIDIÓ y resultó falso. No lo marques:
- Marino con negro combinan, incluso en formal. Se probó como regla dura y se revirtió por mito.
- Café o cuero marrón con gris y carbón es una combinación clásica y correcta.
- Un neutro cerca de la cara (marino, gris, camel, blanco, caqui, negro) está bien y no apaga a nadie.
- Vestir tonal —todo en una misma banda de color— es un recurso deliberado, no un descuido: ahí el contraste lo hace la textura.

${REGLAS_DE_LA_CASA}

Y AL REVÉS, no seas barbero. Si algo está mal, dilo aunque el resto esté bien. "loQueFunciona" es UNA línea sobre la decisión que sí está tomada — si no hay ninguna, dilo también. Nada de superlativos genéricos ni de "así como está, sale".

ORDEN: los hallazgos van de mayor a menor gravedad.`;

export const SCHEMA_JUEZ_STYLIST = {
  type: "object",
  properties: {
    resumen: { type: "string" },
    hallazgos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pieza: { type: "string" },
          problema: { type: "string" },
          arreglo: { type: "string" },
          gravedad: { type: "string", enum: ["rompe", "resta", "detalle"] },
          defecto: { type: "string", enum: [...DEFECTOS_VALIDOS] },
        },
        required: ["pieza", "problema", "arreglo", "gravedad", "defecto"],
        additionalProperties: false,
      },
    },
    loQueFunciona: { type: "string" },
  },
  required: ["resumen", "hallazgos", "loQueFunciona"],
  additionalProperties: false,
} as const;

export type LookStylist = {
  nombre: string;
  explicacion: string;
  tip?: string | null;
  prendas: { nombre: string; imagen: { mediaType: string; base64: string } | null }[];
};

const ORDEN_GRAVEDAD: Record<Gravedad, number> = { rompe: 0, resta: 1, detalle: 2 };

/**
 * Normaliza lo que devolvió el modelo. Defensivo a propósito: un hallazgo con
 * un defecto inventado rompería el conteo del resumen de ronda en silencio —
 * saldría un tema que no existe y nadie sabría de dónde salió.
 */
export function normalizarCritica(c: Partial<CriticaStylist>): CriticaStylist {
  const hallazgos = (c.hallazgos ?? [])
    .filter(
      (h): h is Hallazgo =>
        !!h?.pieza && !!h?.problema && !!h?.arreglo && DEFECTOS_VALIDOS.includes(h.defecto)
    )
    .map((h) => ({
      ...h,
      gravedad: (["rompe", "resta", "detalle"] as const).includes(h.gravedad)
        ? h.gravedad
        : ("resta" as Gravedad),
    }))
    .sort((a, b) => ORDEN_GRAVEDAD[a.gravedad] - ORDEN_GRAVEDAD[b.gravedad]);
  return {
    resumen: c.resumen ?? "",
    hallazgos,
    loQueFunciona: c.loQueFunciona ?? "",
  };
}

/** Critica un look MIRANDO las fotos de sus prendas. */
export async function criticarLook(
  brief: BriefRubrica,
  look: LookStylist,
  quien: QuienMide | null = null
): Promise<{ critica: CriticaStylist; recibo: Recibo }> {
  const conFoto = look.prendas.filter((p) => p.imagen);
  const sinFoto = look.prendas.filter((p) => !p.imagen);

  const texto = [
    `EL PEDIDO:\n${briefParaRubrica(brief)}`,
    ``,
    `EL LOOK: "${look.nombre}"`,
    conFoto.length
      ? `Las fotos van en este orden: ${conFoto.map((p) => p.nombre).join(", ")}.`
      : `Sin fotos disponibles.`,
    // Igual que en la rúbrica de visión: se dice qué NO vio, para que no dé por
    // mirado lo que sólo leyó.
    sinFoto.length
      ? `Sin foto (sólo por nombre): ${sinFoto.map((p) => p.nombre).join(", ")}.`
      : "",
    ``,
    `Lo que le dijeron a la persona: ${look.explicacion}`,
    look.tip ? `Tip de styling: ${look.tip}` : "Sin tip de styling.",
  ]
    .filter(Boolean)
    .join("\n");

  const recibo = await medir(
    quien && { ...quien, tarea: "juez-stylist", version: JUEZ_STYLIST_VERSION },
    {
      modelo: VISION_MODEL,
      system: SYSTEM_JUEZ_STYLIST,
      texto,
      imagenes: conFoto.map((p) => p.imagen!),
      schema: SCHEMA_JUEZ_STYLIST as unknown as Record<string, unknown>,
      // 1400: varios hallazgos con problema + arreglo ocupan más que seis notas
      // y una línea. Truncar aquí perdería justo los hallazgos de menor
      // gravedad, que son los que el resumen de ronda acumula.
      maxTokens: 1400,
    }
  );
  if (recibo.truncada) throw new Error("JUEZ_STYLIST_TRUNCADA");
  return { critica: normalizarCritica(parsearJson<CriticaStylist>(recibo.texto)), recibo };
}
