import { ENGINE_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import type { Look } from "@/lib/looks";
import type { Gender } from "@/lib/auth";

export type StyleArchetype = {
  nombre: string;
  descripcion: string;
};

// Concordancia gramatical por género. Sin esto el LLM tira a femenino por
// defecto (los ejemplos de la voz lo arrastran) y a un hombre le sale "te hace
// única". Le pasamos el género del perfil y se lo instruimos explícito, en
// nombre Y descripción.
function genderGuidance(gender: Gender | null): string {
  if (gender === "hombre") {
    return `El usuario es HOMBRE. Concordancia gramatical MASCULINA en TODO (nombre y descripción): "único", "relajado", "atrevido", "visto". Ejemplos de nombre: "Minimalista cálido", "Clásico relajado", "Atrevido con raíz". CERO adjetivos en femenino.`;
  }
  if (gender === "mujer") {
    return `La usuaria es MUJER. Concordancia gramatical FEMENINA en TODO (nombre y descripción): "única", "relajada", "atrevida", "vista". Ejemplos de nombre: "Minimalista cálida", "Clásica relajada", "Atrevida con raíz". CERO adjetivos en masculino.`;
  }
  return `No sabes el género. EVITA adjetivos con género gramatical (ni masculino ni femenino): usa sustantivos y frases neutras ("te van las cosas simples con un twist que se nota"). Nada de "único/única" ni "visto/vista".`;
}

// A partir de los looks que le encantaron a la persona, sintetiza un arquetipo
// de estilo nombrado (en voz amiga cool). Se le revela y entra al motor.
// `gender` viene del perfil (género se elige antes de los gustos) y blinda la
// concordancia gramatical del nombre y la descripción.
export async function generateArchetype(
  likedLooks: Look[],
  gender: Gender | null = null,
  // Orientación por edad (life-stage), señal suave — evita bautizar a una
  // adolescente con un arquetipo "de oficina" o a una señora con slang teen.
  ageNote: string | null = null
): Promise<StyleArchetype> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");

  const client = new Anthropic();
  const resumen = likedLooks
    .map((l) => `- ${l.nombre} (${l.vibe}) · ${l.tags.join(", ")}`)
    .join("\n");

  const response = await client.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 512,
    system: `Eres la stylist de stailist, la amiga cool que se viste increíble. A partir de los looks que le encantaron a alguien, le pones nombre a su estilo.

- nombre: 2-3 palabras con personalidad.
- descripcion: UNA línea cálida que lo/la haga sentirse visto/a. Tuteo, cero jerga técnica de moda. Ej: "te van las cosas simples pero con un twist que se nota".

CONCORDANCIA DE GÉNERO (crítico, respétalo en nombre Y descripción): ${genderGuidance(gender)}${ageNote ? `\n\n${ageNote} Que el nombre y la descripción le hablen a alguien de su etapa de vida.` : ""}`,
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
