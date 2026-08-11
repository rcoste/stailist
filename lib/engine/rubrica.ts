import { llamar, parsearJson, type Recibo } from "@/lib/proveedores";
import { MODELO_JUEZ } from "@/lib/models";
import { queSePoneA } from "./prompt";
import { lineaDressCode } from "@/lib/dress-code";
import { lineaFormalidad } from "@/lib/formalidad";
import { lineaTipoEvento } from "@/lib/eventos";
import { hayLluvia } from "@/lib/weather";

// LA RÚBRICA: un look calificado contra su brief, por un juez automático.
//
// POR QUÉ EXISTE
// Idea de Roberto tras votar el veredicto a mano: "la rúbrica va a tardar
// demasiado viéndolo yo; definamos una de revisión para automatizarlo y hacer
// una especie de learning loop". El cuello de botella real del proyecto no es
// generar looks — es CALIFICARLOS: cada iteración de prompt esperaba a que un
// humano votara decenas de pares.
//
// DE DÓNDE SALEN LAS DIMENSIONES
// De sus 32 comentarios y 148 marcas, no de un catálogo de rúbricas:
// - "full lino a la oficina está demasiado informal" → ocasión.
// - "demasiado abrigado para el clima templado" / "mocasín en lluvia" → clima.
// - "le falta la tshirt abajo del sweater", "¿lino con algodón?" → armado.
// - su propia etiqueta "correcto pero plano" → el 3 de la escala de wow.
//
// LO QUE ESTA RÚBRICA PUEDE Y NO PUEDE DECIDIR
// Sirve para ITERAR (prompt, reglas, pool): los dos lados corren el mismo
// juez y la comparación es interna. NO sirve para coronar un MODELO: un juez
// Claude tiende a preferir looks escritos por Claude, y ese sesgo es justo el
// que corrompería un Opus-contra-Gemini. Esa decisión se queda con el voto
// ciego humano.
//
// Y la advertencia estructural: un juez contra el que se optimiza deja de
// medir. Por eso las reglas de código (reglas-ejecucion.ts) van APARTE — son
// aritmética, no opinión, y no se pueden adular — y por eso el acuerdo con
// las marcas humanas se re-mide (scripts/rubrica-acuerdo.ts) en vez de
// asumirse.
// r1 → r2: el juez r1 rechazaba CUALQUIER segunda capa a 17-18° ("demasiada
// capa para templado") — 30+ falsos rechazos sobre looks que Roberto aprobó.
// El fallo que Roberto marcó de verdad era lana GRUESA sobre lana (dos capas
// de abrigo), no una base ligera bajo una sola capa: camisa + chamarra a 18°
// es normal, cuello tortuga de merino + abrigo de lana no. El ancla se
// precisa; el criterio de lluvia NO se suaviza (ese sí es el estándar de hoy).
// r2 → r3: el estándar de lluvia se afinó con la corrida de verificación (el
// mocasín de piel se colaba). La rúbrica lo sigue: si el juez calificara con
// una vara distinta a la que el motor recibe, mediría otra cosa.
// r6 → r7: entra la dimensión ESTILO (idea de Roberto: "un juez con sombrero
// de stylist — ¿el outfit es de esa persona, considerando sus gustos y el
// estilo que buscaba?"). Hasta r6 la rúbrica calificaba a una persona ANÓNIMA:
// el motor recibía la marca de estilo y el juez no, así que ignorar los gustos
// salía gratis. La regla de la excepción también es suya: la formalidad acota
// al estilo — un boho que va de gala no tiene holgura, y no reprueba por no
// verse boho.
// r7 → r8: entra la dimensión COLOR, y con los DOS extremos a propósito.
// Roberto: "casi todo lo que me sugiere es verde esmeralda o vino — son los que
// me favorecen, pero hay colores que están bien; no un pastel ni un mostaza,
// pero sí un azul marino. No seamos estrictos forzando únicamente los que
// favorecen, permitiendo también los neutrales".
//
// Un juez que solo premiara "está en su paleta" haría al motor MÁS monótono, y
// eso ya está pasando: en la primera línea base el wow salió 3.16, la nota más
// baja de las cinco. Por eso la dimensión castiga las dos cosas: el color que
// apaga la cara Y el clóset reducido a los tres colores estrella. Favorecer es
// el piso, no el objetivo.
export const RUBRICA_VERSION = "r8";

