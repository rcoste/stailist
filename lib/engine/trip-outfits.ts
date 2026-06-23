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

// Clima del viaje para el motor. Además del resumen, lleva el RANGO entre
// ciudades: un viaje multi-destino (Tokio 9° / Seúl 1°) debe empacar para la
// más fría, no para el promedio (que dejaba a la ciudad fría sub-abrigada).
export type TripWeatherInput = {
  temp_c: number;
  condition: string;
  estimated?: boolean;
  temp_min?: number; // ciudad más fría del viaje
  temp_max?: number; // ciudad más cálida
  coldest?: string; // nombre de la ciudad más fría (para el porqué)
};

export type TripOutfitInputs = {
  packable: PackableItem[];
  ocasiones: Occasion[];
  weather: TripWeatherInput | null;
  gender: "hombre" | "mujer" | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  silueta?: string | null; // orientación de cuerpo; señal suave, no regla
  // "Generar más": conjuntos de prendas (por nombre) que YA se mostraron. El
  // motor los salta y le pide a la IA combinaciones DISTINTAS — más con lo mismo.
  exclude?: string[][];
};

// Tope de celdas de la rejilla que mandamos a validar (una maleta real cae muy
// por debajo; este es el cinturón para clósets-empacables grandes).
const MAX_CELLS = 40;
// Tope de looks que mostramos (la rejilla puede dar muchos; curamos los distintos).
const MAX_LOOKS = 16;

// Reduce balanceadamente los slots para que el producto T×B×S no pase el tope SIN
// dejar piezas fuera de manera sesgada: recorta el slot más grande primero (las
// prendas vienen en orden de prioridad de la cápsula, así que conserva las top).
function capProduct(t: number, b: number, s: number, max: number): [number, number, number] {
  while (t * b * s > max && (t > 1 || b > 1 || s > 1)) {
    if (t >= b && t >= s && t > 1) t--;
    else if (b >= s && b > 1) b--;
    else if (s > 1) s--;
    else break;
  }
  return [t, b, s];
}

// Clima como texto para el prompt. Si el viaje cruza ciudades con temperaturas
// muy distintas (spread ≥ 4°), pide EMPACAR PARA LA MÁS FRÍA — cada look debe
// aguantar la temp mínima, con capas que se quiten en los destinos cálidos. Así
// no quedan looks de una sola capa para una ciudad a 1°.
export function climaText(w: TripWeatherInput | null): string {
  if (!w) return "desconocido";
  const cond = w.condition && w.condition !== "despejado" ? `, ${w.condition}` : "";
  const est = w.estimated ? " (clima típico de la temporada)" : "";
  const spread =
    typeof w.temp_min === "number" &&
    typeof w.temp_max === "number" &&
    w.temp_max - w.temp_min >= 4;
  if (spread) {
    const fria = w.coldest ? ` (la más fría: ${w.coldest})` : "";
    return `de ${w.temp_min}°C a ${w.temp_max}°C entre ciudades${fria}${cond}${est}. EMPACA PARA LA MÁS FRÍA: cada look debe aguantar ${w.temp_min}°C — nada de una sola capa ligera; suma abrigo/suéter. En los destinos más cálidos se quitan capas.`;
  }
  return `${w.temp_c}°C${cond}${est}`;
}

