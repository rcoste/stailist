import { ENGINE_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORIES,
  FORMALIDADES,
  type CapsuleItem,
  type CapsuleTarget,
  type VetoReason,
} from "@/lib/capsule";
import { SEASONS, seasonMetal, seasonPalette, type Season } from "@/lib/colorimetria";

export type CapsuleSwapInputs = {
  target: CapsuleTarget; // toda la cápsula, para coherencia
  index: number; // slot a reemplazar
  rejectedNames: string[]; // nombres ya rechazados en ese slot (incluye el ideal)
  reason: VetoReason | null;
  gender: "hombre" | "mujer" | null;
  season: Season | null;
  flow: Season | null;
  vetoes: string[]; // labels de vetos duros (vetoLabels)
};

// Instrucción por razón: qué debe cambiar la alternativa respecto a lo rechazado.
const REASON_HINT: Record<VetoReason, string> = {
  "no-es-mi-estilo":
    "La prenda NO va con su estilo. Propón un TIPO de prenda distinto que cubra el mismo rol (misma categoría), no una variante del mismo tipo.",
  "muy-formal": "La sintió DEMASIADO formal. Propón algo del mismo rol pero más relajado/casual.",
  "muy-casual": "La sintió DEMASIADO casual. Propón algo del mismo rol pero más pulido.",
  "color-no": "No le gustó ESE color. Mantén el tipo de prenda pero cámbialo a otro color de su paleta.",
  "ya-tengo-algo-asi":
    "Ya tiene algo parecido. Propón una prenda que cubra el mismo rol pero CLARAMENTE distinta de lo rechazado y de lo que ya está en la cápsula — otro tipo, otra silueta u otro color.",
  "fuera-de-presupuesto":
    "Le pareció caro. Propón la versión más básica y accesible que cubra el mismo rol: material y detalles simples, nada de piezas statement.",
  // Ya no se ofrece en la UI; sigue aquí porque hay decisiones guardadas con él.
  "no-lo-uso":
    "La persona NO usa ese tipo de prenda. Propón un TIPO de prenda distinto que cubra el mismo rol (misma categoría), no una variante del mismo tipo.",
};

// CAPA A — reemplazo de UN slot: la persona rechazó la prenda ideal de un hueco.
// Proponemos UNA alternativa que cubra el MISMO rol (misma categoría) y combine con
// el resto de la cápsula, respetando su paleta y sus vetos, evitando lo rechazado.
export async function generateCapsuleSwap(
  inputs: CapsuleSwapInputs
): Promise<CapsuleItem> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");
  const client = new Anthropic();

  const slot = inputs.target.items[inputs.index];
  if (!slot) throw new Error("BAD_SLOT");

  // Resto de la cápsula (para coherencia): nombre · categoría · color · formalidad.
  const resto = inputs.target.items
    .filter((_, i) => i !== inputs.index)
    .map((it) => `- ${it.nombre} (${it.category}, ${it.colorFamilia}, ${it.formalidad})`)
    .join("\n");

  let paletaTxt = "No definida (usa neutros versátiles de su cápsula).";
  if (inputs.season) {
    const { mejores, prestados, evita } = seasonPalette(inputs.season, inputs.flow);
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    const avoid = evita.map((c) => c.nombre).join(", ");
    paletaTxt = `Paleta ${SEASONS[inputs.season].label}. Le favorecen: ${favs}. EVITA: ${avoid}.`;
  }
  const metal = seasonMetal(inputs.season, inputs.flow);

  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: solo ropa de hombre."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: solo ropa de mujer."
        : "Género no definido: prenda neutra/unisex.";

  const reasonTxt = inputs.reason
    ? REASON_HINT[inputs.reason]
    : "No dio una razón: propón algo del mismo rol que se sienta claramente distinto a lo rechazado.";

  const vetosTxt = inputs.vetoes.length
    ? `NUNCA propongas nada que sea o incluya: ${inputs.vetoes.join(", ")}.`
    : "";

  const rechazadasTxt = inputs.rejectedNames.length
    ? `Ya rechazó (NO repitas ni propongas variantes cercanas): ${inputs.rejectedNames.join("; ")}.`
    : "";

  const response = await client.messages.create({
    model: ENGINE_MODEL,
    max_tokens: 1500,
    system: `Eres la stylist senior de stailist. La persona rechazó una prenda de su clóset cápsula ideal y hay que reemplazarla por UNA alternativa. ${generoTxt}

Reglas:
- La alternativa DEBE cubrir el MISMO rol: misma "category" (${slot.category}) que la rechazada. No cambies de categoría.
- Debe combinar con el RESTO de la cápsula (te lo doy): anclada en los mismos neutros, dentro de su paleta.
- Respeta la colorimetría: usa colores de su paleta, NUNCA de su lista de EVITA. Su metal es ${metal}.
- ${reasonTxt}
- ${rechazadasTxt}
- ${vetosTxt}
- Devuelve UNA sola prenda concreta y combinable, con el mismo formato que el resto de la cápsula.

PRIMERO llena "plan" (2-3 líneas, la persona no lo ve): por qué esta alternativa cubre el rol y combina. DESPUÉS el item.`,
    messages: [
      {
        role: "user",
        content: `SLOT A REEMPLAZAR (rol): ${slot.nombre} — categoría ${slot.category}, formalidad ${slot.formalidad}, color ${slot.colorFamilia}, temporada ${slot.temporada}. Su función: ${slot.porque}

RESTO DE LA CÁPSULA (combina con esto):
${resto}

COLORIMETRÍA: ${paletaTxt}

Propón la alternativa (item).`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            plan: {
              type: "string",
              description: "Tu borrador (la persona no lo ve, 2-3 líneas): por qué esta alternativa cubre el rol y combina con el resto.",
            },
            item: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                tipo: { type: "string" },
                category: { type: "string", enum: [...CATEGORIES] },
                colorFamilia: { type: "string" },
                formalidad: { type: "string", enum: [...FORMALIDADES] },
                temporada: { type: "string" },
                prioridad: { type: "integer" },
                porque: { type: "string" },
              },
              required: ["nombre", "tipo", "category", "colorFamilia", "formalidad", "temporada", "prioridad", "porque"],
              additionalProperties: false,
            },
          },
          required: ["plan", "item"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  if (response.stop_reason === "max_tokens") throw new Error("TRUNCATED_RESPONSE");
  const parsed = JSON.parse(text) as { item: CapsuleItem };
  const item = parsed.item;
  if (!item || !item.nombre || !item.tipo) throw new Error("BAD_SWAP");
  // El rol lo define la categoría del slot: la fijamos por si el modelo se desvió,
  // y conservamos la prioridad original del slot (su lugar en la cápsula no cambia).
  // `hueco` se HEREDA por la misma razón: la alternativa cubre EL MISMO hueco, así
  // que el rótulo del card no debe cambiar al cambiar la prenda (y así tampoco hay
  // que volver a pedírselo al modelo).
  return {
    ...item,
    category: slot.category,
    prioridad: slot.prioridad,
    hueco: slot.hueco ?? null,
  };
}
