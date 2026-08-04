import { ENGINE_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import { OCCASIONS, occasionLabels, type Occasion, type TripOutfit } from "@/lib/trip";
import { SEASONS, seasonPalette, normSeason, type Season } from "@/lib/colorimetria";
import { JUDGE_MODEL } from "@/lib/engine/critic";
import { tasteSignalLines } from "@/lib/engine/prompt";
import { hasTasteSignal, type TasteSignal } from "@/lib/engine/taste-signal";

// Una prenda empacable, numerada para el prompt. El LLM referencia prendas por
// `n` (nunca inventa nombres ni IDs); el motor mapea de vuelta a `nombre`.
export type PackableItem = {
  n: number;
  nombre: string; // nombre de la prenda del clóset (lo que se guarda y se renderea)
  category: string;
  color: string;
  formalidad: string;
  // Datos ricos de la prenda REAL del clóset (opcionales — las cápsulas viejas
  // no los traen): dejan al motor juzgar color/clima/estampado de verdad.
  hex?: string | null; // color real de la tela (no la familia ideal)
  temporada?: string | null; // "calor" | "frio" | "todo-el-año"…
  material?: string | null; // "lana", "lino"… — clima y peso de tela
  patron?: string | null; // liso/rayas/… — evita dos estampados que pelean
  color_secundario?: string | null; // segundo color si es bicolor/estampada
};

// Una prenda como línea de prompt: color real (con hex si lo hay) + señales de
// clima y estampado. Compartida por el generador y el juez.
export function packableDesc(p: PackableItem, withCategory = false): string {
  let color = p.hex ? `${p.color} ${p.hex}` : p.color;
  if (p.color_secundario) color += ` con ${p.color_secundario}`;
  const detalle = [
    withCategory ? p.category : null,
    p.formalidad,
    color,
    p.material ?? null,
    // "estampado" a secas ya es el patrón genérico — sin duplicar el prefijo.
    p.patron && p.patron !== "liso" && p.patron !== "estampado"
      ? `estampado ${p.patron}`
      : p.patron,
    p.temporada && p.temporada !== "todo-el-año" ? `para ${p.temporada}` : null,
  ].filter(Boolean);
  return `${p.n}. ${p.nombre} (${detalle.join(", ")})`;
}

// Colorimetría como línea de prompt (regla near-face). null si no está definida.
// normSeason rescata data legacy con mayúscula ("Invierno") — sin normalizar,
// SEASONS[season] es undefined y truena la generación (learning 2026-06-29).
function paletaText(
  season: Season | null | undefined,
  flow: Season | null | undefined
): string | null {
  const key = normSeason(season);
  if (!key) return null;
  const { mejores, prestados, evita } = seasonPalette(key, flow ?? null);
  const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
  const avoid = evita.map((c) => c.nombre).join(", ");
  return `Su colorimetría: paleta tipo ${SEASONS[key].label}. Le favorecen cerca de la cara: ${favs}. EVITA cerca de la cara (la apagan): ${avoid}.`;
}

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
  ageStyling?: string | null; // orientación por edad (life-stage); señal suave, solo extremos
  // Colorimetría (regla near-face, como en el motor de Hoy). Opcional: sin
  // estación definida los looks salen sin esa regla, como antes.
  season?: Season | null;
  flow?: Season | null;
  // "Generar más": conjuntos de prendas (por nombre) que YA se mostraron. El
  // motor los salta y le pide a la IA combinaciones DISTINTAS — más con lo mismo.
  exclude?: string[][];
  // Texto libre del viaje (qué va a hacer): afina qué looks destacar y su porqué.
  contexto?: string | null;
  // v24 — señales de estilo que antes NO llegaban a viaje:
  vetoes?: string[]; // hard NOs: jamás en un look (regla dura, generador Y juez)
  styleReference?: string | null; // estilo de referencia (vibe/siluetas, no color)
  styleWords?: string | null; // su estilo en sus palabras (perfil)
  tasteSignal?: TasteSignal; // feedback real (worn/votos) — señal suave
};

