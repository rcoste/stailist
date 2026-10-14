import { CLASSIFY_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import type { CapsuleItem, ClosetItemLite } from "@/lib/capsule";
import { medirAnthropic, type QuienMide } from "@/lib/recibos";
import { NOMBRE_FUNCION, funcionDe, sirveComoSustituto } from "@/lib/funcion-prenda";
import { claseAccesorio, claseBottom, contextosCompatibles } from "@/lib/engine/capsule-match";

/**
 * Lo que la IA puede ver como sustituto: misma categoría y misma función
 * (lib/funcion-prenda.ts), y además las tres clases finas que el match ya
 * vigila — largo de pierna (un short no es un pantalón), clase de accesorio
 * (unas medias no son un cinturón) y contexto de uso (baño/gimnasio, con el
 * atributo guardado de la prenda si lo tiene). Largo y accesorio, como en el
 * match: si una de las dos no se reconoce, no bloquea.
 */
export function candidatasPosibles<T extends { nombre: string; category: string; contexto?: string | null }>(
  missing: Pick<CapsuleItem, "nombre" | "tipo" | "category">,
  closet: T[]
): T[] {
  const ideal = `${missing.nombre} ${missing.tipo}`;
  const choca = (f: (t: string) => string | null, real: string) => {
    const a = f(ideal);
    const b = f(real);
    return !!a && !!b && a !== b;
  };
  return closet.filter(
    (c) =>
      sirveComoSustituto(missing, c) &&
      !(missing.category === "bottom" && choca(claseBottom, c.nombre)) &&
      !(missing.category === "accesorio" && choca(claseAccesorio, c.nombre)) &&
      contextosCompatibles(ideal, c.nombre, c.contexto)
  );
}

// "Buscar en mi clóset": dada UNA prenda que falta para el viaje, propone hasta 3
// prendas del clóset real que pueden SUSTITUIRLA (misma clase, uso compatible) —
// para no tener que comprar. Mismo criterio de clase que el match de cápsula: la
// CLASE manda; el color/formalidad solo desempata. Vacío si nada sirve de verdad.
// `rejected`: la prenda del clóset que HOY cubre el hueco pero no le late (swap
// "no me convence") — el motor propone alternativas con otro aire, no más de lo mismo.
export async function matchSubstitutes(
  missing: CapsuleItem,
  closet: ClosetItemLite[],
  gender: "hombre" | "mujer" | null = null,
  rejected: string | null = null,
  /** Quién paga la llamada: deja su recibo en ai_calls (lib/recibos.ts). null = sin sesión (scripts). */
  quien: QuienMide | null = null,
  /** Por qué no le convenció la anterior ("no es práctico para caminar: …"). */
  motivo: string | null = null
): Promise<{ nombre: string; porque: string }[]> {
  // LA REGLA DURA VA EN CÓDIGO, ANTES de la IA (lib/funcion-prenda.ts): misma
  // categoría y, si la pieza tiene una función (lluvia, nadar, frío extremo),
  // la misma función. El prompt ya prohibía cruzar clases y la IA ofreció un
  // blazer para un trench impermeable. Lo que no pasa aquí, la IA ni lo ve; y
  // si nada pasa, no se paga la llamada.
  closet = candidatasPosibles(missing, closet);
  if (closet.length === 0 || !process.env.ANTHROPIC_API_KEY) return [];
  const funcion = funcionDe(`${missing.tipo} ${missing.nombre}`);

  // maxRetries alto: la búsqueda es a-demanda y el usuario espera, así que vale
  // la pena aguantar un saturón breve de la API (529) con backoff antes de fallar.
  const client = new Anthropic({ maxRetries: 4 });
  const closetTxt = closet
    .map((c) => `- ${c.nombre} (${c.category}, ${c.formalidad}, ${c.color})`)
    .join("\n");
  const generoTxt =
    gender === "hombre"
      ? " La persona es hombre."
      : gender === "mujer"
        ? " La persona es mujer."
        : "";

  const res = await medirAnthropic(quien && { ...quien, tarea: "viaje-sustitutos" }, CLASSIFY_MODEL, () =>
    client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 700,
    // Thinking OFF: en los modelos 5 viene ON por default y se come el
    // presupuesto de salida (ver capsule-match.ts — ahí dejó la pantalla de
    // esenciales muerta). Estas tareas tienen sus reglas en el system.
    thinking: { type: "disabled" },
    system: `Eres la stylist de stailist.${generoTxt} Falta UNA prenda para un viaje y la persona NO quiere comprar: quiere resolverlo con lo que YA tiene. Te doy la prenda que falta y su CLÓSET REAL. Propón hasta 3 prendas del clóset que de verdad puedan SUSTITUIRLA, la mejor primero.

REGLAS:
- La CLASE manda por encima de todo: solo sirve algo de la MISMA clase/categoría que lo que falta (un pantalón lo sustituye otro pantalón; un calzado, otro calzado; un top, otro top del mismo tipo de uso). NUNCA cruces clases.
- Debe ser un sustituto USABLE para esa ocasión y clima, no cualquier cosa de la categoría. Un sustituto razonable, aunque no idéntico (otro neutro, un corte parecido), cuenta.
- Solo prendas que están en el CLÓSET, con su nombre EXACTO. No inventes.
- Si la prenda que falta cumple una FUNCIÓN (protegerse de la lluvia, nadar, aguantar frío extremo), el sustituto tiene que cumplir esa misma función de verdad, no sólo parecerse.
- Si NADA del clóset sirve de verdad, devuelve lista vacía. Mejor vacío que un sustituto malo.
- "porque": media línea cálida (tuteo) de por qué funciona como reemplazo.`,
    messages: [
      {
        role: "user",
        content: `FALTA: ${missing.nombre} (tipo: ${missing.tipo}, ${missing.category}, ${missing.formalidad}, ${missing.colorFamilia}). Para: ${missing.porque}${funcion ? `\nFUNCIÓN QUE TIENE QUE CUMPLIR: ${NOMBRE_FUNCION[funcion]}.` : ""}${
          rejected
            ? `\n\nOJO: para este hueco tenía "${rejected}" pero NO le late — proponle opciones distintas, con otro aire (no la incluyas ni propongas casi lo mismo).`
            : ""
        }${
          motivo?.trim()
            ? `\nPOR QUÉ NO LE CONVENCIÓ: ${motivo.trim().slice(0, 300)}. Lo que propongas tiene que resolver eso.`
            : ""
        }\n\nCLÓSET REAL:\n${closetTxt}\n\n¿Con qué del clóset lo resuelvo?`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            sustitutos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre: { type: "string" },
                  porque: { type: "string" },
                },
                required: ["nombre", "porque"],
                additionalProperties: false,
              },
            },
          },
          required: ["sustitutos"],
          additionalProperties: false,
        },
      },
    },
  })
  );

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return [];
  try {
    const parsed = JSON.parse(block.text) as {
      sustitutos?: { nombre?: string; porque?: string }[];
    };
    const valid = new Set(closet.map((c) => c.nombre));
    return (parsed.sustitutos ?? [])
      .filter((s) => s.nombre && valid.has(s.nombre))
      .slice(0, 3)
      .map((s) => ({ nombre: s.nombre as string, porque: (s.porque ?? "").trim() }));
  } catch {
    return [];
  }
}
