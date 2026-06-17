import Anthropic from "@anthropic-ai/sdk";
import {
  ASSESSMENT_QUESTIONS,
  CATEGORIES,
  FORMALIDADES,
  type CapsuleItem,
  type CapsuleTarget,
  type LifestyleAnswers,
} from "@/lib/capsule";
import { SEASONS, seasonPalette, type Season } from "@/lib/colorimetria";

export type CapsuleInputs = {
  answers: LifestyleAnswers;
  gender: "hombre" | "mujer" | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
};

// CAPA 1 — la cápsula IDEAL: una lista de prendas concretas y nombradas que
// ESA persona debería tener, mezclando lo que su vida exige con quién es cuando
// elige, y aterrizada a su paleta de color. Libre del catálogo (puede pedir
// prendas que no tenemos). Se llama una vez al guardar/editar el assessment.
export async function generateCapsuleTarget(
  inputs: CapsuleInputs
): Promise<CapsuleTarget> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");

  const client = new Anthropic();

  const vida = ASSESSMENT_QUESTIONS.map((q) => {
    const opt = q.options.find((o) => o.value === inputs.answers[q.id]);
    return opt ? `- ${q.label} → ${opt.label}` : null;
  })
    .filter(Boolean)
    .join("\n");

  let paletaTxt = "No definida (usa neutros versátiles).";
  if (inputs.season) {
    const { mejores, prestados, evita } = seasonPalette(inputs.season, inputs.flow);
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    const avoid = evita.map((c) => c.nombre).join(", ");
    paletaTxt = `Paleta ${SEASONS[inputs.season].label}. Le favorecen: ${favs}. EVITA: ${avoid}.`;
  }

  const estilo = inputs.archetype
    ? `"${inputs.archetype.nombre}" — ${inputs.archetype.descripcion}`
    : "sin definir";
  const tags = inputs.tasteTags.length ? inputs.tasteTags.join(", ") : "sin tags";
  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: TODA la cápsula es ropa de hombre. Jamás propongas prendas de mujer (faldas, vestidos, blusas, tacones, etc.)."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: TODA la cápsula es ropa de mujer. Jamás propongas prendas pensadas solo para hombre."
        : "Género no definido: usa prendas neutras/unisex.";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `Eres la stylist de stailist. Defines el CLÓSET CÁPSULA IDEAL de una persona: la lista de prendas concretas que debería tener para vivir bien vestida, partiendo de cero (sin mirar lo que ya tiene).

REGLA INNEGOCIABLE DE GÉNERO: ${generoTxt}

Combina tres cosas:
1. Su VIDA: qué exige su día a día (ej. abogado en despacho → necesita trajes/formal entre semana) y sus eventos.
2. Su ESTILO cuando elige (ej. le va lo hipster el finde) — la cápsula cubre AMBOS lados de la persona.
3. Su COLORIMETRÍA: nombra colores de su paleta; nunca pongas un color de su lista de EVITA.

Devuelve "items": ~12 a 18 prendas concretas. Cada una:
- nombre: etiqueta humana y específica, con color. Ej: "Cuello tortuga azul marino", "Chukka de ante café", "Blazer gris Oxford".
- tipo: la prenda en clave corta y normalizada, sin color. Ej: "cuello-tortuga", "chukka", "blazer", "jeans", "camisa-oxford".
- category ∈ {${CATEGORIES.join(", ")}}
- colorFamilia: el color en familia simple ("marino", "gris", "café", "blanco", "camel"…), dentro de su paleta.
- formalidad ∈ {${FORMALIDADES.join(", ")}}
- temporada: "todo-el-año" | "calor" | "frio".
- prioridad: 1 = imprescindible (la usaría casi diario), subiendo a menos esenciales. Ordena con criterio.
- porque: UNA línea cálida de por qué la necesita (tuteo, voz amiga).

Reglas:
- Piezas reales y combinables, no aspiracionales raras. Una cápsula que de verdad rinde.
- Incluye abrigos SOLO si su clima es frío o templado.
- No incluyas ropa deportiva/gym (la cápsula es ropa de vestir).
- Prioriza lo versátil y los básicos primero; los caprichos al final.`,
    messages: [
      {
        role: "user",
        content: `VIDA:\n${vida}\n\nESTILO: ${estilo}\nTags de gusto: ${tags}\nCOLORIMETRÍA: ${paletaTxt}\n\nDefine su cápsula ideal (items).`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre: { type: "string" },
                  tipo: { type: "string" },
                  category: { type: "string", enum: [...CATEGORIES] },
                  colorFamilia: { type: "string" },
                  formalidad: { type: "string", enum: [...FORMALIDADES] },
                  temporada: { type: "string" },
                  // sin minimum/maximum: el structured output no los soporta.
                  prioridad: { type: "integer" },
                  porque: { type: "string" },
                },
                required: [
                  "nombre",
                  "tipo",
                  "category",
                  "colorFamilia",
                  "formalidad",
                  "temporada",
                  "prioridad",
                  "porque",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as { items: CapsuleItem[] };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("BAD_CAPSULE_TARGET");
  }
  // Re-ranking limpio 1..n por la prioridad que sugirió el modelo (estable).
  const items = parsed.items
    .slice()
    .sort((a, b) => a.prioridad - b.prioridad)
    .map((it, i) => ({ ...it, prioridad: i + 1 }));
  return { version: 2, items };
}
