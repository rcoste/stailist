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

// Tope de celdas de la rejilla que mandamos a validar (una maleta real cae muy
// por debajo; este es el cinturón para clósets-empacables grandes).
const MAX_CELLS = 40;
// Tope de looks que mostramos (la rejilla puede dar muchos; curamos los distintos).
const MAX_LOOKS = 16;

// SISTEMA SUDOKU: en vez de pedirle a la IA "arma unos looks" (que capaba en 8),
// enumeramos en CÓDIGO la rejilla de combinaciones de lo empacable
// (top×bottom×calzado + vestido×calzado). La IA solo VALIDA cada celda (¿combina
// de color/formalidad/clima?), la etiqueta por ocasión y le pone una capa si
// ayuda. Garantiza cobertura (no se le olvida ninguna combinación) y maximiza
// los looks por prenda — el premio de empacar ligero.
export async function generateTripOutfits(
  inputs: TripOutfitInputs
): Promise<TripOutfit[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");
  if (inputs.packable.length < 2) return [];

  // --- 1. Slots de la rejilla ---
  const bySlot = (cat: string) => inputs.packable.filter((p) => p.category === cat);
  const tops = bySlot("top");
  const bottoms = bySlot("bottom");
  const calzado = bySlot("calzado");
  const vestidos = bySlot("vestido");
  const capas = bySlot("abrigo");
  const accesorios = bySlot("accesorio");

  // --- 2. Enumera las celdas (combinaciones base) ---
  // Si no hay calzado empacado, la celda igual vale (top+bottom / vestido).
  const shoeSlots: (PackableItem | null)[] = calzado.length ? calzado : [null];
  type Cell = { base: number[] };
  const cells: Cell[] = [];
  for (const t of tops)
    for (const b of bottoms)
      for (const s of shoeSlots)
        cells.push({ base: [t.n, b.n, ...(s ? [s.n] : [])] });
  for (const v of vestidos)
    for (const s of shoeSlots) cells.push({ base: [v.n, ...(s ? [s.n] : [])] });

  // Sin separables ni vestidos completos → no hay rejilla que armar.
  if (cells.length === 0) return [];
  const grid = cells.slice(0, MAX_CELLS);

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

  const fmt = (p: PackableItem) => `${p.n}. ${p.nombre} (${p.formalidad}, ${p.color})`;
  const prendasTxt = inputs.packable.map(fmt).join("\n");
  const capasTxt = capas.length ? capas.map((p) => p.n).join(", ") : "ninguna";
  const accTxt = accesorios.length ? accesorios.map((p) => p.n).join(", ") : "ninguno";
  const celdasTxt = grid.map((c, i) => `C${i}: prendas [${c.base.join(", ")}]`).join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3072,
    system: `Eres la stylist de stailist. La MALETA ya está hecha. Te doy la REJILLA de combinaciones posibles de lo que la persona empaca (cada celda es un top+bottom+calzado, o un vestido+calzado, ya enumerados). Tu trabajo es VALIDAR cada celda y quedarte con los looks que de verdad funcionan.

REGLA INNEGOCIABLE: trabajas SOLO con las celdas y prendas dadas, por número. Jamás inventes una prenda ni una combinación fuera de la rejilla. ${generoTxt}

Por cada celda decide si es un OUTFIT real:
- Coherencia de color: los tonos combinan (no choca).
- Formalidad pareja y apropiada para alguna ocasión del viaje.
- Respeta el CLIMA (no lana en calor, no lino fresco en frío).
- Si la celda no funciona (colores que pelean, formalidad incompatible), DESCÁRTALA.

Para las celdas que SÍ funcionan:
- Asígnale UNA ocasión del viaje (clave exacta).
- Opcional: súmale UNA capa (de: ${capasTxt}) y/o UN accesorio (de: ${accTxt}) si la mejora.
- titulo: nombre corto y evocador (tuteo, cálido). Ej "Cena junto al mar".
- porque: UNA línea de por qué funciona.
- Evita looks casi idénticos: si dos celdas dan prácticamente el mismo look, deja solo el mejor.
- Maximiza la VARIEDAD útil entre las ocasiones del viaje (no 6 looks para la misma ocasión si hay otras sin cubrir).

Devuelve los looks válidos (los que pasen el filtro), del mejor al menos bueno.`,
    messages: [
      {
        role: "user",
        content: `OCASIONES: ${ocasTxt}.\nCLIMA: ${climaTxt}.\nESTILO: ${estilo}. Tags: ${tags}.\n\nPRENDAS (número. nombre (formalidad, color)):\n${prendasTxt}\n\nREJILLA DE CELDAS A VALIDAR:\n${celdasTxt}\n\nValida la rejilla y devuelve los looks que funcionan.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            looks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  celda: { type: "integer" }, // índice C# de la celda base
                  ocasion: { type: "string", enum: [...ocasiones] },
                  titulo: { type: "string" },
                  porque: { type: "string" },
                  extra: { type: "array", items: { type: "integer" } }, // capa/accesorio opcional
                },
                required: ["celda", "ocasion", "titulo", "porque", "extra"],
                additionalProperties: false,
              },
            },
          },
          required: ["looks"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as {
    looks: { celda: number; ocasion: string; titulo: string; porque: string; extra: number[] }[];
  };

  const byN = new Map(inputs.packable.map((p) => [p.n, p.nombre]));
  const validOcc = new Set(OCCASIONS.map((o) => o.value as string));

  return (parsed.looks ?? [])
    .map((l) => {
      const cell = grid[l.celda];
      if (!cell) return null;
      // Reconstruye: piezas base de la celda + capa/accesorio que sumó la IA.
      const nums = [...cell.base, ...(l.extra ?? [])];
      const prendas = Array.from(
        new Set(nums.map((n) => byN.get(n)).filter((v): v is string => !!v))
      );
      return {
        ocasion: l.ocasion as Occasion,
        titulo: (l.titulo ?? "").trim(),
        porque: (l.porque ?? "").trim(),
        prendas,
      };
    })
    .filter((o): o is TripOutfit => !!o && validOcc.has(o.ocasion) && !!o.titulo && o.prendas.length >= 2)
    .slice(0, MAX_LOOKS);
}
