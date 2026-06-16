import type { Weather } from "@/lib/weather";
import { SEASONS, seasonPalette, type Season } from "@/lib/colorimetria";
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";

// Cada outfit guarda la versión del prompt que lo generó (medir si los
// cambios mejoran el ratio de 👍). Súbela cuando cambies el prompt.
// v2 (2026-06-13): reglas de colorimetría (near-face) y de gustos.
// v3 (2026-06-14): paleta no binaria (base + prestados) + lista EVITA dura.
// v4 (2026-06-16): hex de cada prenda + sección de armonía de color/proporción
// en la 1ª pasada, y crítico de styling gender-aware como 2ª pasada.
export const PROMPT_VERSION = "v4";

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
  flow: Season | null;
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
- Lo que toca la cara manda: el top y el abrigo deben estar en su paleta (sus mejores o sus prestados) o ser un neutro que la favorezca. Ahí es donde el color le ilumina o le apaga la cara.
- REGLA DURA: jamás pongas cerca de la cara (top o abrigo) un color de su lista de EVITA — esos la apagan. En bottom o calzado no importan.
- El bottom y el calzado tienen más libertad: no necesitan estar en su paleta.
- Si su clóset no tiene un top en su paleta, elige el neutro más favorecedor y compénsalo: arma el resto del look alrededor de sus colores.

Armonía del outfit (cómo combinan las prendas entre sí):
- Ancla en neutros: máximo 1-2 colores protagonistas por look; el resto neutros (negro, blanco, gris, beige, marino, camel). Tres saturados juntos casi nunca funcionan.
- Usa los hex para juzgar el color real: si hay un color fuerte, acompáñalo de neutros; evita dos saturados que compitan o tonos que se enloden juntos.
- Proporción: equilibra el volumen — si arriba es holgado/oversize, abajo algo más entallado (y al revés). Evita "todo holgado" o "todo pegado".
- Coherencia: no mezcles formalidades opuestas (sastre formal con deportivo) salvo que su vibe lo pida a propósito.

Gustos (su vibe, de los swipes):
- Cuando haya varias combinaciones válidas, ELIGE la que más empate con su vibe (ej. si es minimalista, evita mezclar demasiados elementos; si es clásico, prioriza siluetas atemporales).
- El vibe define el balance y la actitud del look, no qué prenda es válida.

La explicación (una línea por outfit):
- Voz cálida, directa, de tuteo. Cero jerga técnica de moda.
- Di POR QUÉ le favorece, idealmente conectando con sus colores ("el azul te ilumina la cara") o su plan del día.
- Ejemplos del tono: "los tonos tierra te encienden la cara", "cómodo pero con intención — nadie sabrá que te tomó 2 minutos".
- PROHIBIDO: "estación otoño profundo", "paleta cromática", "silueta versátil" y cualquier frase de revista técnica.`;

// Una prenda como línea: incluye el hex para que el modelo juzgue el color real.
export function describeItem(item: EngineItem): string {
  const a = item.attrs;
  const color =
    a.color && a.color_hex
      ? `${a.color} ${a.color_hex}`
      : a.color_hex ?? a.color;
  return [a.nombre ?? a.tipo, color, a.formalidad, a.temporada]
    .filter(Boolean)
    .join(" · ");
}

// Contexto de la clienta (ocasión, colorimetría, estilo, gustos, clima).
// Compartido por el generador (1ª pasada) y el crítico (2ª pasada).
export function contextBlock(ctx: EngineContext): string[] {
  const lines: string[] = [];

  const objectiveLabel =
    ctx.objective && ctx.objective in OBJECTIVES
      ? OBJECTIVES[ctx.objective as Objective]
      : "Día a día";
  lines.push(`Ocasión: ${objectiveLabel}.`);

  const s = ctx.season ? SEASONS[ctx.season] : null;
  if (s) {
    const { mejores, prestados, evita } = seasonPalette(ctx.season!, ctx.flow);
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    const avoid = evita.map((c) => c.nombre).join(", ");
    const flowSeason = ctx.flow ? SEASONS[ctx.flow] : null;
    const flowLabel = flowSeason ? ` (con flow a ${flowSeason.label})` : "";
    lines.push(
      `Su colorimetría: paleta tipo ${s.label}${flowLabel}. Le favorecen cerca de la cara: ${favs}. EVITA cerca de la cara (la apagan): ${avoid}.`
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
    lines.push(`Clima de hoy: ${ctx.weather.temp_c}°C, ${ctx.weather.condition}.`);
  }

  return lines;
}

// El clóset como bloque (ids + descripción con hex).
export function closetBlock(items: EngineItem[]): string[] {
  const lines = ["Su clóset (usa SOLO estos ids):"];
  for (const item of items) {
    lines.push(`- ${item.id}: ${describeItem(item)}`);
  }
  return lines;
}

export function buildUserMessage(ctx: EngineContext): string {
  const lines: string[] = [...contextBlock(ctx), "", ...closetBlock(ctx.items)];

  if (ctx.recentCombos.length > 0) {
    lines.push("", "Combinaciones recientes (NO las repitas exactas):");
    for (const combo of ctx.recentCombos) {
      lines.push(`- ${combo.join(" + ")}`);
    }
  }

  lines.push("", "Ármale 2-3 outfits.");
  return lines.join("\n");
}
