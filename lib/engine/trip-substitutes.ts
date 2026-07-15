import Anthropic from "@anthropic-ai/sdk";
import type { CapsuleItem, ClosetItemLite } from "@/lib/capsule";

// "Buscar en mi clóset": dada UNA prenda que falta para el viaje, propone hasta 3
// prendas del clóset real que pueden SUSTITUIRLA (misma clase, uso compatible) —
// para no tener que comprar. Mismo criterio de clase que el match de cápsula: la
// CLASE manda; el color/formalidad solo desempata. Vacío si nada sirve de verdad.
// `rejected`: la prenda del clóset que HOY cubre el hueco pero no le late (swap
// "no me late") — el motor propone alternativas con otro aire, no más de lo mismo.
export async function matchSubstitutes(
  missing: CapsuleItem,
  closet: ClosetItemLite[],
  gender: "hombre" | "mujer" | null = null,
  rejected: string | null = null
): Promise<{ nombre: string; porque: string }[]> {
  if (closet.length === 0 || !process.env.ANTHROPIC_API_KEY) return [];

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

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 700,
    system: `Eres la stylist de stailist.${generoTxt} Falta UNA prenda para un viaje y la persona NO quiere comprar: quiere resolverlo con lo que YA tiene. Te doy la prenda que falta y su CLÓSET REAL. Propón hasta 3 prendas del clóset que de verdad puedan SUSTITUIRLA, la mejor primero.

REGLAS:
- La CLASE manda por encima de todo: solo sirve algo de la MISMA clase/categoría que lo que falta (un pantalón lo sustituye otro pantalón; un calzado, otro calzado; un top, otro top del mismo tipo de uso). NUNCA cruces clases.
- Debe ser un sustituto USABLE para esa ocasión y clima, no cualquier cosa de la categoría. Un sustituto razonable, aunque no idéntico (otro neutro, un corte parecido), cuenta.
- Solo prendas que están en el CLÓSET, con su nombre EXACTO. No inventes.
- Si NADA del clóset sirve de verdad, devuelve lista vacía. Mejor vacío que un sustituto malo.
- "porque": media línea cálida (tuteo) de por qué funciona como reemplazo.`,
    messages: [
      {
        role: "user",
        content: `FALTA: ${missing.nombre} (tipo: ${missing.tipo}, ${missing.category}, ${missing.formalidad}, ${missing.colorFamilia}). Para: ${missing.porque}${
          rejected
            ? `\n\nOJO: para este hueco tenía "${rejected}" pero NO le late — proponle opciones distintas, con otro aire (no la incluyas ni propongas casi lo mismo).`
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
  });

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