// Tope de celdas de la rejilla que mandamos a validar (una maleta real cae muy
// por debajo; este es el cinturón para clósets-empacables grandes).
const MAX_CELLS = 40;
// Tope de looks que mostramos (la rejilla puede dar muchos; curamos los distintos).
const MAX_LOOKS = 16;
// Presupuesto de vestidos dentro de la rejilla: techo de celdas de vestido y
// cuántos calzados distintos probamos por vestido.
const MAX_DRESS_CELLS = 12;
const MAX_SHOES_PER_DRESS = 3;

// (El recorte de slots capProduct se eliminó: dejaba prendas empacadas con CERO
// celdas — "la app ignoró mi vestido". Ahora la enumeración cubre cada prenda
// con ≥1 celda vía round-robin y rellena con el producto completo hasta el
// presupuesto. La garantía aplica a slots COMPLETOS (separables necesitan
// top+bottom; un top sin ningún bottom no puede formar look) y se degrada en
// casos irreales para una maleta: >12 vestidos encogen el presupuesto de
// separables, y un slot con más prendas que el presupuesto no alcanza a cubrir
// las últimas. Una maleta real (~10-25 prendas) queda muy por debajo.)

// Una celda base de la rejilla: números de prenda + tipo (separables o vestido).
export type TripGridCell = { base: number[]; kind: "sep" | "vestido" };