// SISTEMA SUDOKU: en vez de pedirle a la IA "arma unos looks" (que capaba en 8),
// enumeramos en CÓDIGO la rejilla de combinaciones de lo empacable
// (top×bottom×calzado + vestido×calzado). La IA solo VALIDA cada celda (¿combina
// de color/formalidad/clima?), la etiqueta por ocasión y le suma una capa si
// ayuda. Garantiza cobertura (no se le olvida ninguna combinación) y maximiza los
// looks por prenda — el premio de empacar ligero.
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

  // Solo capas y accesorios pueden sumarse como "extra" a un look base.
  const extraOk = new Set([...capas, ...accesorios].map((p) => p.n));

  // --- 2. Enumera las celdas (combinaciones base), balanceadas y bajo tope ---
  type Cell = { base: number[]; kind: "sep" | "vestido" };
  const cells: Cell[] = [];

  // Presupuesto: separables comparten tope con los vestidos. Damos a vestidos un
  // techo chico (cada vestido × calzados) y el resto a separables.
  const shoeN = Math.max(1, calzado.length);
  const dressCells = vestidos.length * shoeN;
  const sepBudget = Math.max(0, MAX_CELLS - Math.min(dressCells, 12));

  if (tops.length && bottoms.length && sepBudget > 0) {
    const [nt, nb, ns] = capProduct(tops.length, bottoms.length, shoeN, sepBudget);
    const Tops = tops.slice(0, nt);
    const Bottoms = bottoms.slice(0, nb);
    const Shoes: (PackableItem | null)[] = calzado.length ? calzado.slice(0, ns) : [null];
    for (const t of Tops)
      for (const b of Bottoms)
        for (const s of Shoes) cells.push({ base: [t.n, b.n, ...(s ? [s.n] : [])], kind: "sep" });
  }

  const dressShoes: (PackableItem | null)[] = calzado.length ? calzado.slice(0, 3) : [null];
  for (const v of vestidos.slice(0, 6))
    for (const s of dressShoes) cells.push({ base: [v.n, ...(s ? [s.n] : [])], kind: "vestido" });

  // Sin separables completos ni vestidos → no hay rejilla que armar.
  if (cells.length === 0) return [];
  const grid = cells.slice(0, MAX_CELLS); // backstop duro

  // maxRetries alto: aguanta un saturón breve de la API (529) con backoff antes
  // de fallar — el usuario espera la generación a-demanda.
  const client = new Anthropic({ maxRetries: 4 });

  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: todos los looks son de hombre."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: todos los looks son de mujer."
        : "Género no definido: looks neutros.";

  const ocasiones = inputs.ocasiones.length ? inputs.ocasiones : (["ciudad"] as Occasion[]);
  const ocasTxt = occasionLabels(ocasiones);
  const climaTxt = climaText(inputs.weather);
  const estilo = inputs.archetype
    ? `"${inputs.archetype.nombre}" — ${inputs.archetype.descripcion}`
    : "sin definir";
  const tags = inputs.tasteTags.length ? inputs.tasteTags.join(", ") : "sin tags";
  const cuerpoTxt = inputs.silueta
    ? `\nCUERPO (orientación suave, no regla): ${inputs.silueta}. Úsalo solo para desempatar entre looks parejos y enriquecer el porqué cuando aplique.`
    : "";

  const fmt = (p: PackableItem) => `${p.n}. ${p.nombre} (${p.formalidad}, ${p.color})`;
  const prendasTxt = inputs.packable.map(fmt).join("\n");
  const capasTxt = capas.length ? capas.map((p) => p.n).join(", ") : "ninguna";
  const accTxt = accesorios.length ? accesorios.map((p) => p.n).join(", ") : "ninguno";
  const celdasTxt = grid.map((c, i) => `C${i}: prendas [${c.base.join(", ")}]`).join("\n");
  // "Generar más": lista los looks ya mostrados para que la IA dé combos DISTINTOS.
  const excludeSets = (inputs.exclude ?? []).map((s) => [...s].sort());
  const excludeTxt = excludeSets.length
    ? `\n\nYA SE MOSTRARON estos looks — NO los repitas; quiero combinaciones DISTINTAS con las mismas prendas:\n${excludeSets
        .map((s) => `- ${s.join(" + ")}`)
        .join(
          "\n"
        )}\nPrioriza celdas que mezclen las prendas de formas nuevas. AQUÍ SÍ puedes dar VARIOS looks para la MISMA ocasión si son combinaciones realmente distintas — el usuario pidió MÁS opciones, no más variedad de ocasión. Devuelve todas las que de verdad funcionen (color coherente, clima y formalidad ok), aunque repitan ocasión.`
    : "";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: `Eres la stylist de stailist. La MALETA ya está hecha. Te doy la REJILLA de combinaciones posibles de lo que la persona empaca (cada celda es un top+bottom+calzado, o un vestido+calzado, ya enumerados). Tu trabajo es VALIDAR cada celda y quedarte con los looks que de verdad funcionan.

REGLA INNEGOCIABLE: trabajas SOLO con las celdas y prendas dadas, por número. Jamás inventes una prenda ni una combinación fuera de la rejilla. En "extra" SOLO puedes poner números de capas (${capasTxt}) o accesorios (${accTxt}); nada más. ${generoTxt}

Por cada celda decide si es un OUTFIT real:
- Coherencia de color: los tonos combinan (no choca).
- Formalidad pareja y apropiada para alguna ocasión del viaje.
- Respeta el CLIMA (no lana en calor, no lino fresco en frío). Si el clima es FRÍO (≤12°C), cada look debe llevar abrigo o capa de verdad — descarta los que queden en una sola capa ligera (camiseta sola, camisa sola sin abrigo). Si hay rango de temperaturas, cada look debe aguantar la MÁS FRÍA.
- Si la celda no funciona (colores que pelean, formalidad incompatible), DESCÁRTALA.

Para las celdas que SÍ funcionan:
- Asígnale UNA ocasión del viaje (clave exacta).
- Opcional: súmale en "extra" UNA capa y/o UN accesorio si la mejora (solo de las listas de arriba).
- titulo: nombre corto y evocador (tuteo, cálido). Ej "Cena junto al mar".
- porque: UNA línea de por qué funciona.
- tip ("el toque"): OPCIONAL — UN movimiento de styling para llevar ESE look mejor (medio fajado, mangas arremangadas, capa abierta…), concreto y seguro, una frase. SOLO sobre prendas que están en ESE look; NUNCA menciones ni sugieras añadir una prenda que no está en él. Cadena vacía si el look ya está completo y no hay un toque que lo eleve. NO en todos los looks; mejor sin tip que uno forzado.
- Evita looks casi idénticos: si dos celdas dan prácticamente el mismo look, deja solo el mejor.
- Maximiza la VARIEDAD útil entre las ocasiones del viaje (no 6 looks para la misma ocasión si hay otras sin cubrir).
- Devuelve A LO MÁS ${MAX_LOOKS} looks, los mejores y más variados.`,
    messages: [
      {
        role: "user",
        content: `OCASIONES: ${ocasTxt}.\nCLIMA: ${climaTxt}.\nESTILO: ${estilo}. Tags: ${tags}.${cuerpoTxt}\n\nPRENDAS (número. nombre (formalidad, color)):\n${prendasTxt}\n\nREJILLA DE CELDAS A VALIDAR:\n${celdasTxt}${excludeTxt}\n\nValida la rejilla y devuelve los looks que funcionan.`,
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
                  tip: { type: "string" }, // "el toque": cómo llevarlo (cadena vacía si no aplica)
                  extra: { type: "array", items: { type: "integer" } }, // capa/accesorio opcional
                },
                required: ["celda", "ocasion", "titulo", "porque", "tip", "extra"],
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
    looks?: {
      celda: number;
      ocasion: string;
      titulo: string;
      porque: string;
      tip?: string;
      extra?: number[];
    }[];
  };

  const byN = new Map(inputs.packable.map((p) => [p.n, p.nombre]));
  const validOcc = new Set(OCCASIONS.map((o) => o.value as string));
  // Siembra el dedup con lo ya mostrado ("generar más") → solo salen combos nuevos.
  const seen = new Set<string>(
    (inputs.exclude ?? []).map((s) => [...s].sort().join("|"))
  );

  const out: TripOutfit[] = [];
  for (const l of parsed.looks ?? []) {
    const cell = grid[l.celda];
    if (!cell) continue;
    // Reconstruye: piezas base + SOLO capas/accesorios válidos del "extra".
    const extra = (l.extra ?? []).filter((n) => extraOk.has(n));
    const nums = [...cell.base, ...extra];
    const prendas = Array.from(
      new Set(nums.map((n) => byN.get(n)).filter((v): v is string => !!v))
    );
    // Un vestido es look completo solo (1 pieza); los separables necesitan ≥2.
    const minOk = cell.kind === "vestido" ? prendas.length >= 1 : prendas.length >= 2;
    const ocasion = l.ocasion as Occasion;
    if (!minOk || !validOcc.has(ocasion) || !(l.titulo ?? "").trim()) continue;
    // Dedup: mismo conjunto exacto de prendas = mismo look, no se repite.
    const key = [...prendas].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ocasion,
      titulo: l.titulo.trim(),
      porque: (l.porque ?? "").trim(),
      tip: l.tip?.trim() ? l.tip.trim() : null,
      prendas,
    });
    if (out.length >= MAX_LOOKS) break;
  }
  return out;
}

