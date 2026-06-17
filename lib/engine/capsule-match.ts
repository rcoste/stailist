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
  closet: ClosetItemLite[],
  gender: "hombre" | "mujer" | null = null
): Promise<CapsuleMatch> {
  const signature = closetSignature(closet);
  const blank: MatchEntry[] = target.items.map(() => ({ status: "falta", by: null }));

  // Sin clóset (o sin API) → todo falta, sin gastar una llamada.
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

  const generoTxt =
    gender === "hombre"
      ? " La persona es hombre (su clóset es ropa de hombre)."
      : gender === "mujer"
        ? " La persona es mujer (su clóset es ropa de mujer)."
        : "";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `Eres la stylist de stailist.${generoTxt} Te doy la CÁPSULA IDEAL de alguien (prendas que debería tener) y su CLÓSET REAL. Por CADA prenda ideal, clasifícala en uno de TRES estados según lo que ya tiene:

- "tienes": el clóset ya tiene esa prenda en forma usable — mismo tipo y uso, color compatible, misma formalidad. Cuenta equivalencias reales de tipo (una desert boot vale por una chukka; una camisa azul claro vale por "camisa celeste").
- "parecido": el clóset tiene la prenda CORRECTA (mismo tipo y uso) pero con un matiz que vale notar — otro neutro, o un casi-equivalente. NO es hueco, es refinamiento. Ej: tiene blazer marino y el ideal es negro; tiene mocasín y el ideal es Oxford.
- "falta": el clóset NO tiene esa prenda en ninguna forma usable. Hueco real. Ej: no hay ningún cuello tortuga; o el ideal pide un color statement que cambia el papel y no lo tiene.

REGLAS:
- El TIPO manda y es estricto: distinto tipo de prenda = "falta" aunque el color empate. Un crewneck NO cubre un cuello tortuga (cuello distinto) → "falta".
- COLOR de neutros oscuros (negro, marino, gris, carbón, azul oscuro) = intercambiables: nunca marques "falta" solo por el neutro. Mismo neutro → "tienes"; neutro distinto → "parecido".
- COLORES statement o cálidos específicos (camel, oliva, vino, mostaza, etc.) SÍ importan: si el ideal pide uno y el clóset no lo tiene, es "falta".

Devuelve "entries": EXACTAMENTE una entrada por prenda ideal, EN EL MISMO ORDEN (1..N). Cada entrada:
- status: "tienes" | "parecido" | "falta".
- by: el nombre exacto de la prenda del clóset que la cumple o se le parece, o "" si falta.`,
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
                  status: { type: "string", enum: ["tienes", "parecido", "falta"] },
                  by: { type: "string" },
                },
                required: ["status", "by"],
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
  const parsed = JSON.parse(text) as {
    entries: { status: MatchEntry["status"]; by: string }[];
  };

  // Alinea por índice; si el modelo devolvió de más/menos, ajusta sin romper.
  const entries: MatchEntry[] = target.items.map((_, i) => {
    const e = parsed.entries?.[i];
    if (!e) return { status: "falta", by: null };
    const status = e.status === "tienes" || e.status === "parecido" ? e.status : "falta";
    return { status, by: e.by && e.by.trim() ? e.by.trim() : null };
  });

  return { signature, entries };
}
