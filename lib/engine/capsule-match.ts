import Anthropic from "@anthropic-ai/sdk";
import {
  closetSignature,
  type CapsuleMatch,
  type CapsuleTarget,
  type ClosetItemLite,
  type MatchEntry,
} from "@/lib/capsule";

// CAPA 2 — el match: por cada prenda de la cápsula ideal, ¿el clóset real ya la
// cubre? El juicio fino (¿una desert boot cubre una chukka? ¿un crewneck cubre
// un cuello tortuga?) lo hace la IA, porque el clóset no guarda un "tipo" fino.
// El resultado se CACHEA con la firma del clóset (ver el caller) para que el
// número no baile entre cargas: solo se recalcula si cambia el clóset.
export async function matchCapsule(
  target: CapsuleTarget,
  closet: ClosetItemLite[]
): Promise<CapsuleMatch> {
  const signature = closetSignature(closet);
  const blank: MatchEntry[] = target.items.map(() => ({ covered: false, by: null }));

  // Sin clóset (o sin API) → nada cubierto, sin gastar una llamada.
  if (closet.length === 0 || !process.env.ANTHROPIC_API_KEY) {
    return { signature, entries: blank };
  }

  const client = new Anthropic();

  const idealTxt = target.items
    .map((it, i) => `${i + 1}. ${it.nombre} (tipo: ${it.tipo}, ${it.category}, ${it.formalidad}, ${it.colorFamilia})`)
    .join("\n");
  const closetTxt = closet
    .map((c) => `- ${c.nombre} (${c.category}, ${c.formalidad}, ${c.color})`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `Eres la stylist de stailist. Te doy la CÁPSULA IDEAL de alguien (prendas que debería tener) y su CLÓSET REAL. Por CADA prenda ideal, decide si el clóset ya tiene algo que la CUBRE de verdad.

"Cubre" = misma clase de prenda y uso, color y formalidad compatibles. Sé sensato con equivalencias reales: una desert boot cubre una chukka; un crewneck NO cubre un cuello tortuga (cuello distinto); una camisa azul claro cubre "camisa celeste"; unos chinos beige NO cubren "jeans". No fuerces matches por que sí: si dudas y la prenda real es claramente otra cosa, NO la cubre.

Devuelve "entries": EXACTAMENTE una entrada por prenda ideal, EN EL MISMO ORDEN (1..N). Cada entrada:
- covered: true/false.
- by: el nombre exacto de la prenda del clóset que la cubre, o "" si ninguna.`,
    messages: [
      {
        role: "user",
        content: `CÁPSULA IDEAL (${target.items.length} prendas):\n${idealTxt}\n\nCLÓSET REAL:\n${closetTxt}\n\nMarca cada prenda ideal.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  covered: { type: "boolean" },
                  by: { type: "string" },
                },
                required: ["covered", "by"],
                additionalProperties: false,
              },
            },
          },
          required: ["entries"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as { entries: { covered: boolean; by: string }[] };

  // Alinea por índice; si el modelo devolvió de más/menos, ajusta sin romper.
  const entries: MatchEntry[] = target.items.map((_, i) => {
    const e = parsed.entries?.[i];
    if (!e) return { covered: false, by: null };
    return { covered: !!e.covered, by: e.by && e.by.trim() ? e.by.trim() : null };
  });

  return { signature, entries };
}
