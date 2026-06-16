import Anthropic from "@anthropic-ai/sdk";
import { buildOutfitSchema } from "./schema";
import { contextBlock, closetBlock, type EngineContext } from "./prompt";
import type { GeneratedOutfit } from "./generate";

// Segunda pasada: un director de estilo revisa los looks que armó el generador,
// caza color que choca y problemas de styling, y los ARREGLA intercambiando
// prendas del mismo clóset (no inventa). Rúbrica más exigente para mujer (más
// grados de libertad) que para hombre (más formulaico). Si falla, devuelve los
// looks originales — nunca rompe la generación.

const CRITIC_SYSTEM = `Eres el director de estilo de stailist: revisas los looks que armó la stylist ANTES de enseñárselos a la clienta. Tu trabajo es subir el nivel, no rehacerlo todo.

Qué haces con cada look:
- Si está bien armado y los colores combinan, DÉJALO IGUAL (mismas prendas).
- Si tiene un problema (color que choca, proporción rara, formalidades que pelean, le falta algo para cerrar), ARRÉGLALO intercambiando UNA prenda por otra del MISMO clóset (vienen con id y hex). Reescribe su explicación si cambió.
- Solo descarta un look si es irreparable con lo que hay en el clóset.

Reglas duras:
- Usa ÚNICAMENTE prendas del clóset (por id). Jamás inventes.
- Devuelve 2 o 3 looks, DISTINTOS entre sí. Conserva la variedad y el vibe de la clienta — no los vuelvas todos iguales ni aburridos.
- Cambia SOLO cuando de verdad mejora. Si dudas, deja el look como está.
- MARINO + NEGRO en formal: si ves un blazer, saco o pantalón de vestir marino combinado con negro, ARRÉGLALO (se ve como traje desparejado). En casual (jeans, tenis) sí puede ir.
- La explicación: una línea, voz de amiga cool, tuteo, cero jerga técnica.`;

const RUBRICA_MUJER = `Revisa con ojo de stylist de moda femenina (aquí hay muchos grados de libertad, sé exigente):
- Color: máx 1-2 protagonistas + neutros; nada que choque o se enlode (juzga por el hex). Lo near-face (top/abrigo) debe favorecerla y NUNCA ser un color de su EVITA.
- Proporción y silueta: equilibra volumen (oversize arriba ↔ entallado abajo); evita "todo holgado" o "todo pegado".
- Cintura y largos: define la cintura cuando ayude; cuida el largo de falda/vestido contra el calzado.
- Capas y coherencia: vestido O dos piezas con lógica; saco/capa que sume; no mezcles deportivo con formal salvo intención.
- Completitud: si un look se siente incompleto, intercambia por una pieza que lo cierre.`;

const RUBRICA_HOMBRE = `Revisa con criterio masculino (más formulaico, enfócate en lo esencial):
- Color: máx 1-2 protagonistas + neutros; nada que choque (juzga por el hex). Near-face en su paleta, nunca un EVITA.
- Coherencia de formalidad: no mezcles sastre formal con deportivo salvo intención.
- Proporción básica: que no sea todo holgado ni todo pegado.`;

function buildCriticMessage(
  ctx: EngineContext,
  outfits: GeneratedOutfit[],
  gender: "hombre" | "mujer" | null
): string {
  const lines: string[] = [...contextBlock(ctx), "", ...closetBlock(ctx.items)];

  lines.push("", "Looks que armó la stylist (revísalos uno por uno):");
  outfits.forEach((o, i) => {
    lines.push(`Look ${i + 1} "${o.nombre}": ${o.item_ids.join(" + ")}`);
  });

  lines.push("", gender === "mujer" ? RUBRICA_MUJER : RUBRICA_HOMBRE);
  lines.push("", "Devuelve los looks finales (arreglados o tal cual).");
  return lines.join("\n");
}

export async function reviewOutfits(
  ctx: EngineContext,
  outfits: GeneratedOutfit[],
  gender: "hombre" | "mujer" | null
): Promise<GeneratedOutfit[]> {
  // Sin key o sin nada que revisar → no toca nada.
  if (!process.env.ANTHROPIC_API_KEY || outfits.length === 0) return outfits;

  try {
    const client = new Anthropic();
    const itemIds = ctx.items.map((i) => i.id);
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system: CRITIC_SYSTEM,
      messages: [
        { role: "user", content: buildCriticMessage(ctx, outfits, gender) },
      ],
      output_config: {
        format: { type: "json_schema", schema: buildOutfitSchema(itemIds) },
      },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return outfits;

    const parsed = JSON.parse(text) as { outfits: GeneratedOutfit[] };
    const valid = new Set(itemIds);
    const reviewed = (parsed.outfits ?? [])
      .filter(
        (o) =>
          o.nombre &&
          o.explicacion &&
          Array.isArray(o.item_ids) &&
          o.item_ids.length >= 2 &&
          o.item_ids.every((id) => valid.has(id))
      )
      .slice(0, 3);

    // Si el crítico devolvió algo coherente lo usamos; si no, los originales.
    return reviewed.length >= 2 ? reviewed : outfits;
  } catch {
    return outfits;
  }
}
