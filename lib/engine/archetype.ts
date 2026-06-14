import Anthropic from "@anthropic-ai/sdk";
import type { Look } from "@/lib/looks";

export type StyleArchetype = {
  nombre: string;
  descripcion: string;
};

// A partir de los looks que le encantaron a la persona, sintetiza un arquetipo
// de estilo nombrado (en voz amiga cool). Se le revela y entra al motor.
export async function generateArchetype(
  likedLooks: Look[]
): Promise<StyleArchetype> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");

  const client = new Anthropic();
  const resumen = likedLooks
    .map((l) => `- ${l.nombre} (${l.vibe}) · ${l.tags.join(", ")}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 512,
    system: `Eres la stylist de stailist, la amiga cool que se viste increíble. A partir de los looks que le encantaron a alguien, le pones nombre a su estilo.

- nombre: 2-3 palabras con personalidad ("Minimalista cálido", "Clásico relajado", "Atrevida con raíz"). Sin género gramatical forzado.
- descripcion: UNA línea cálida que la haga sentirse vista. Tuteo, cero jerga técnica de moda. Ej: "te van las cosas simples pero con un twist que se nota".`,
    messages: [
      {
        role: "user",
        content: `Looks que le encantaron:\n${resumen}\n\nPonle nombre a su estilo.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            descripcion: { type: "string" },
          },
          required: ["nombre", "descripcion"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as StyleArchetype;
  if (!parsed.nombre || !parsed.descripcion) throw new Error("BAD_ARCHETYPE");
  return parsed;
}
