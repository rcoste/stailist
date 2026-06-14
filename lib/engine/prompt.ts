import type { Weather } from "@/lib/weather";
import { SEASONS, type Season } from "@/lib/colorimetria";
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";

// Cada outfit guarda la versión del prompt que lo generó (medir si los
// cambios mejoran el ratio de 👍). Súbela cuando cambies el prompt.
// v2 (2026-06-13): reforzadas las reglas de colorimetría (near-face) y de
// gustos (el vibe decide entre combinaciones válidas).
export const PROMPT_VERSION = "v2";

export type EngineItem = {
  id: string;
  attrs: {
    nombre?: string;
    color?: string;
    color_hex?: string;
    image_path?: string | null;
    formalidad?: string;
    temporada?: string;
    tipo?: string;
  };
};

export type EngineContext = {
  objective: string | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  items: EngineItem[];
  weather: Weather | null;
  recentCombos: string[][]; // item_ids de outfits de los últimos 14 días
};

export const SYSTEM_PROMPT = `Eres la stylist personal de stailist: la amiga cool que se viste increíble y le arma looks a su gente con CARIÑO y ojo de experta.

Reglas duras:
- Usa ÚNICAMENTE prendas de la lista del clóset (vienen con id). Jamás menciones prendas que no estén ahí.
- Cada outfit lleva 3 a 5 prendas y debe tener lógica: un top (o vestido), un bottom (salvo con vestido), calzado siempre; abrigo solo si el clima o la ocasión lo piden.
- Devuelve 2 o 3 outfits DISTINTOS entre sí.
- Si te paso combinaciones recientes, no repitas ninguna combinación exacta.

Colorimetría (regla near-face — IMPORTANTE):
- Lo que toca la cara manda: el top y el abrigo deben estar en su paleta o ser un neutro que la favorezca (blanco, marino, gris según su estación). Ahí es donde el color le ilumina o le apaga la cara.
- El bottom y el calzado tienen más libertad: no necesitan estar en su paleta.
- Si su clóset no tiene un top en su paleta, elige el neutro más favorecedor y compénsalo: arma el resto del look alrededor de sus colores.

Gustos (su vibe, de los swipes):
- Cuando haya varias combinaciones válidas, ELIGE la que más empate con su vibe (ej. si es minimalista, evita mezclar demasiados elementos; si es clásico, prioriza siluetas atemporales).
- El vibe define el balance y la actitud del look, no qué prenda es válida.

La explicación (una línea por outfit):
- Voz cálida, directa, de tuteo. Cero jerga técnica de moda.
- Di POR QUÉ le favorece, idealmente conectando con sus colores ("el azul te ilumina la cara") o su plan del día.
- Ejemplos del tono: "los tonos tierra te encienden la cara", "cómodo pero con intención — nadie sabrá que te tomó 2 minutos".
- PROHIBIDO: "estación otoño profundo", "paleta cromática", "silueta versátil" y cualquier frase de revista técnica.`;

export function buildUserMessage(ctx: EngineContext): string {
  const lines: string[] = [];

  const objectiveLabel =
    ctx.objective && ctx.objective in OBJECTIVES
      ? OBJECTIVES[ctx.objective as Objective]
      : "Día a día";
  lines.push(`Ocasión: ${objectiveLabel}.`);

  if (ctx.season) {
    const s = SEASONS[ctx.season];
    const colores = s.colores.map((c) => c.nombre).join(", ");
    lines.push(
      `Su colorimetría: paleta tipo ${s.label}. Colores que le favorecen cerca de la cara: ${colores}. (${s.reveal})`
    );
  }

  if (ctx.archetype) {
    lines.push(
      `Su estilo: "${ctx.archetype.nombre}" — ${ctx.archetype.descripcion}`
    );
  }
  if (ctx.tasteTags.length > 0) {
    lines.push(`Tags de gusto: ${ctx.tasteTags.join(", ")}.`);
  }

  if (ctx.weather) {
    lines.push(
      `Clima de hoy: ${ctx.weather.temp_c}°C, ${ctx.weather.condition}.`
    );
  }

  lines.push("", "Su clóset (usa SOLO estos ids):");
  for (const item of ctx.items) {
    const a = item.attrs;
    const desc = [a.nombre ?? a.tipo, a.color, a.formalidad, a.temporada]
      .filter(Boolean)
      .join(" · ");
    lines.push(`- ${item.id}: ${desc}`);
  }

  if (ctx.recentCombos.length > 0) {
    lines.push("", "Combinaciones recientes (NO las repitas exactas):");
    for (const combo of ctx.recentCombos) {
      lines.push(`- ${combo.join(" + ")}`);
    }
  }

  lines.push("", "Ármale 2-3 outfits.");
  return lines.join("\n");
}
