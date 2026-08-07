import { GUARD_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import { describeItem, type EngineItem } from "./prompt";

// Chequeo ligero (Haiku) de si la prenda anclada va con la ocasión. NO bloquea
// el estilismo: el ancla manda casi siempre; solo cazamos mismatches obvios
// (traje de baño para una boda) para no hacer ver tonta a la IA. Fail-open: si
// no hay key o algo truena, devolvemos fits=true (nunca estorbamos al usuario).

export type AnchorFit = { fits: boolean; note: string };

const FIT_MODEL = GUARD_MODEL;

const FIT_SYSTEM = `Eres la stylist de stailist. La clienta quiere usar HOY una prenda específica para una ocasión. Tu único trabajo: decir si esa prenda es razonable para esa ocasión.

Reglas:
- fits=true para casi todo. El ancla manda y la gente se viste como quiere. Ante la MÍNIMA duda, true.
- fits=false SOLO en mismatches obvios e indiscutibles (ej. traje de baño para una boda, pijama para la oficina, botas de nieve para la playa). No seas exigente con estilo o formalidad fina; eso lo resuelve el outfit alrededor.
- Si fits=false, "nota" es UNA frase cálida de amiga (tuteo, cero jerga) que diga por qué no va y proponga algo, ej: "un traje de baño no es lo más para una boda — ¿lo dejamos para la playa?". Si fits=true, "nota" en cadena vacía.`;

const FIT_SCHEMA = {
  type: "object" as const,
  properties: {
    fits: {
      type: "boolean",
      description: "¿La prenda es razonable para la ocasión? true salvo mismatch obvio.",
    },
    nota: {
      type: "string",
      description: "Si fits=false, una frase cálida del por qué no va. Vacía si fits=true.",
    },
  },
  required: ["fits", "nota"],
  additionalProperties: false,
};

export async function checkAnchorFit(
  item: EngineItem,
  occasion: string,
  weatherLine: string | null
): Promise<AnchorFit> {
  if (!process.env.ANTHROPIC_API_KEY) return { fits: true, note: "" };
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: FIT_MODEL,
      max_tokens: 220,
      // Thinking OFF: en los modelos 5 viene ON por default y se come el
      // presupuesto de salida (ver capsule-match.ts — ahí dejó la pantalla de
      // esenciales muerta). El schema ya obliga a razonar en un campo antes de
      // comprometer la respuesta, que es la misma idea dentro del presupuesto.
        thinking: { type: "disabled" },
      system: FIT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Prenda: ${describeItem(item)}\nOcasión: ${occasion}${
            weatherLine ? `\nClima: ${weatherLine}` : ""
          }`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: FIT_SCHEMA },
      },
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return { fits: true, note: "" };
    const parsed = JSON.parse(text) as { fits?: boolean; nota?: string };
    // fail-open: solo bloquea con un false explícito.
    return { fits: parsed.fits !== false, note: (parsed.nota ?? "").trim() };
  } catch {
    return { fits: true, note: "" };
  }
}
