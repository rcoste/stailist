import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, FORMALIDADES, type CapsuleItem, type CapsuleTarget } from "@/lib/capsule";
import { SEASONS, seasonMetal, seasonPalette, type Season } from "@/lib/colorimetria";
import { occasionLabels, luggageMeta, type Luggage, type Occasion } from "@/lib/trip";

export type TripCapsuleInputs = {
  days: number;
  ocasiones: Occasion[];
  maleta: Luggage | null;
  weather: { temp_c: number; condition: string; estimated?: boolean } | null;
  gender: "hombre" | "mujer" | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
  vetoes: string[];
};

// La cápsula IDEAL del viaje: una lista mínima de prendas concretas que combinan
// entre sí, dimensionada a los días × ocasiones × clima, con la maleta como
// TECHO. Libre del catálogo (puede pedir prendas que no tienes — eso luego sale
// como "te falta" en el match). Una llamada; el match es aparte (reusa
// capsule-match). Mismo shape que CapsuleTarget para reusar match + derivados.
export async function generateTripCapsuleTarget(
  inputs: TripCapsuleInputs
): Promise<CapsuleTarget> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");
  const client = new Anthropic();

  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: TODA la cápsula es ropa de hombre. Jamás prendas de mujer."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: TODA la cápsula es ropa de mujer. Jamás prendas pensadas solo para hombre."
        : "Género no definido: usa prendas neutras/unisex.";

  let paletaTxt = "No definida (usa neutros versátiles).";
  if (inputs.season) {
    const { mejores, prestados, evita } = seasonPalette(inputs.season, inputs.flow);
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    const avoid = evita.map((c) => c.nombre).join(", ");
    paletaTxt = `Paleta ${SEASONS[inputs.season].label}. Le favorecen: ${favs}. EVITA: ${avoid}.`;
  }
  const metal = seasonMetal(inputs.season, inputs.flow);
  const metalTxt = `Su metal es ${metal.toUpperCase()} (accesorios metálicos siempre ${metal}).`;

  const estilo = inputs.archetype
    ? `"${inputs.archetype.nombre}" — ${inputs.archetype.descripcion}`
    : "sin definir";
  const tags = inputs.tasteTags.length ? inputs.tasteTags.join(", ") : "sin tags";

  const climaTxt = inputs.weather
    ? inputs.weather.estimated
      ? `~${inputs.weather.temp_c}°C (clima TÍPICO de la temporada, no pronóstico exacto — prioriza versatilidad y capas que aguanten variación)`
      : `${inputs.weather.temp_c}°C, ${inputs.weather.condition}`
    : "desconocido (usa prendas versátiles, evita extremos)";
  const ocas = inputs.ocasiones.length ? occasionLabels(inputs.ocasiones) : "general";
  const lug = luggageMeta(inputs.maleta);
  const techoTxt = lug
    ? `Maleta: ${lug.label} (${lug.hint}). TECHO de ~${lug.maxPiezas} prendas — no lo pases. Si el viaje pediría más, prioriza lo más versátil y recorta lo opcional.`
    : "Maleta no definida: mantén la cápsula mínima y versátil.";
  const vetoTxt = inputs.vetoes.length
    ? `VETOS — jamás incluyas: ${inputs.vetoes.join(", ")}.`
    : "";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3072,
    system: `Eres la stylist de stailist. Armas la CÁPSULA DE VIAJE: la lista MÍNIMA de prendas que la persona debe llevar para que combinen entre sí y le cubran todos los días, sin sobre-empacar.

REGLA INNEGOCIABLE DE GÉNERO: ${generoTxt}

Cómo dimensionarla:
- Es una cápsula de mezcla-y-combina: pocas piezas que dan muchos looks. NO una prenda por día.
- Dimensiona a los DÍAS y a la MEZCLA DE OCASIONES (ej. playa pide trajes de baño y shorts; una noche de arreglarse pide una pieza más formal). Cubre todas las ocasiones que te pasen.
- Respeta el CLIMA: calor → ligero, fresco; frío → capas y abrigo. No metas abrigo si hace calor ni shorts si hace frío.
- ${techoTxt}
- Incluye SIEMPRE la base: tops, bottoms y calzado suficientes para combinar; ropa interior/calcetines NO se listan (se asumen).

Aterriza a la persona:
- COLORIMETRÍA: nombra colores de su paleta; nunca un color de su EVITA. ${metalTxt}
- Su estilo y gustos definen la vibra.
- ${vetoTxt}

Devuelve "items" (la cápsula). Cada prenda:
- nombre: etiqueta humana y específica con color. Ej "Traje de baño negro", "Short de lino beige".
- tipo: clave corta normalizada sin color. Ej "traje-de-bano", "short", "playera", "sandalias".
- category ∈ {${CATEGORIES.join(", ")}}
- colorFamilia: color en familia simple, dentro de su paleta.
- formalidad ∈ {${FORMALIDADES.join(", ")}}
- temporada: "todo-el-año" | "calor" | "frio".
- prioridad: 1 = imprescindible para el viaje, subiendo a lo opcional.
- porque: UNA línea cálida (tuteo) de por qué la lleva.`,
    messages: [
      {
        role: "user",
        content: `VIAJE: ${inputs.days} día(s). Ocasiones: ${ocas}. Clima: ${climaTxt}.\n${techoTxt}\n\nESTILO: ${estilo}\nTags: ${tags}\nCOLORIMETRÍA: ${paletaTxt} ${metalTxt}\n${vetoTxt}\n\nArma su cápsula de viaje (items).`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
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
                required: [
                  "nombre",
                  "tipo",
                  "category",
                  "colorFamilia",
                  "formalidad",
                  "temporada",
                  "prioridad",
                  "porque",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as { items: CapsuleItem[] };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("BAD_TRIP_CAPSULE");
  }
  const items = parsed.items
    .slice()
    .sort((a, b) => a.prioridad - b.prioridad)
    .map((it, i) => ({ ...it, prioridad: i + 1 }));
  return { version: 2, items };
}
