import { type Modelo } from "@/lib/proveedores";
import { medir, type QuienMide } from "@/lib/recibos";

// ¿CUÁNTAS PERSONAS SALEN EN LA FOTO?
//
// EL HUECO QUE CIERRA: el lector de varias prendas mira la foto y lista TODA la
// ropa que ve. Si subes una foto donde sales con alguien más, lista la ropa de
// los dos y te ofrece la camisa de tu amigo como tuya. Lo único que lo tapaba
// era que lo notaras — o que hubieras recortado antes, y el recorte era una
// pregunta genérica en todas las fotos ("¿sale alguien más en alguna?"), que es
// justo la clase de aviso que se aprende a ignorar porque siempre está.
//
// El "no es mía" del final sí lo caza, pero para entonces ya se generó (y se
// pagó) el render de la ropa de otra persona.
//
// POR QUÉ ES UNA LLAMADA APARTE, y no un campo del schema de lectura: medido
// esta mañana sobre 425 prendas releídas con control de ruido, añadir un campo
// al schema del lector movía OTRAS lecturas con z = 3.05 — y seguía moviéndolas
// aunque no se tocara una palabra del prompt: era el schema en sí. Preguntando
// aparte, el lector queda byte a byte como estaba y la deriva es cero por
// construcción. En flash-lite esta llamada es ruido en la factura.
//
// POR QUÉ NO ES RECONOCIMIENTO FACIAL, que es como nació la idea: contar no es
// identificar. Aquí no se compara ninguna cara con ninguna otra, no se guarda
// nada de la foto, y las caras de la gente que sale contigo —que nunca dio
// permiso para nada— no se analizan. Quién eres de las dos lo dices tú
// recortando, que además acierta el 100% de las veces.
//
// MEDIDO ANTES DE CONFIAR EN ÉL (scripts/personas-en-foto.ts, 3 corridas por
// caso, 2026-08-08): 15/15 en la decisión de avisar y 15/15 en el conteo
// exacto, sobre prendas extendidas, una persona, dos y tres.
//
// Y un caso se ganó el lugar por equivocarme yo: el primer banco de prueba
// pegaba dos fotos de la MISMA modelo con outfits distintos, el modelo contestó
// "1" tres de tres veces y lo conté como fallo. No lo era — es una persona,
// fotografiada dos veces. Ese caso se quedó fijo porque es exactamente el
// selfie de espejo y la rejilla de outfits, donde avisar sería avisar de más y
// el aviso se gastaría solo.

const SYSTEM_PERSONAS =
  "Miras una foto y contestas UNA cosa: cuántas PERSONAS REALES se ven en ella. Cuenta a cualquiera que aparezca, aunque salga de espaldas, cortado, de perfil o al fondo. NO cuentes: maniquíes, muñecos, personas dentro de un cuadro o un póster colgado en la pared, ni una misma persona reflejada en un espejo (si alguien se toma una foto frente al espejo, es UNA persona, no dos). Si la foto es sólo de ropa —extendida en la cama, colgada, doblada, apilada— la respuesta es 0.";

const SCHEMA_PERSONAS = {
  type: "object",
  properties: { personas: { type: "integer" } },
  required: ["personas"],
  additionalProperties: false,
} as Record<string, unknown>;

/**
 * Cuántas personas hay en la foto. Falla hacia 0: sin dato, no se avisa.
 *
 * Fallar hacia 0 y no hacia 2 es deliberado. Un aviso de más en una foto donde
 * sales sola cuesta credibilidad —y este aviso sólo sirve si se le cree—;
 * un aviso de menos deja las cosas exactamente como estaban antes de que esto
 * existiera. Que la ayuda falle no puede estorbar la carga.
 */
export async function contarPersonas(
  imagen: { mediaType: string; base64: string },
  modelo: Modelo,
  /** De quién es la foto. `null` = script (scripts/personas-en-foto.ts). */
  quien: QuienMide | null = null
): Promise<number> {
  try {
    // El fallo se registra aunque aquí se trague: `medir` lo anota ANTES de
    // relanzar, y el catch de abajo devuelve 0 como siempre. Justo en una
    // función que falla hacia adelante importa el doble — si se rompiera del
    // todo, la única señal sería que el aviso dejó de salir.
    const recibo = await medir(quien && { ...quien, tarea: "vision-personas" }, {
      modelo,
      maxTokens: 40,
      system: SYSTEM_PERSONAS,
      texto: "¿Cuántas personas se ven en esta foto?",
      imagen,
      schema: SCHEMA_PERSONAS,
    });
    const n = (JSON.parse(recibo.texto) as { personas?: unknown }).personas;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