// JUEZ DE VIAJE (2ª pasada, en lote): el generador valida la rejilla dentro de su
// propio prompt, pero deja pasar looks sub-abrigados para el frío (camiseta sola
// a 1°C) y combinaciones flojas. Esta pasada los caza: por cada look decide
// ok / reparado (sumar o cambiar UNA prenda de la maleta, por número — el caso
// típico es sumar una capa para el frío) / rechazado (descartar). UNA llamada
// para todos (barato, ve el set completo). Si falla, devuelve los looks tal cual
// — nunca rompe la generación.
export type TripReviewResult = {
  outfits: TripOutfit[];
  repaired: number;
  dropped: number;
};

export async function reviewTripOutfits(
  inputs: TripOutfitInputs,
  outfits: TripOutfit[]
): Promise<TripReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY || outfits.length === 0) {
    return { outfits, repaired: 0, dropped: 0 };
  }

  const nByNombre = new Map(inputs.packable.map((p) => [p.nombre, p.n]));
  const byN = new Map(inputs.packable.map((p) => [p.n, p.nombre]));
  const capas = inputs.packable.filter((p) => p.category === "abrigo");
  const accesorios = inputs.packable.filter((p) => p.category === "accesorio");

  // Cada look como su lista de números (lo que el juez puede manipular).
  const looksTxt = outfits
    .map((o, i) => {
      const ns = o.prendas
        .map((nm) => nByNombre.get(nm))
        .filter((n): n is number => n != null);
      return `L${i} [${o.ocasion}] "${o.titulo}": prendas [${ns.join(", ")}]`;
    })
    .join("\n");

  const prendasTxt = inputs.packable
    .map((p) => `${p.n}. ${p.nombre} (${p.category}, ${p.formalidad}, ${p.color})`)
    .join("\n");
  const capasTxt = capas.length ? capas.map((p) => p.n).join(", ") : "ninguna";
  const accTxt = accesorios.length ? accesorios.map((p) => p.n).join(", ") : "ninguno";
  const climaTxt = climaText(inputs.weather);
  const generoTxt =
    inputs.gender === "hombre"
      ? "HOMBRE"
      : inputs.gender === "mujer"
        ? "MUJER"
        : "neutro";

  const system = `Eres el director de estilo de stailist revisando los looks de un VIAJE antes de enseñárselos. La maleta ya está hecha; cada look usa SOLO prendas de la lista, por NÚMERO. Tu trabajo: cazar los que NO funcionan y arreglarlos o descartarlos. Persona: ${generoTxt}.

Por cada look, UN veredicto:
- "ok": funciona (clima, color, formalidad, ocasión) → déjalo igual.
- "reparado": tiene un problema que SÍ se arregla sumando o cambiando UNA prenda de la maleta (por número). Devuelve en "prendas" la lista COMPLETA de números del look ya arreglado.
- "rechazado": está mal y NO se puede arreglar con esta maleta → se descarta. Di la razón.

CLIMA — lo más importante (es donde más falla el generador):
- Cada look debe aguantar la temperatura MÁS FRÍA del viaje. En frío (≤12°C) un look de UNA sola capa ligera (camiseta sola, camisa/oxford solo, sin abrigo ni suéter) NO sirve. Tampoco tenis de lona en frío con lluvia/nieve.
- Si ves un look sub-abrigado: REPÁRALO sumando una capa de la maleta (capas disponibles: ${capasTxt}) o cambiando una prenda ligera por una más caliente. Solo recházalo si no hay ninguna capa/prenda en la maleta que lo salve.
- En calor: nada de lana ni abrigos pesados.

COMBINACIÓN: color coherente (máx 1-2 protagonistas + neutros, el resto neutros), formalidad pareja, apropiado para su ocasión. Marino + negro SÍ combinan.

REGLAS:
- Trabaja SOLO con números de la lista de prendas. Jamás inventes.
- "extra"/capas/accesorios válidos para sumar: capas ${capasTxt}; accesorios ${accTxt}.
- Prefiere REPARAR sobre rechazar. Rechaza solo si de verdad no hay arreglo.
- En "prendas" de cada revisión, devuelve SIEMPRE la lista de números del look final (para "ok" repite la original; para "reparado" la nueva; para "rechazado" puede ir vacía).`;

  const userMsg = `CLIMA: ${climaTxt}.

PRENDAS DE LA MALETA (número. nombre (categoría, formalidad, color)):
${prendasTxt}

LOOKS A REVISAR:
${looksTxt}

Revisa cada look (por su L#) y devuelve un veredicto por cada uno.`;

  try {
    const client = new Anthropic({ maxRetries: 3 });
    const response = await client.messages.create({
      // Sonnet: rápido y barato para la 2ª pasada (el caso principal, sub-abrigo,
      // no necesita Opus) y deja holgura bajo el límite de 60s de la función.
      model: "claude-sonnet-4-6",
      max_tokens: 3072,
      system,
      messages: [{ role: "user", content: userMsg }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              revisiones: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" }, // L# del look
                    veredicto: { type: "string", enum: ["ok", "reparado", "rechazado"] },
                    razon: { type: "string" },
                    prendas: { type: "array", items: { type: "integer" } },
                  },
                  required: ["index", "veredicto", "razon", "prendas"],
                  additionalProperties: false,
                },
              },
            },
            required: ["revisiones"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return { outfits, repaired: 0, dropped: 0 };
    const parsed = JSON.parse(text) as {
      revisiones?: {
        index: number;
        veredicto: "ok" | "reparado" | "rechazado";
        razon?: string;
        prendas?: number[];
      }[];
    };
    const byIndex = new Map(
      (parsed.revisiones ?? []).map((r) => [r.index, r])
    );

    const result: TripOutfit[] = [];
    let repaired = 0;
    let dropped = 0;
    for (let i = 0; i < outfits.length; i++) {
      const rev = byIndex.get(i);
      const original = outfits[i];
      if (!rev || rev.veredicto === "ok") {
        result.push(original);
        continue;
      }
      if (rev.veredicto === "rechazado") {
        dropped++;
        continue;
      }
      // reparado: reconstruye prendas desde los números válidos de la maleta.
      const nombres = Array.from(
        new Set(
          (rev.prendas ?? [])
            .map((n) => byN.get(n))
            .filter((v): v is string => !!v)
        )
      );
      if (nombres.length >= 2) {
        result.push({ ...original, prendas: nombres });
        repaired++;
      } else {
        // Reparación inválida (devolvió basura): conserva el original, no lo pierdas.
        result.push(original);
      }
    }

    // Piso de seguridad: si el juez dejó el viaje vacío (todo rechazado), es más
    // probable un error del juez que un viaje sin un solo look válido → conserva
    // los originales antes que mostrar cero.
    if (result.length === 0) return { outfits, repaired: 0, dropped: 0 };
    return { outfits: result, repaired, dropped };
  } catch {
    return { outfits, repaired: 0, dropped: 0 };
  }
}
