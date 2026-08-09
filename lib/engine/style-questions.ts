import { CLASSIFY_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import type { AssessmentQuestion } from "@/lib/capsule";
import type { Gender } from "@/lib/auth";

export type StyleQuestionsInput = {
  archetype: { nombre: string; descripcion: string } | null;
  tasteTags: string[];
  gender: Gender | null;
  paletaLabel: string | null; // ej. "Invierno profundo"
  siluetaLabel: string | null; // ej. "media · carga arriba"
  edadLabel?: string | null; // ej. "13 a 17" — contexto de life-stage para preguntar mejor
};

// Genera 2-3 preguntas de opción múltiple PERSONALIZADAS al estilo ya conocido del
// usuario (arquetipo + gustos), para afinar su cápsula sin re-preguntar lo genérico.
// El Opus da label/help/opciones; aquí asignamos ids/values estables (sq_*/o*).
export async function generateStyleQuestions(
  input: StyleQuestionsInput
): Promise<AssessmentQuestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");
  if (!input.archetype) return []; // sin arquetipo no hay de qué partir
  const client = new Anthropic();

  const ctx = [
    `Estilo (arquetipo): "${input.archetype.nombre}" — ${input.archetype.descripcion}`,
    input.tasteTags.length ? `Gustos: ${input.tasteTags.join(", ")}` : null,
    input.paletaLabel ? `Colorimetría: ${input.paletaLabel}` : null,
    input.siluetaLabel ? `Silueta: ${input.siluetaLabel}` : null,
    input.edadLabel ? `Edad: ${input.edadLabel} años` : null,
    `Género: ${input.gender ?? "no definido"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 1500,
    // Thinking OFF: en los modelos 5 viene ON por default y se come el
    // presupuesto de salida (ver capsule-match.ts — ahí dejó la pantalla de
    // esenciales muerta). Estas tareas tienen sus reglas en el system.
    thinking: { type: "disabled" },
    system: `Eres la stylist senior de stailist. Ya CONOCES el estilo de esta persona (abajo). Tu trabajo: hacer 2-3 preguntas de opción múltiple HECHAS A LA MEDIDA de SU estilo, para afinar su clóset cápsula. Nada genérico ni que ya sepamos.

REGLAS:
- Cada pregunta PROFUNDIZA en una decisión real de SU estilo (qué prendas le atraen, cuánto quiere destacar vs pasar desapercibida, ropa cómoda vs arreglada, etc.) — pero SIEMPRE dicha en palabras de todos los días.
- Específicas a SU arquetipo, pero TRADUCIDAS a ejemplos concretos: a un "minimalista" (¿una playera lisa o una con un detalle?), a un "streetwear" (¿sudaderas holgadas o algo más ajustado?), a un "clásico" (¿camisa o algo más relajado?). Los ejemplos son prendas que CUALQUIERA reconoce, no conceptos de moda.
- LENGUAJE (crítico — la marca es "cero jerga de moda"): escribe para alguien que NO sabe de moda y a quien le cuesta vestirse. PROHIBIDO: "silueta", "cortes", "tejidos", "textura", "satinado", "statement", "monocromía", "oversized", "proporción", "volumen", "paleta". Tradúcelo: "textura satinada" → "algo que brilla un poquito"; "jugar con cortes"/"todo en la silueta" → "ropa sencilla que quede bien"; "un statement" → "una pieza que llame la atención". Ante la duda, NOMBRA una prenda concreta (una chamarra de cuero, unos tenis blancos, un suéter). Voz amiga cool, tuteo. Opciones cortas y concretas (3-4 por pregunta).
- "multi": true solo si de verdad puede aplicar más de una; si no, false.
- NO repitas lo que ya se pregunta aparte: vida/trabajo, clima, formalidad de eventos, fit general. Aquí SOLO matiz fino de estilo.
- PROHIBIDO PREGUNTAR POR COLOR, en cualquier forma: ni qué colores le gustan, ni cuánto color quiere meterle, ni neutros vs color, ni qué acentos, ni "dentro de tu paleta cuál prefieres". El color YA se resuelve entero en su propio paso (colorimetría), y volver a preguntarlo aquí no sólo sobra: la respuesta puede contradecir a la paleta y dejar a la app discutiendo consigo misma. Medido el 2026-08-09 sobre 4 perfiles reales: 9 de 12 preguntas generadas eran de color. La paleta que te doy arriba es CONTEXTO para no proponer prendas que la apaguen — no es un tema del que preguntar.
- CLAVE: la persona quizá NO sepa vestirse o no tenga claro su estilo (por eso usa la app). Pregunta por lo que le ATRAE / le gustaría, NO por lo que "ya hace" o "cómo se viste" — no asumas experiencia. Opciones concretas y visuales (que se imagine la prenda). Distingue: el estilo que le GUSTA ≠ cómo se viste hoy.
- La app añade sola una opción "Aún no lo sé — sorpréndeme" a cada pregunta; NO la incluyas tú.
- Concordancia de género correcta.

Devuelve "questions": cada una con "label" (la pregunta), "help" (≤1 línea; "" si no aplica), "multi" (bool) y "options" (cada una con "label" corto y "hint" ≤1 línea; "" si no aplica).`,
    messages: [
      { role: "user", content: `${ctx}\n\nGenera 2-3 preguntas para afinar SU cápsula.` },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  help: { type: "string" },
                  multi: { type: "boolean" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        hint: { type: "string" },
                      },
                      required: ["label", "hint"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["label", "help", "multi", "options"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as {
    questions: {
      label: string;
      help?: string;
      multi?: boolean;
      options: { label: string; hint?: string }[];
    }[];
  };

  // ids/values estables (sq_N / oN); descarta preguntas mal formadas.
  return (parsed.questions ?? [])
    .filter((q) => q.label && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, 3)
    .map((q, i) => ({
      id: `sq_${i + 1}`,
      label: q.label.trim(),
      help: q.help?.trim() || undefined,
      multi: !!q.multi,
      options: [
        ...q.options.slice(0, 5).map((o, j) => ({
          value: `o${j + 1}`,
          label: o.label.trim(),
          hint: o.hint?.trim() || undefined,
        })),
        // Escape para quien aún no sabe su estilo / cómo se viste: siempre presente.
        { value: "ns", label: "Aún no lo sé — sorpréndeme", exclusive: true },
      ],
    }));
}