// Enumera las celdas base de la rejilla (pura, sin IA — testeable). Dos pasadas
// por sección: (1) round-robin para que CADA prenda aparezca en al menos una
// celda (antes el recorte dejaba prendas con cero looks), y (2) relleno con el
// producto completo, en orden de prioridad, hasta el tope MAX_CELLS.
export function buildTripGrid(packable: PackableItem[]): TripGridCell[] {
  const bySlot = (cat: string) => packable.filter((p) => p.category === cat);
  const tops = bySlot("top");
  const bottoms = bySlot("bottom");
  const calzado = bySlot("calzado");
  const vestidos = bySlot("vestido");

  const cells: TripGridCell[] = [];
  const seenCells = new Set<string>();
  const pushCell = (base: number[], kind: "sep" | "vestido") => {
    const key = base.join("-");
    if (seenCells.has(key)) return;
    seenCells.add(key);
    cells.push({ base, kind });
  };

  // Presupuesto: los vestidos reservan hasta 12 celdas (nunca menos de 1 por
  // vestido); el resto va a separables.
  const shoeN = Math.max(1, calzado.length);
  const dressWanted = vestidos.length * Math.min(shoeN, MAX_SHOES_PER_DRESS);
  const dressBudget = Math.min(dressWanted, Math.max(MAX_DRESS_CELLS, vestidos.length));
  const sepBudget = Math.max(0, MAX_CELLS - dressBudget);

  if (tops.length && bottoms.length && sepBudget > 0) {
    const Shoes: (PackableItem | null)[] = calzado.length ? calzado : [null];
    // Pasada 1 — cobertura: cada top, bottom y calzado entra en ≥1 celda.
    const maxLen = Math.max(tops.length, bottoms.length, Shoes.length);
    for (let i = 0; i < maxLen && cells.length < sepBudget; i++) {
      const t = tops[i % tops.length];
      const b = bottoms[i % bottoms.length];
      const s = Shoes[i % Shoes.length];
      pushCell([t.n, b.n, ...(s ? [s.n] : [])], "sep");
    }
    // Pasada 2 — relleno: producto completo por prioridad hasta el presupuesto.
    outer: for (const t of tops)
      for (const b of bottoms)
        for (const s of Shoes) {
          if (cells.length >= sepBudget) break outer;
          pushCell([t.n, b.n, ...(s ? [s.n] : [])], "sep");
        }
  }

  // Vestidos: cobertura primero (cada vestido ≥1 celda), luego más calzados.
  const dressShoes: (PackableItem | null)[] = calzado.length
    ? calzado.slice(0, MAX_SHOES_PER_DRESS)
    : [null];
  const dressCap = cells.length + dressBudget;
  for (let i = 0; i < vestidos.length && cells.length < dressCap; i++) {
    const s = dressShoes[i % dressShoes.length];
    pushCell([vestidos[i].n, ...(s ? [s.n] : [])], "vestido");
  }
  dressOuter: for (const v of vestidos)
    for (const s of dressShoes) {
      if (cells.length >= dressCap) break dressOuter;
      pushCell([v.n, ...(s ? [s.n] : [])], "vestido");
    }

  return cells.slice(0, MAX_CELLS); // backstop duro
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
// ayuda. Garantiza cobertura por PRENDA (cada pieza empacada aparece en ≥1
// celda; con maletas grandes el tope recorta combinaciones, nunca prendas) y
// maximiza los looks por prenda — el premio de empacar ligero.
export async function generateTripOutfits(
  inputs: TripOutfitInputs
): Promise<TripOutfit[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");
  if (inputs.packable.length < 2) return [];

  // --- 1. Slots de "extra" (fuera de la rejilla base) ---
  const bySlot = (cat: string) => inputs.packable.filter((p) => p.category === cat);
  const capas = bySlot("abrigo");
  const sacos = bySlot("saco");
  const accesorios = bySlot("accesorio");

  // Sacos (formal por ocasión), capas (clima) y accesorios pueden sumarse como
  // "extra" a un look base — así los combos formales sí reciben su saco.
  const extraOk = new Set([...sacos, ...capas, ...accesorios].map((p) => p.n));

  // --- 2. Enumera las celdas (combinaciones base), con COBERTURA garantizada ---
  const grid = buildTripGrid(inputs.packable);
  // Sin separables completos ni vestidos → no hay rejilla que armar.
  if (grid.length === 0) return [];

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
  const edadTxt = inputs.ageStyling ? `\n${inputs.ageStyling}` : "";
  const paleta = paletaText(inputs.season, inputs.flow);
  const paletaTxt = paleta ? `\nCOLORIMETRÍA: ${paleta}` : "";
  const contextoTxt = inputs.contexto
    ? `\nCONTEXTO DEL VIAJE (lo que va a hacer, en sus palabras): "${inputs.contexto}". Prioriza y titula looks que sirvan para ese plan; si una prenda es clave para eso (un jersey para un partido, algo pulido para una boda), procura que aparezca en al menos un look y dilo en el porqué.`
    : "";
  const refTxt = inputs.styleReference
    ? `\nESTILO DE REFERENCIA que le encanta (inspira el vibe y las siluetas, NO los colores): ${inputs.styleReference}.`
    : "";
  const palabrasTxt = inputs.styleWords?.trim()
    ? `\nSU ESTILO EN SUS PALABRAS: "${inputs.styleWords.trim().slice(0, 280)}" — respétalo al elegir y titular looks (las REGLAS DURAS — vetos, rejilla, clima — siempre están por encima).`
    : "";
  const feedbackTxt =
    inputs.tasteSignal && hasTasteSignal(inputs.tasteSignal)
      ? `\n${tasteSignalLines(inputs.tasteSignal).join("\n")}`
      : "";
  const vetoSystemTxt = inputs.vetoes?.length
    ? ` REGLA DURA — VETOS: la persona NUNCA quiere: ${inputs.vetoes.join(", ")}. Descarta cualquier celda que los incluya; jamás los pongas en "extra".`
    : "";

  const prendasTxt = inputs.packable.map((p) => packableDesc(p)).join("\n");
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
    model: ENGINE_MODEL,
    max_tokens: 4096,
    system: `Eres la stylist de stailist. La MALETA ya está hecha. Te doy la REJILLA de combinaciones posibles de lo que la persona empaca (cada celda es un top+bottom+calzado, o un vestido+calzado, ya enumerados). Tu trabajo es VALIDAR cada celda y quedarte con los looks que de verdad funcionan.

REGLA INNEGOCIABLE: trabajas SOLO con las celdas y prendas dadas, por número. Jamás inventes una prenda ni una combinación fuera de la rejilla. En "extra" SOLO puedes poner números de capas (${capasTxt}) o accesorios (${accTxt}); nada más. ${generoTxt}${vetoSystemTxt}

Por cada celda decide si es un OUTFIT real:
- Coherencia de color: los tonos combinan (no choca) — juzga por el hex cuando la prenda lo traiga, es su color real. Máximo UN estampado protagonista por look; dos estampados juntos casi nunca funcionan.
- Si te doy su COLORIMETRÍA: lo que toca la cara (top, abrigo, vestido) debe favorecerla o ser un neutro; JAMÁS un color de su lista EVITA cerca de la cara (en bottom o calzado no importa).
- Formalidad pareja y apropiada para alguna ocasión del viaje.
- Respeta el CLIMA (no lana en calor, no lino fresco en frío — usa el material cuando la prenda lo traiga). Si el clima es FRÍO (≤12°C), cada look debe llevar abrigo o capa de verdad — descarta los que queden en una sola capa ligera (camiseta sola, camisa sola sin abrigo). Si hay rango de temperaturas, cada look debe aguantar la MÁS FRÍA.
- Si la celda no funciona (colores que pelean, formalidad incompatible), DESCÁRTALA.

Para las celdas que SÍ funcionan:
- Asígnale UNA ocasión del viaje (clave exacta).
- Opcional: súmale en "extra" UNA capa y/o UN accesorio si la mejora (solo de las listas de arriba) — y solo si la capa cae con lógica de vida real sobre ese look (saco sobre camisa o playera, sí; capa gruesa sobre suéter grueso o chaleco sastre sobre suéter, NO: nadie sale así).
- titulo: nombre corto y evocador (tuteo, cálido). Ej "Cena junto al mar".
- porque: UNA línea de por qué funciona.
- tip ("el toque"): OPCIONAL — UN movimiento de styling para llevar ESE look mejor (medio fajado, mangas arremangadas, capa abierta…), concreto y seguro, una frase. SOLO sobre prendas que están en ESE look; NUNCA menciones ni sugieras añadir una prenda que no está en él. Cadena vacía si el look ya está completo y no hay un toque que lo eleve. NO en todos los looks; mejor sin tip que uno forzado.
- Evita looks casi idénticos: si dos celdas dan prácticamente el mismo look, deja solo el mejor.
- Maximiza la VARIEDAD útil entre las ocasiones del viaje (no 6 looks para la misma ocasión si hay otras sin cubrir).
- COBERTURA (regla dura): CADA ocasión del viaje debe recibir AL MENOS un look si existe alguna celda que funcione para ella. Jamás dejes una ocasión vacía por darle más variedad a otra — un día del viaje sin propuesta es el peor resultado.
- Devuelve A LO MÁS ${MAX_LOOKS} looks, los mejores y más variados.`,
    messages: [
      {
        role: "user",
        content: `OCASIONES: ${ocasTxt}.\nCLIMA: ${climaTxt}.\nESTILO: ${estilo}. Tags (en orden de fuerza): ${tags}.${cuerpoTxt}${edadTxt}${paletaTxt}${refTxt}${palabrasTxt}${contextoTxt}${feedbackTxt}\n\nPRENDAS (número. nombre (atributos)):\n${prendasTxt}\n\nREJILLA DE CELDAS A VALIDAR:\n${celdasTxt}${excludeTxt}\n\nValida la rejilla y devuelve los looks que funcionan.`,
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
  // Truncado por tope de tokens = JSON incompleto; error distinguible.
  if (response.stop_reason === "max_tokens") throw new Error("TRUNCATED_RESPONSE");
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
    .map((p) => packableDesc(p, true))
    .join("\n");
  const capasTxt = capas.length ? capas.map((p) => p.n).join(", ") : "ninguna";
  const accTxt = accesorios.length ? accesorios.map((p) => p.n).join(", ") : "ninguno";
  const climaTxt = climaText(inputs.weather);
  const paleta = paletaText(inputs.season, inputs.flow);
  const paletaTxt = paleta ? `\n\nCOLORIMETRÍA: ${paleta}` : "";
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

COMBINACIÓN: color coherente (máx 1-2 protagonistas + neutros, el resto neutros — juzga por el hex cuando la prenda lo traiga), máximo UN estampado protagonista por look, formalidad pareja, apropiado para su ocasión. Marino + negro SÍ combinan. Si te doy su COLORIMETRÍA, lo near-face (top/abrigo/vestido) jamás lleva un color de su EVITA.

REGLAS:
- Trabaja SOLO con números de la lista de prendas. Jamás inventes.
- "extra"/capas/accesorios válidos para sumar: capas ${capasTxt}; accesorios ${accTxt}.
${inputs.vetoes?.length ? `- VETOS (regla absoluta, por encima de todo): la persona NUNCA quiere ${inputs.vetoes.join(", ")}. Si un look incluye algo vetado, repáralo cambiando esa prenda; si no hay arreglo, recházalo y marca "veto": true en esa revisión.\n` : ""}- En cada revisión, "veto" es true SOLO si el rechazo es por un veto de la persona; en cualquier otro caso (incluidos "ok" y "reparado"), false.
- Prefiere REPARAR sobre rechazar. Rechaza solo si de verdad no hay arreglo.
- En "prendas" de cada revisión, devuelve SIEMPRE la lista de números del look final (para "ok" repite la original; para "reparado" la nueva; para "rechazado" puede ir vacía).`;

  const userMsg = `CLIMA: ${climaTxt}.${paletaTxt}

PRENDAS DE LA MALETA (número. nombre (atributos)):
${prendasTxt}

LOOKS A REVISAR:
${looksTxt}

Revisa cada look (por su L#) y devuelve un veredicto por cada uno.`;

  try {
    const client = new Anthropic({ maxRetries: 3 });
    const response = await client.messages.create({
      // Juez compartido (ver JUDGE_MODEL en critic.ts): rápido y barato para la
      // 2ª pasada (el caso principal, sub-abrigo, no necesita Opus) y deja
      // holgura bajo el límite de 60s de la función.
      model: JUDGE_MODEL,
      // 4096: tokenizer de Sonnet 5 (~30% más tokens que 4.6) × hasta 16
      // revisiones con listas de prendas — 3072 arriesgaba truncar y el catch
      // devolvería los looks sin revisar, en silencio.
      max_tokens: 4096,
      thinking: { type: "disabled" },
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
                    // true SOLO en rechazos por veto: campo estructurado para que
                    // la restauración de cobertura no dependa de parsear prosa.
                    veto: { type: "boolean" },
                    prendas: { type: "array", items: { type: "integer" } },
                  },
                  required: ["index", "veredicto", "razon", "veto", "prendas"],
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
        veto?: boolean;
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
    // v24: el juez no puede dejar una ocasión huérfana — si una ocasión tenía
    // looks y sus rechazos la vaciaron, se restaura el mejor original de esa
    // ocasión (mejor un look imperfecto que un día del viaje sin propuesta).
    // EXCEPTO los rechazados por VETO: el veto es regla absoluta y gana a la
    // cobertura — un look vetado jamás se resucita. Señal primaria: el campo
    // estructurado `veto` del schema; el regex sobre la razón queda solo como
    // red por si el modelo lo dejara en false y aun así nombrara el veto.
    const vetoedIdx = new Set(
      (parsed.revisiones ?? [])
        .filter(
          (r) =>
            r.veredicto === "rechazado" &&
            (r.veto === true || /veto/i.test(r.razon ?? ""))
        )
        .map((r) => r.index)
    );
    const restored = keepOccasionCoverage(outfits, result, vetoedIdx);
    return {
      outfits: restored,
      repaired,
      dropped: dropped - (restored.length - result.length),
    };
  } catch {
    return { outfits, repaired: 0, dropped: 0 };
  }
}

// Pura y testeable: garantiza que ninguna ocasión cubierta ANTES del juez quede
// sin looks DESPUÉS. Por cada ocasión huérfana, restaura el primer look original
// de esa ocasión (los originales vienen en orden de calidad del generador). El
// orden relativo del resto no cambia. `excludeIdx` (índices en `before`) marca
// looks NO restaurables — los rechazados por veto: el veto gana a la cobertura.
export function keepOccasionCoverage(
  before: TripOutfit[],
  after: TripOutfit[],
  excludeIdx: Set<number> = new Set()
): TripOutfit[] {
  const covered = new Set(after.map((o) => o.ocasion));
  const restored = [...after];
  before.forEach((o, i) => {
    if (!covered.has(o.ocasion) && !excludeIdx.has(i)) {
      restored.push(o);
      covered.add(o.ocasion);
    }
  });
  return restored;
}