/** El mismo contexto que recibió el motor. Un juez que califica "evento" a
 * secas tendría el mismo problema que Roberto votando: "evento es algo muy
 * ambiguo — cuando hay cosas más específicas es más fácil decir si estuvo
 * bien". */
export type BriefRubrica = {
  objective: string;
  /** Su código de vestimenta del trabajo: "oficina" son cuatro registros, no uno. */
  workDressCode?: string | null;
  /** Solo si el código es "variable": si ese día veía cliente. */
  veCliente?: boolean | null;
  plan?: string | null;
  /** QUÉ evento es (lib/eventos.ts): lo que la formalidad no captura. */
  tipoEvento?: string | null;
  formality?: string | null;
  momento?: "dia" | "noche" | null;
  weather: { temp_c: number; condition: string } | null;
  paraguas?: boolean;
  /** El estilo DECLARADO de la persona — el mismo que recibió el motor. Sin él,
   * la dimensión "estilo" queda neutra (3) y no pesa en aprobado. */
  estilo?: EstiloRubrica | null;
  /** Su colorimetría, la MISMA que recibió el motor. Sin ella, "color" queda
   * neutra (3): no se puede juzgar qué le enciende la cara sin saber su paleta. */
  color?: ColorRubrica | null;
};

/** La paleta de la persona, en los mismos tres grupos que consume el motor. */
export type ColorRubrica = {
  /** Cómo se llama su estación, para nombrarla en el análisis. */
  estacion: string | null;
  mejores: { nombre: string; hex: string }[];
  /** Los prestados de su guiño (la frontera con la estación vecina). */
  prestados: { nombre: string; hex: string }[];
  /** Los que tienden a apagarla. PREFERENCIA fuerte cerca de la cara, no veto. */
  evita: { nombre: string; hex: string }[];
};

export function tieneColor(c: ColorRubrica | null | undefined): boolean {
  return !!(c && (c.mejores.length || c.evita.length));
}

/**
 * El estilo de la persona, en las MISMAS líneas que consume el motor
 * (lib/engine/contexto.ts los pone en EngineContext): un juez que leyera otra
 * versión del estilo calificaría contra una vara que el motor nunca vio.
 */
export type EstiloRubrica = {
  /** styleReference ya traducido (lib/estilo-referencia.ts): el vibe de sus fotos. */
  marca: string | null;
  /** style_words: cómo describe su estilo en sus palabras. */
  palabras: string | null;
  /** El arquetipo destilado de sus swipes: "nombre — descripción". */
  arquetipo: string | null;
};

/** ¿El brief trae señal de estilo de verdad? (para saber si la dimensión mide algo) */
export function tieneEstilo(e: EstiloRubrica | null | undefined): boolean {
  return !!(e && (e.marca || e.palabras || e.arquetipo));
}

export type PrendaRubrica = {
  nombre: string;
  color?: string | null;
  material?: string | null;
};

export type LookRubrica = {
  nombre: string;
  explicacion: string;
  tip?: string | null;
  prendas: PrendaRubrica[];
};

export type NotaRubrica = {
  /** Borrador de razonamiento del juez (obliga a mirar antes de puntuar). */
  analisis: string;
  /** 1-5: ¿el registro es el que ESTE brief pide? */
  ocasion: number;
  /** 1-5: ¿la ropa corresponde a la banda de temperatura y a la lluvia? */
  clima: number;
  /** 1-5: capas con lógica, pesos y materiales que se hablan, colores que dialogan. */
  armado: number;
  /** 1-5: ¿el look es de ESTA persona? 3 = neutro (o sin estilo declarado). */
  estilo: number;
  /** 1-5: el color cerca de la cara Y que no sea el uniforme de siempre. */
  color: number;
  /** 1-5: 3 = correcto pero plano; 5 = "siento que tengo un stylist". */
  wow: number;
  /** ¿Alguien que se viste bien se lo pondría TAL CUAL para este brief? */
  aprobado: boolean;
  porQue: string;
};


