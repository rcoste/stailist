import { llamar, parsearJson, type Recibo } from "@/lib/proveedores";
import { MODELO_JUEZ } from "@/lib/models";
import { queSePoneA } from "./prompt";
import { lineaDressCode } from "@/lib/dress-code";

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
export const RUBRICA_VERSION = "r6";

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
  formality?: string | null;
  momento?: "dia" | "noche" | null;
  weather: { temp_c: number; condition: string } | null;
  paraguas?: boolean;
};

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
  /** 1-5: 3 = correcto pero plano; 5 = "siento que tengo un stylist". */
  wow: number;
  /** ¿Alguien que se viste bien se lo pondría TAL CUAL para este brief? */
  aprobado: boolean;
  porQue: string;
};

const FORMALIDAD: Record<string, string> = {
  casual: "casual (relajado pero cuidado)",
  semiformal: "semiformal / coctel (saco sí, corbata opcional)",
  formal:
    "formal — traje y corbata. En México esto NO es esmoquin: traje oscuro, camisa lisa y corbata. Un esmoquin aquí está SOBREVESTIDO",
  gala:
    "etiqueta rigurosa / black tie — aquí sí va el esmoquin, con moño, camisa blanca y sin cinturón",
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
  if (b.plan?.trim()) lineas.push(`Pidió, en sus palabras: "${b.plan.trim()}".`);
  if (b.formality && FORMALIDAD[b.formality])
    lineas.push(`Formalidad: ${FORMALIDAD[b.formality]}.`);
  if (b.momento === "noche") lineas.push("Momento: de noche.");
  else if (b.momento === "dia") lineas.push("Momento: de día.");
  if (b.weather) {
    lineas.push(
      `Clima: ${b.weather.temp_c}°C, ${b.weather.condition}. ${queSePoneA(b.weather.temp_c)}`
    );
    if (/lluvia|llov|chubasco|tormenta/i.test(b.weather.condition)) {
      lineas.push(
        b.paraguas
          ? "Lleva paraguas: la capa de arriba se elige por estilo (el paraguas la cubre), pero el calzado igual tiene que aguantar agua — el paraguas no tapa los pies. Fuera ante, gamuza, tela, y fuera también mocasín, náutico y sandalia (escotados y de suela fina: el agua entra aunque sean de piel). Pasan botas, botines y tenis de piel o sintético."
          : "NO lleva paraguas: la capa de arriba debe repeler agua, y el calzado también. Fuera ante, gamuza, tela, y fuera también mocasín, náutico y sandalia (escotados y de suela fina: el agua entra aunque sean de piel). Pasan botas, botines y tenis de piel o sintético."
      );
    }
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

Las cuatro dimensiones, cada una de 1 a 5:

1. ocasion — ¿el registro es el que ESTE pedido exige? No "un evento" en abstracto: si dice boda formal, se evalúa contra boda formal; si dice oficina, ir de lino completo es demasiado informal; una cena casual con amigos NO exige traje. 5 = registro exacto; 3 = pasable pero un escalón arriba o abajo; 1 = fuera de lugar.

2. clima — ¿la ropa corresponde a la temperatura y a la lluvia según lo dicho en el brief? OJO con la vara en templado (16-21°): UNA capa sobre una base ligera es NORMAL (camisa + chamarra, suéter fino + shell, blazer sobre camisa — todo eso está bien, sobre todo de noche o con lluvia). El fallo es apilar DOS piezas de abrigo (cuello tortuga de lana + abrigo de lana, suéter grueso bajo sobretodo) — eso sí es un 2. En lluvia, el calzado manda: ante, gamuza y tela son fallo, y también el mocasín, el náutico y la sandalia (escotados y de suela fina — el agua entra aunque sean de piel), aunque la chamarra sea impermeable. Botas, botines y tenis de piel o sintético pasan. 5 = clavado; 1 = rompe el clima.

3. armado — ¿el look está bien construido? Capas con lógica (una camiseta bajo el suéter cuando toca; nada de overshirt sobre suéter grueso), pesos y materiales que se hablan (no piezas de invierno con piezas de verano), cueros y colores que dialogan. 5 = todo se habla; 1 = piezas que se pelean.

4. wow — ¿se siente que hay un stylist detrás, o solo ropa que no choca? 3 = CORRECTO PERO PLANO: nada mal, nada memorable. 5 = una decisión con chispa (una mezcla que sorprende bien, una prenda usada con intención) Y un gesto de styling concreto y ejecutable (remangar dos vueltas, desfajar, dejar abierto). OJO: el tip solo suma si es un gesto físico específico — la prosa bonita sin gesto no cuenta. 1 = aburrido o incoherente.

aprobado: ¿alguien que se viste bien se lo pondría TAL CUAL para este pedido? Un fallo claro de clima, de lluvia o de ocasión lo tira aunque el resto esté bien. La duda razonable ("no sé si lino con algodón") NO lo tira.

porQue: una línea concreta, nombrando prendas — como lo diría un stylist, no un robot.`;

// La escala como enum y no como minimum/maximum: el compilador de schemas del
// API no soporta cotas numéricas en enteros (400 "not supported") — cazado en
// la primera corrida del acuerdo, donde las 136 llamadas fallaron con eso.
const ESCALA = { type: "integer", enum: [1, 2, 3, 4, 5] } as const;

export const SCHEMA_RUBRICA = {
  type: "object",
  properties: {
    analisis: { type: "string" },
    ocasion: ESCALA,
    clima: ESCALA,
    armado: ESCALA,
    wow: ESCALA,
    aprobado: { type: "boolean" },
    porQue: { type: "string" },
  },
  required: ["analisis", "ocasion", "clima", "armado", "wow", "aprobado", "porQue"],
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
    maxTokens: 700,
  });
  if (recibo.truncada) throw new Error("RUBRICA_TRUNCADA");
  return { nota: parsearJson<NotaRubrica>(recibo.texto), recibo };
}
