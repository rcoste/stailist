import Anthropic from "@anthropic-ai/sdk";
import { buildSingleOutfitSchema } from "./schema";
import { contextBlock, closetBlock, type EngineContext } from "./prompt";
import type { GeneratedOutfit } from "./generate";

// Juez de styling, UNO POR OUTFIT (para poder ir mostrándolos conforme se
// aprueban). Caza color que choca y problemas de styling y los ARREGLA
// intercambiando prendas del mismo clóset. Corre en Sonnet (rápido/barato, ya
// que se llama por cada outfit). Si falla, devuelve el outfit original — nunca
// rompe la generación. Rúbrica más exigente para mujer que para hombre.

const CRITIC_MODEL = "claude-sonnet-4-6";

const CRITIC_SYSTEM = `Eres el director de estilo de stailist: revisas UN look que armó la stylist antes de enseñárselo a la clienta. Subes el nivel, no rehaces.

Qué haces:
- Si está bien armado y los colores combinan, DÉJALO IGUAL (mismas prendas).
- Si tiene un problema (color que choca, proporción rara, formalidades que pelean, le falta algo para cerrar), ARRÉGLALO intercambiando UNA prenda por otra del MISMO clóset (vienen con id y hex). Reescribe su explicación si cambió.

Reglas duras:
- Usa ÚNICAMENTE prendas del clóset (por id). Jamás inventes.
- Cambia SOLO cuando de verdad mejora. Si dudas, déjalo como está.
- Si te paso looks ya aprobados, mantén ÉSTE distinto de ellos.
- Marino + negro combinan bien (incluso formal); NO los separes por eso. Concéntrate en color que de verdad choca, proporción y coherencia.
- La explicación: una línea, voz de amiga cool, tuteo, cero jerga técnica.`;

const RUBRICA_MUJER = `Revisa con ojo de stylist de moda femenina (muchos grados de libertad, sé exigente):
- Color: máx 1-2 protagonistas + neutros; nada que choque o se enlode (juzga por el hex). Lo near-face (top/abrigo) debe favorecerla y NUNCA ser un color de su EVITA.
- Proporción y silueta: equilibra volumen (oversize arriba ↔ entallado abajo); evita "todo holgado" o "todo pegado".
- Cintura y largos: define la cintura cuando ayude; cuida el largo de falda/vestido contra el calzado.
- Capas y coherencia: vestido O dos piezas con lógica; saco/capa que sume; no mezcles deportivo con formal salvo intención.
- Completitud: si se siente incompleto, intercambia por una pieza que lo cierre.`;

const RUBRICA_HOMBRE = `Revisa con criterio masculino (más formulaico, lo esencial):
- Color: máx 1-2 protagonistas + neutros; nada que choque (juzga por el hex). Near-face en su paleta, nunca un EVITA.
- Coherencia de formalidad: no mezcles sastre formal con deportivo salvo intención.
- Proporción básica: que no sea todo holgado ni todo pegado.`;

function buildCriticMessage(
  ctx: EngineContext,
  outfit: GeneratedOutfit,
  priorOutfits: GeneratedOutfit[],
  gender: "hombre" | "mujer" | null
): string {
  const lines: string[] = [...contextBlock(ctx), "", ...closetBlock(ctx.items)];

  lines.push("", `Look a revisar — "${outfit.nombre}": ${outfit.item_ids.join(" + ")}`);

  if (priorOutfits.length > 0) {
    lines.push("", "Looks ya aprobados (mantén éste DISTINTO de ellos):");
    priorOutfits.forEach((o) => lines.push(`- ${o.item_ids.join(" + ")}`));
  }

  lines.push("", gender === "mujer" ? RUBRICA_MUJER : RUBRICA_HOMBRE);
  lines.push("", "Devuelve el look final (arreglado o tal cual).");
  return lines.join("\n");
}

export async function reviewOutfit(
  ctx: EngineContext,
  outfit: GeneratedOutfit,
  priorOutfits: GeneratedOutfit[],
  gender: "hombre" | "mujer" | null
): Promise<GeneratedOutfit> {
  if (!process.env.ANTHROPIC_API_KEY) return outfit;

  try {
    const client = new Anthropic();
    const itemIds = ctx.items.map((i) => i.id);
    const response = await client.messages.create({
      model: CRITIC_MODEL,
      max_tokens: 1024,
      system: CRITIC_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildCriticMessage(ctx, outfit, priorOutfits, gender),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: buildSingleOutfitSchema(itemIds),
        },
      },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return outfit;

    const parsed = JSON.parse(text) as GeneratedOutfit;
    const valid = new Set(itemIds);
    if (
      parsed.nombre &&
      parsed.explicacion &&
      Array.isArray(parsed.item_ids) &&
      parsed.item_ids.length >= 2 &&
      parsed.item_ids.every((id) => valid.has(id))
    ) {
      return parsed;
    }
    return outfit;
  } catch {
    return outfit;
  }
}