/** El brief como lo lee el juez. Pura y exportada para poder probarla. */
export function briefParaRubrica(b: BriefRubrica): string {
  const lineas = [`Ocasión: ${b.objective}.`];
  // "Trabajo" sin su código es incalificable, y no en teoría: Roberto no pudo
  // votar un look de oficina de la corrida de verificación ("depende del tipo
  // de oficina… el look está padre pero depende"). El juez tendría el mismo
  // problema.
  if (b.objective === "oficina") {
    const dc = lineaDressCode(b.workDressCode, b.veCliente);
    lineas.push(dc || "No dijo cómo se viste para trabajar: júzgalo contra un registro de oficina neutro y no castigues por no acertarle a un código que nadie declaró.");
  }
  // El MISMO catálogo que recibe el motor: una boda y una graduación son las
  // dos "formal" y no se califican igual.
  const queEvento = lineaTipoEvento(b.tipoEvento);
  if (queEvento) lineas.push(`Es ${queEvento}.`);
  if (b.plan?.trim()) lineas.push(`Pidió, en sus palabras: "${b.plan.trim()}".`);
  // La MISMA tabla que ve la pantalla y recibe el motor (lib/formalidad.ts):
  // si el juez calificara con una vara distinta, mediría otra cosa.
  if (b.formality && lineaFormalidad(b.formality))
    lineas.push(`Formalidad: ${lineaFormalidad(b.formality)}.`);
  if (b.momento === "noche") lineas.push("Momento: de noche.");
  else if (b.momento === "dia") lineas.push("Momento: de día.");
  if (b.weather) {
    lineas.push(
      `Clima: ${b.weather.temp_c}°C, ${b.weather.condition}. ${queSePoneA(b.weather.temp_c)}`
    );
    if (hayLluvia(b.weather.condition)) {
      lineas.push(
        b.paraguas
          ? "Lleva paraguas: la capa de arriba se elige por estilo (el paraguas la cubre), pero el calzado igual tiene que aguantar agua — el paraguas no tapa los pies. Fuera ante, gamuza, tela, y fuera también mocasín, náutico y sandalia (escotados y de suela fina: el agua entra aunque sean de piel). Pasan botas, botines y tenis de piel o sintético."
          : "NO lleva paraguas: la capa de arriba debe repeler agua, y el calzado también. Fuera ante, gamuza, tela, y fuera también mocasín, náutico y sandalia (escotados y de suela fina: el agua entra aunque sean de piel). Pasan botas, botines y tenis de piel o sintético."
      );
    }
  }
  // El estilo declarado, en las MISMAS líneas que el motor recibió: la
  // dimensión "estilo" mide obediencia a esto, no al gusto del juez.
  if (tieneEstilo(b.estilo)) {
    const e = b.estilo!;
    const partes = [
      e.marca ? `Su marca de estilo: ${e.marca}` : "",
      e.palabras ? `En sus palabras: "${e.palabras}"` : "",
      e.arquetipo ? `Su arquetipo: ${e.arquetipo}` : "",
    ].filter(Boolean);
    lineas.push(`SU ESTILO (el motor lo recibió y debía honrarlo):\n${partes.join("\n")}`);
  }
  // La paleta, en los mismos tres grupos que recibe el motor. Los hex van
  // porque el look también los trae: sin ellos el juez compararía nombres de
  // color, que es justo donde dos "vino" distintos se leen igual.
  if (tieneColor(b.color)) {
    const c = b.color!;
    const lista = (xs: { nombre: string; hex: string }[]) =>
      xs.map((x) => `${x.nombre} ${x.hex}`).join(", ") || "—";
    lineas.push(
      [
        `SU COLORIMETRÍA${c.estacion ? ` (${c.estacion})` : ""}:`,
        `Le encienden la cara: ${lista(c.mejores)}`,
        c.prestados.length ? `También le sirven (su guiño): ${lista(c.prestados)}` : "",
        `Tienden a apagarla cerca de la cara: ${lista(c.evita)}`,
        `Todo lo demás —marino, gris, camel, blanco, caqui— es NEUTRAL: ni la enciende ni la apaga, y está permitido.`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return lineas.join("\n");
}

/** El look como lo lee el juez. */
export function lookParaRubrica(look: LookRubrica): string {
  const prendas = look.prendas
    .map((p) => {
      const extras = [p.color, p.material].filter(Boolean).join(", ");
      return `- ${p.nombre}${extras ? ` (${extras})` : ""}`;
    })
    .join("\n");
  return [
    `Look: "${look.nombre}"`,
    prendas,
    `Explicación al usuario: ${look.explicacion}`,
    look.tip ? `Tip de styling: ${look.tip}` : "Sin tip de styling.",
  ].join("\n");
}

export const SYSTEM_RUBRICA = `Eres el evaluador de calidad de stailist, un stylist personal con IA. Calificas UN look ya armado contra el pedido concreto de la persona. Eres exigente y específico — tu trabajo es encontrar lo que un buen stylist humano marcaría, no aprobar por cortesía.

Primero llena "analisis": qué pide este brief exactamente (registro, clima, lluvia), y qué ves en el look que cumple o rompe eso. DESPUÉS puntúa a partir de tu análisis.

Las seis dimensiones, cada una de 1 a 5:

1. ocasion — ¿el registro es el que ESTE pedido exige? No "un evento" en abstracto: si dice boda formal, se evalúa contra boda formal; si dice oficina, ir de lino completo es demasiado informal; una cena casual con amigos NO exige traje. 5 = registro exacto; 3 = pasable pero un escalón arriba o abajo; 1 = fuera de lugar.

2. clima — ¿la ropa corresponde a la temperatura y a la lluvia según lo dicho en el brief? OJO con la vara en templado (16-21°): UNA capa sobre una base ligera es NORMAL (camisa + chamarra, suéter fino + shell, blazer sobre camisa — todo eso está bien, sobre todo de noche o con lluvia). El fallo es apilar DOS piezas de abrigo (cuello tortuga de lana + abrigo de lana, suéter grueso bajo sobretodo) — eso sí es un 2. En lluvia, el calzado manda: ante, gamuza y tela son fallo, y también el mocasín, el náutico y la sandalia (escotados y de suela fina — el agua entra aunque sean de piel), aunque la chamarra sea impermeable. Botas, botines y tenis de piel o sintético pasan. 5 = clavado; 1 = rompe el clima.

3. armado — ¿el look está bien construido? Capas con lógica (una camiseta bajo el suéter cuando toca; nada de overshirt sobre suéter grueso), pesos y materiales que se hablan (no piezas de invierno con piezas de verano), cueros y colores que dialogan. 5 = todo se habla; 1 = piezas que se pelean.

4. estilo — ¿el look es de ESTA persona? Cuando el pedido trae "SU ESTILO", califica si el look lo honra: piezas, tonos y registro que se sienten de alguien con ese estilo, no de un maniquí genérico. REGLA: la formalidad ACOTA al estilo, no al revés. En casual el estilo manda — un look que lo ignora por completo es un 2. Conforme sube la formalidad, el estilo solo cabe en los detalles (color, textura, accesorio, un gesto) dentro del dress code: en formal o etiqueta NO castigues por "no verse de su estilo"; castiga solo si no hay NI UN gesto personal donde sí cabía. Si el pedido NO trae "SU ESTILO", pon 3 y no lo uses para aprobar.

5. color — el color CERCA DE LA CARA (top y abrigo; el bottom y el calzado son libres). Lee "SU COLORIMETRÍA" y aplica esta vara, que tiene DOS lados y los dos cuentan:
   - Un color de su lista de EVITA cerca de la cara: 2. Le apaga la cara. (Es preferencia fuerte, no veto: si su clóset no daba otra cosa, 3.)
   - Un NEUTRAL cerca de la cara (marino, gris, camel, blanco, caqui, negro si no está en su EVITA): 4. Perfectamente bien. NO lo castigues por no ser uno de sus colores estrella — un guardarropa de puros colores fuertes no existe.
   - Uno de sus colores (mejores o prestados) cerca de la cara: 5.
   - Y EL OTRO LADO, igual de importante: si el look repite el MISMO color estrella que ya es su default obvio y no hay ninguna otra decisión de color en todo el conjunto, BAJA a 3 aunque el color le favorezca. Un motor que resuelve todo con sus dos o tres colores seguros no está aplicando colorimetría, está usando un uniforme. Favorecer es el piso, no el objetivo.
   Sin "SU COLORIMETRÍA" en el pedido, pon 3 y no la uses para aprobar.

6. wow — ¿se siente que hay un stylist detrás, o solo ropa que no choca? 3 = CORRECTO PERO PLANO: nada mal, nada memorable. 5 = una decisión con chispa (una mezcla que sorprende bien, una prenda usada con intención) Y un gesto de styling concreto y ejecutable (remangar dos vueltas, desfajar, dejar abierto). OJO: el tip solo suma si es un gesto físico específico — la prosa bonita sin gesto no cuenta. 1 = aburrido o incoherente.

aprobado: ¿alguien que se viste bien se lo pondría TAL CUAL para este pedido? Un fallo claro de clima, de lluvia o de ocasión lo tira aunque el resto esté bien. Ignorar por completo el estilo declarado en un pedido casual también lo tira; en formal o etiqueta, no. La duda razonable ("no sé si lino con algodón") NO lo tira. Y OJO: un color neutral cerca de la cara NO tira nada, ni tampoco repetir un color favorecedor — eso baja la nota de color, no reprueba el look.

porQue: una línea concreta, nombrando prendas — como lo diría un stylist, no un robot.`;

// LA ESCALA, en el mínimo común denominador de los proveedores.
//
// Cada uno rechaza una forma distinta y las dos se descubrieron corriendo:
// Anthropic no acepta `minimum`/`maximum` en enteros (400 "not supported"),
// y Gemini no acepta `enum` de enteros (400 "TYPE_STRING"). Queda el entero
// pelón: el rango vive en el prompt y se comprueba al leer, que es donde una
// validación de verdad puede hacer algo.
const ESCALA = { type: "integer", description: "de 1 a 5" } as const;

/** Acota una nota al 1-5 por si el modelo se sale. */
const enEscala = (n: unknown): number =>
  Math.min(5, Math.max(1, Math.round(Number(n) || 3)));

/** Normaliza lo que devuelve cualquier proveedor a una nota válida. */
export function normalizarNota(raw: NotaRubrica): NotaRubrica {
  return {
    ...raw,
    ocasion: enEscala(raw.ocasion),
    clima: enEscala(raw.clima),
    armado: enEscala(raw.armado),
    estilo: enEscala(raw.estilo),
    color: enEscala(raw.color),
    wow: enEscala(raw.wow),
    aprobado: raw.aprobado === true,
  };
}

export const SCHEMA_RUBRICA = {
  type: "object",
  properties: {
    analisis: { type: "string" },
    ocasion: ESCALA,
    clima: ESCALA,
    armado: ESCALA,
    estilo: ESCALA,
    color: ESCALA,
    wow: ESCALA,
    aprobado: { type: "boolean" },
    porQue: { type: "string" },
  },
  required: [
    "analisis",
    "ocasion",
    "clima",
    "armado",
    "estilo",
    "color",
    "wow",
    "aprobado",
    "porQue",
  ],
  additionalProperties: false,
} as const;

/**
 * Califica un look. El juez es FIJO (MODELO_JUEZ): la rúbrica compara looks
 * entre sí, y dos jueces distintos harían incomparables dos corridas.
 */
export async function evaluarLook(
  brief: BriefRubrica,
  look: LookRubrica
): Promise<{ nota: NotaRubrica; recibo: Recibo }> {
  const recibo = await llamar({
    modelo: MODELO_JUEZ,
    system: SYSTEM_RUBRICA,
    texto: `EL PEDIDO:\n${briefParaRubrica(brief)}\n\nEL LOOK A CALIFICAR:\n${lookParaRubrica(look)}`,
    schema: SCHEMA_RUBRICA as unknown as Record<string, unknown>,
    // 900 y no 700: con la dimensión de estilo (r7) el "analisis" creció y la
    // primera corrida del eval trajo un RUBRICA_TRUNCADA real. Truncar sale
    // más caro que el margen — se pagó la llamada entera y no quedó nota.
    maxTokens: 900,
  });
  if (recibo.truncada) throw new Error("RUBRICA_TRUNCADA");
  return { nota: normalizarNota(parsearJson<NotaRubrica>(recibo.texto)), recibo };
}
