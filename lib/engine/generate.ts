import { ENGINE_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import { buildOutfitSchema } from "./schema";
import type { BlueprintEmparejado } from "./blueprint";
import {
  buildUserMessage,
  SYSTEM_PROMPT,
  type EngineContext,
} from "./prompt";

export type GeneratedOutfit = {
  nombre: string;
  item_ids: string[];
  explicacion: string;
  tip?: string | null; // "el toque" — lo produce el juez; null/ausente = sin tip
};

// Una llamada al modelo → 2-3 outfits validados. El schema con enum de ids
// garantiza prendas reales; aquí validamos además forma y cantidad.
export async function generateOutfits(
  ctx: EngineContext,
  // Solo para el A/B del arnés (ver buildUserMessage). Producción no lo pasa.
  opciones: {
    marcarEstilo?: boolean;
    sinRecetario?: boolean;
    sinBlueprint?: boolean;
    blueprint?: BlueprintEmparejado | null;
  } = {}
): Promise<GeneratedOutfit[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ENGINE_NOT_CONNECTED");
  }

  const client = new Anthropic();
  const itemIds = ctx.items.map((i) => i.id);

  const response = await client.messages.create({
    model: ENGINE_MODEL,
    // 3072: el campo "analisis" (borrador de razonamiento del schema) consume
    // tokens antes de los outfits; 2048 quedaba justo.
    max_tokens: 3072,
    // Thinking APAGADO. En los modelos 5 viene encendido por default y en el
    // motor cuesta ~50% más de latencia (32s contra 21s, medido) sin que se vea
    // en los looks: el schema ya obliga a razonar en el campo "analisis" antes
    // de comprometer los outfits, que es la misma idea con el costo dentro del
    // presupuesto. Y esto corre dentro del límite de 60s de Vercel CON los
    // jueces detrás — 32s de generación deja el margen demasiado corto.
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(ctx, opciones) }],
    output_config: {
      format: {
        type: "json_schema",
        schema: buildOutfitSchema(itemIds),
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  // Truncado por tope de tokens = JSON incompleto. Error distinguible (no un
  // JSON.parse opaco): el schema no puede acotar el "analisis" (maxLength no
  // está soportado en structured outputs), así que este es el backstop.
  if (response.stop_reason === "max_tokens") throw new Error("TRUNCATED_RESPONSE");

  const parsed = JSON.parse(text) as { outfits: GeneratedOutfit[] };
  const valid = new Set(itemIds);
  const outfits = (parsed.outfits ?? [])
    .filter(
      (o) =>
        o.nombre &&
        o.explicacion &&
        Array.isArray(o.item_ids) &&
        o.item_ids.length >= 2 &&
        o.item_ids.every((id) => valid.has(id))
    )
    .slice(0, 3);

  if (outfits.length < 2) throw new Error("TOO_FEW_OUTFITS");

  // Ancla: si la usuaria fijó una prenda, garantízala en cada candidato (el
  // prompt ya la pide; esto es la red de seguridad por si el modelo la omite).
  const seed = ctx.seedItemId;
  if (seed && valid.has(seed)) {
    return outfits.map((o) =>
      o.item_ids.includes(seed)
        ? o
        : { ...o, item_ids: [seed, ...o.item_ids].slice(0, 5) }
    );
  }
  return outfits;
}
