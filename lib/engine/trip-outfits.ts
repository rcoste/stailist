import Anthropic from "@anthropic-ai/sdk";
import { OCCASIONS, occasionLabels, type Occasion, type TripOutfit } from "@/lib/trip";

// Una prenda empacable, numerada para el prompt. El LLM referencia prendas por
// `n` (nunca inventa nombres ni IDs); el motor mapea de vuelta a `nombre`.
export type PackableItem = {
  n: number;
  nombre: string; // nombre de la prenda del clóset (lo que se guarda y se renderea)
  category: string;
  color: string;
  formalidad: string;
};

export type TripOutfitInputs = {
  packable: PackableItem[];
  ocasiones: Occasion[];
  weather: { temp_c: number; condition: string; estimated?: boolean } | null;
  gender: "hombre" | "mujer" | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
};

// Los LOOKS del viaje: combinaciones reales de lo que la persona EMPACA, una o
// dos por ocasión. La cápsula ya garantizó que las piezas combinan y están en su
// paleta; aquí solo las componemos en outfits concretos. Una sola llamada (segura
// en 60s). Devuelve outfits denormalizados a nombres de prenda.
export async function generateTripOutfits(
  inputs: TripOutfitInputs
): Promise<TripOutfit[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");
  if (inputs.packable.length < 2) return [];

  const client = new Anthropic();

  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: todos los looks son de hombre."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: todos los looks son de mujer."
        : "Género no definido: looks neutros.";

  const ocasiones = inputs.ocasiones.length ? inputs.ocasiones : (["ciudad"] as Occasion[]);
  const ocasTxt = occasionLabels(ocasiones);

  const climaTxt = inputs.weather
    ? inputs.weather.estimated
      ? `~${inputs.weather.temp_c}°C (clima típico de la temporada)`
      : `${inputs.weather.temp_c}°C, ${inputs.weather.condition}`
    : "desconocido";

  const estilo = inputs.archetype
    ? `"${inputs.archetype.nombre}" — ${inputs.archetype.descripcion}`
    : "sin definir";
  const tags = inputs.tasteTags.length ? inputs.tasteTags.join(", ") : "sin tags";

  const prendasTxt = inputs.packable
    .map((p) => `${p.n}. ${p.nombre} (${p.category}, ${p.formalidad}, ${p.color})`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `Eres la stylist de stailist. La MALETA ya está hecha: la persona va a llevar exactamente estas prendas. Tu trabajo es armar los LOOKS que puede ponerse — combinaciones reales de ESAS prendas, listas para usar en el viaje.

REGLA INNEGOCIABLE: usa SOLO las prendas de la lista, referenciadas por su número. Jamás inventes una prenda que no esté. ${generoTxt}

Cómo armar los looks:
- Uno o dos looks por ocasión que te pasen. Máximo 8 looks en total.
- Cada look es un outfit COMPLETO y poible: al menos top + bottom + calzado (o un vestido/enterizo + calzado). Suma una capa o accesorio de la lista si ayuda.
- Coherencia: colores que combinen y formalidad pareja con la ocasión (no tenis a una cena formal).
- Respeta el CLIMA al elegir piezas.
- Cubre las ocasiones que puedas con lo que hay. Si una ocasión NO se puede armar con estas prendas, OMÍTELA (no la fuerces, no inventes).

Cada look:
- ocasion: una de las ocasiones dadas (clave exacta).
- titulo: nombre corto y evocador del look (tuteo, cálido). Ej "Cena junto al mar".
- porque: UNA línea de por qué funciona.
- prendas: lista de NÚMEROS de las prendas de la lista (2 o más).`,
    messages: [
      {
        role: "user",
        content: `OCASIONES: ${ocasTxt}.\nCLIMA: ${climaTxt}.\nESTILO: ${estilo}. Tags: ${tags}.\n\nPRENDAS QUE EMPACA (usa solo estos números):\n${prendasTxt}\n\nArma sus looks del viaje (outfits).`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            outfits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ocasion: { type: "string", enum: [...ocasiones] },
                  titulo: { type: "string" },
                  porque: { type: "string" },
                  prendas: { type: "array", items: { type: "integer" } },
                },
                required: ["ocasion", "titulo", "porque", "prendas"],
                additionalProperties: false,
              },
            },
          },
          required: ["outfits"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as {
    outfits: { ocasion: string; titulo: string; porque: string; prendas: number[] }[];
  };

  const byN = new Map(inputs.packable.map((p) => [p.n, p.nombre]));
  const validOcc = new Set(OCCASIONS.map((o) => o.value as string));

  return (parsed.outfits ?? [])
    .map((o) => {
      // Mapea números → nombres reales; descarta referencias inválidas y duplicados.
      const prendas = Array.from(
        new Set((o.prendas ?? []).map((n) => byN.get(n)).filter((v): v is string => !!v))
      );
      return {
        ocasion: o.ocasion as Occasion,
        titulo: (o.titulo ?? "").trim(),
        porque: (o.porque ?? "").trim(),
        prendas,
      };
    })
    .filter((o) => validOcc.has(o.ocasion) && o.titulo && o.prendas.length >= 2)
    .slice(0, 8);
}
