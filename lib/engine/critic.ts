import Anthropic from "@anthropic-ai/sdk";
import { buildCriticSchema } from "./schema";
import { contextBlock, closetBlock, type EngineContext } from "./prompt";
import type { GeneratedOutfit } from "./generate";

// Juez de styling, UNO POR OUTFIT (para poder ir mostrándolos conforme se
// aprueban). Caza color que choca y problemas de styling y los ARREGLA
// intercambiando prendas del mismo clóset. Si el look está mal y NO se puede
// arreglar con este clóset, lo RECHAZA (con razón) en vez de maquillarlo.
// Corre en Sonnet (rápido/barato, ya que se llama por cada outfit). Si falla,
// devuelve el outfit original con veredicto "ok" — nunca rompe la generación.
// Rúbrica más exigente para mujer que para hombre.

const CRITIC_MODEL = "claude-sonnet-4-6";

export type CriticVerdict = "ok" | "reparado" | "rechazado";

// Resultado del juez: el look final + su veredicto y razón (para el flywheel).
// En "rechazado" el outfit que devolvemos es el original (sin tocar) — quien
// llama decide si lo descarta o lo muestra como último recurso.
export type CriticResult = {
  outfit: GeneratedOutfit;
  verdict: CriticVerdict;
  razon: string | null;
};

const CRITIC_SYSTEM = `Eres el director de estilo de stailist: revisas UN look que armó la stylist antes de enseñárselo a la clienta. Subes el nivel, no rehaces.

Qué haces (elige UN veredicto):
- "ok": está bien armado y los colores combinan → DÉJALO IGUAL (mismas prendas).
- "reparado": tiene un problema (color que choca, proporción rara, formalidades que pelean, le falta algo para cerrar) que SÍ puedes resolver intercambiando UNA prenda por otra del MISMO clóset (vienen con id y hex) → arréglalo y reescribe su explicación.
- "rechazado": está mal Y NO se puede arreglar con este clóset (no hay una prenda alternativa que funcione). Es la EXCEPCIÓN, no la norma: primero intenta reparar; rechaza solo si de verdad no hay arreglo. Di la razón concreta.

Reglas duras:
- VETOS: si el contexto trae una lista de VETOS y el look incluye algo vetado, NO pasa. Repáralo cambiando esa prenda por otra del clóset que no esté vetada; si no hay alternativa limpia, RECHÁZALO (razón: "veto"). Es absoluto, por encima de todo lo demás.
- Usa ÚNICAMENTE prendas del clóset (por id). Jamás inventes.
- Cambia SOLO cuando de verdad mejora. Si dudas, déjalo como está (ok).
- Si te paso looks ya aprobados, mantén ÉSTE distinto de ellos.
- Marino + negro combinan bien (incluso formal); NO los separes por eso. Concéntrate en color que de verdad choca, proporción y coherencia.
- Caza el "traje desparejado": un saco/blazer + pantalón del MISMO color y tono (marino con marino, gris con gris, negro con negro) que NO son un traje real se ve como un conjunto roto. Si lo ves, REPÁRALO cambiando el bottom por otro neutro del clóset (gris, beige, caqui, denim) para que el saco se lea como pieza intencional. (No aplica si de verdad son un traje de la misma tela.)
- La explicación: una línea, voz de amiga cool, tuteo, cero jerga técnica.

EL TOQUE (cómo llevarlo) — campo "tip", OPCIONAL:
Puedes sumar UN tip de styling: un solo movimiento concreto para llevar ESTE look mejor. Reglas (síguelas o deja "tip" en cadena vacía):
- UNO solo, o NINGUNO. Si el look ya está completo y no hay un movimiento que de verdad lo eleve, deja "tip" en cadena vacía. Mejor sin tip que uno forzado. NO pongas tip en todos los looks.
- Concreto a la prenda real ("fájate la camisa de lino al frente"), nunca genérico ("acomoda tu top").
- NO ves la prenda (solo tipo/color/formalidad), así que prioriza movimientos SEGUROS que no dependen del largo/corte exacto: dejar una capa/blazer/chamarra abierta, jugar la proporción (si algo es holgado, equilibra con algo entallado), abrir un botón o el cuello, arremangar (solo si es manga larga).
- Movimientos de RIESGO (fajar — depende del largo del top; cuffear el pantalón — depende del tipo y del zapato): úsalos SOLO si la prenda claramente lo permite; si dudas, frasea condicional ("si te da el largo, medio fájala al frente") o no lo pongas.
- Respeta formalidad (formal: fajar sí, medio-fajar/cuffear casual no), el vibe (minimalista = menos es más) y el género.
- Si el contexto trae su cuerpo, conecta el efecto cuando aplique ("fájala al frente — te marca la cintura, que te equilibra").
- Voz de amiga cool, una frase corta, sin jerga.`;

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
  lines.push(
    "",
    "Devuelve tu veredicto (ok / reparado / rechazado), la razón, y el look final (arreglado o tal cual)."
  );
  return lines.join("\n");
}

export async function reviewOutfit(
  ctx: EngineContext,
  outfit: GeneratedOutfit,
  priorOutfits: GeneratedOutfit[],
  gender: "hombre" | "mujer" | null
): Promise<CriticResult> {
  // Sin juez (no hay API key): pasa el outfit tal cual, veredicto neutro.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { outfit, verdict: "ok", razon: null };
  }

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
          schema: buildCriticSchema(itemIds),
        },
      },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return { outfit, verdict: "ok", razon: null };

    const parsed = JSON.parse(text) as GeneratedOutfit & {
      veredicto?: CriticVerdict;
      razon?: string;
    };
    const verdict: CriticVerdict =
      parsed.veredicto === "reparado" || parsed.veredicto === "rechazado"
        ? parsed.veredicto
        : "ok";
    const razon = parsed.razon?.trim() ? parsed.razon.trim() : null;
    const tip = parsed.tip?.trim() ? parsed.tip.trim() : null;

    // Rechazado: devolvemos el outfit ORIGINAL (sin la "reparación" fallida);
    // quien llama decide descartarlo o mostrarlo como último recurso.
    if (verdict === "rechazado") {
      return { outfit, verdict, razon };
    }

    // ok / reparado: usamos el look del juez solo si es válido; si no, el original.
    const valid = new Set(itemIds);
    if (
      parsed.nombre &&
      parsed.explicacion &&
      Array.isArray(parsed.item_ids) &&
      parsed.item_ids.length >= 2 &&
      parsed.item_ids.every((id) => valid.has(id))
    ) {
      return {
        outfit: {
          nombre: parsed.nombre,
          item_ids: parsed.item_ids,
          explicacion: parsed.explicacion,
          tip,
        },
        verdict,
        razon,
      };
    }
    return { outfit, verdict: "ok", razon: null };
  } catch {
    return { outfit, verdict: "ok", razon: null };
  }
}
