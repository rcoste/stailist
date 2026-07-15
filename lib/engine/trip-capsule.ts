import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, FORMALIDADES, type CapsuleItem, type CapsuleTarget } from "@/lib/capsule";
import { SEASONS, seasonMetal, seasonPalette, type Season } from "@/lib/colorimetria";
import {
  occasionLabels,
  luggageCapacity,
  luggageSummary,
  type Bolsas,
  type Luggage,
  type Occasion,
  type TripWeather,
} from "@/lib/trip";

// Ancla: prenda del clóset que la persona YA decidió llevar. El motor NO la
// lista (el caller la agrega al target); solo arma el resto alrededor.
export type TripAncla = {
  nombre: string;
  tipo?: string | null;
  category?: string | null;
  color?: string | null;
  formalidad?: string | null;
  temporada?: string | null;
};

export type TripCapsuleInputs = {
  days: number;
  ocasiones: Occasion[];
  maleta: Luggage | null; // legacy / back-compat
  bolsas: Bolsas | null; // multi-maleta: cantidades por tipo
  weather: TripWeather | null;
  // Multidestino: clima por parada. Si hay 2+, el motor empaca para todo el rango.
  paradas?: { lugar: string; weather: TripWeather | null }[];
  gender: "hombre" | "mujer" | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
  vetoes: string[];
  anclas?: TripAncla[];
  // Prendas del clóset que la persona ya rechazó en maletas anteriores (eventos
  // trip_item_swap). El motor evita armar ideales pensados para ellas.
  rechazadas?: string[];
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

  const multiParada = (inputs.paradas?.length ?? 0) > 1;
  const climaTxt = multiParada
    ? `Varias paradas con climas distintos — ${inputs
        .paradas!.map(
          (p) =>
            `${p.lugar}: ${
              p.weather
                ? `~${p.weather.temp_c}°C ${p.weather.condition}${p.weather.estimated ? " (típico)" : ""}`
                : "clima desconocido"
            }`
        )
        .join(
          "; "
        )}. Empaca UNA sola cápsula que funcione para TODAS las paradas: prioriza CAPAS y piezas versátiles que cubran el rango completo (de la más fría a la más calurosa), sin duplicar por parada.`
    : inputs.weather
      ? inputs.weather.estimated
        ? `~${inputs.weather.temp_c}°C (clima TÍPICO de la temporada, no pronóstico exacto — prioriza versatilidad y capas que aguanten variación)`
        : `${inputs.weather.temp_c}°C, ${inputs.weather.condition}`
      : "desconocido (usa prendas versátiles, evita extremos)";
  const ocas = inputs.ocasiones.length ? occasionLabels(inputs.ocasiones) : "general";
  const capacidad = luggageCapacity(inputs.bolsas, inputs.maleta);
  const resumen = luggageSummary(inputs.bolsas, inputs.maleta);
  const techoTxt =
    capacidad > 0
      ? `Equipaje: ${resumen}. TECHO de ~${capacidad} prendas — no lo pases. Si el viaje pediría más, prioriza lo más versátil y recorta lo opcional.`
      : "Maleta no definida: mantén la cápsula mínima y versátil.";
  const vetoTxt = inputs.vetoes.length
    ? `VETOS — jamás incluyas: ${inputs.vetoes.join(", ")}.`
    : "";
  // Contabilidad por FUNCIÓN, no por conteo: un ancla solo descuenta una pieza
  // de su misma función (un top ancla = un top menos del motor). Accesorios
  // anclados NO reducen nada — no ocupan maleta ni cubren días. Sin esto, 4
  // anclas (2 accesorios) recortaban bottoms y el viajero quedaba con 1 pantalón
  // (bug real: maleta NY de Roberto, 2026-07-15).
  const anclasTxt = inputs.anclas?.length
    ? `ANCLAS — la persona YA decidió llevar estas prendas suyas (van seguras en la maleta): ${inputs.anclas
        .map(
          (a) =>
            `${a.nombre}${[a.category, a.color, a.formalidad].filter(Boolean).length ? ` (${[a.category, a.color, a.formalidad].filter(Boolean).join(", ")})` : ""}`
        )
        .join("; ")}. NO las repitas en tus items (el sistema las agrega aparte). Cómo cuentan: un ancla SOLO descuenta una pieza de su MISMA función (un top ancla = un top menos tuyo; un calzado ancla = un par menos). Las anclas de ACCESORIO (gorra, lentes, cinturón, joyería) NO descuentan nada: no ocupan maleta ni visten un día. JAMÁS recortes la base de tops/bottoms/calzado que los días piden por "hacer espacio" a las anclas. Arma el RESTO alrededor: que combine con ellas, sin duplicar su función. La firma puede mencionarlas.`
    : "";
  const rechazadasTxt = inputs.rechazadas?.length
    ? `YA RECHAZÓ ANTES — en maletas anteriores la persona pidió cambiar estas prendas suyas: ${inputs.rechazadas.join(
        "; "
      )}. No armes ideales cuyo cumplimiento natural sea una de ellas; propone otra dirección (otro color, otro corte u otra pieza) que cubra la misma función.`
    : "";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    // 3584: el "plan" (borrador de razonamiento del schema) consume tokens
    // antes de los items; 3072 quedaba justo en cápsulas grandes.
    max_tokens: 3584,
    system: `Eres la stylist de stailist. Armas la CÁPSULA DE VIAJE: la lista MÍNIMA de prendas que la persona debe llevar para que combinen entre sí y le cubran todos los días, sin sobre-empacar. Al final explicas tu lógica en una "firma" que la persona SÍ lee.

Cómo trabajas: PRIMERO llena el campo "plan" — tu borrador, la persona no lo ve. Ahí decide antes de listar: cuántas piezas pide este viaje (días × ocasiones × clima), qué 2-3 neutros anclan la maleta, qué acentos van, y qué pieza cubre cada ocasión. Verifica ahí la interoperabilidad: cada top debe funcionar con (casi) todos los bottoms — si una pieza solo arma UN look, gana su lugar por ocasión única o sale. DESPUÉS genera los items ejecutando ese plan.

REGLA INNEGOCIABLE DE GÉNERO: ${generoTxt}

Cómo dimensionarla:
- Es una cápsula de mezcla-y-combina: pocas piezas que dan muchos looks. NO una prenda por día.
- EL TAMAÑO LO MANDAN LOS DÍAS, no el techo de la maleta. Viaje corto (≤5 días) = cápsula CHICA aunque quepa más (orientación: ~3-4 tops, 2-3 bottoms, 1-2 calzado, más capas según el clima). Crece solo en viajes largos. El techo de la maleta solo RECORTA si te pasarías — JAMÁS rellenes hasta el techo "porque cabe": de más prendas que de menos es el error a evitar.
- PISO DE BOTTOMS (innegociable): JAMÁS un solo bottom para un viaje de 3+ días. Mínimo 2 bottoms en viajes de 3-4 días, 3 en viajes de 5-7 días. Si las ocasiones mezclan día relajado y noche/arreglarse, al menos UN bottom cómodo de día Y uno que suba de noche — el mismo bottom no carga solo con turistear, la noche y el traslado.
- PIENSA EN JORNADAS, no solo en prendas: el día de TRASLADO (avión/carretera: cómodo, capas), los días DE DÍA (caminar, turistear: pies y bottoms cómodos), y las NOCHES (subir el look). Cada jornada del viaje debe tener con qué vestirse sin forzar una pieza a todo.
- Dimensiona también a la MEZCLA DE OCASIONES (ej. playa pide trajes de baño y shorts; una noche de arreglarse pide una pieza más formal). Cubre todas las ocasiones que te pasen, pero comparte piezas entre ellas siempre que se pueda.
- Prendas que se mojan/sudan y necesitan secar entre usos: si el viaje es de PLAYA/ALBERCA/AGUA y dura varios días, lleva 2 trajes de baño (uno se seca mientras usas el otro); para deporte intenso de varios días, 2 piezas técnicas. No apliques esto a prendas normales (ahí manda mezcla-y-combina).
- Respeta el CLIMA: calor → ligero y fresco; frío → capas y abrigo. No metas abrigo si hace calor ni shorts si hace frío. LLUVIA/HÚMEDO → incluye una capa que repela el agua y evita materiales que se arruinan mojados (gamuza, lino delicado). AIRE LIBRE o clima rudo → prioriza prendas resistentes y calzado práctico (nada de zapato de vestir ni gamuza para caminar o mojarse). Piensa en el RANGO del día, no solo el promedio: mañanas/noches más frescas e interiores con clima artificial piden una capa ligera aunque el día sea cálido.
- CALZADO es lo que más pesa y abulta: máximo 2 pares en viajes cortos (3 solo si una ocasión lo exige de verdad), y el segundo par debe cubrir algo que el primero no.
- La capa más voluminosa (abrigo, chamarra gruesa) se VIAJA PUESTA, no empacada — cuenta para el look del traslado, no para el espacio de la maleta.
- ${techoTxt}
- Incluye SIEMPRE la base: tops, bottoms y calzado suficientes para combinar; ropa interior/calcetines NO se listan (se asumen).

Aterriza a la persona:
- COLORIMETRÍA: nombra colores de su paleta; nunca un color de su EVITA. ${metalTxt}
- Su estilo y gustos definen la vibra.
- ${vetoTxt}

Devuelve "items" (la cápsula). Cada prenda:
- nombre: etiqueta humana y específica con color. Ej "Traje de baño negro", "Short de lino beige".
- tipo: clave corta normalizada sin color. Ej "traje-de-bano", "short", "playera", "sandalias".
- category ∈ {${CATEGORIES.join(", ")}} — 'saco' para sacos/blazers/sastrería (formal por ocasión); 'abrigo' SOLO capas por clima. Un traje = 'saco' + pantalón 'bottom' aparte.
- colorFamilia: color en familia simple, dentro de su paleta.
- formalidad ∈ {${FORMALIDADES.join(", ")}}
- temporada: "todo-el-año" | "calor" | "frio".
- prioridad: 1 = imprescindible para el viaje, subiendo a lo opcional.
- porque: UNA línea cálida (tuteo) de por qué la lleva — específica a ESTE viaje (su ocasión, su clima, con qué se mezcla), no genérica.

Al final devuelve "firma": 1-2 líneas cálidas (tuteo) que expliquen la LÓGICA de la maleta completa — la estrategia (los neutros que anclan, los acentos), cómo todo se mezcla entre sí, y cómo cubre las ocasiones y el clima. Es lo primero que la persona lee arriba de su maleta. No listes prendas una por una ni repitas números que ya ve (días, conteo).`,
    messages: [
      {
        role: "user",
        content: `VIAJE: ${inputs.days} día(s). Ocasiones: ${ocas}. Clima: ${climaTxt}.\n${techoTxt}\n\nESTILO: ${estilo}\nTags: ${tags}\nCOLORIMETRÍA: ${paletaTxt} ${metalTxt}\n${vetoTxt}${anclasTxt ? `\n${anclasTxt}` : ""}${rechazadasTxt ? `\n${rechazadasTxt}` : ""}\n\nArma su cápsula de viaje (items).`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            // PRIMERO en el schema a propósito: el modelo genera el plan antes
            // que los items → espacio de razonamiento. El caller lo ignora.
            plan: {
              type: "string",
              description:
                "Tu borrador de trabajo (la persona NO lo ve; 3-6 líneas, MÁXIMO 6): cuántas piezas pide el viaje (días × ocasiones × clima), los 2-3 neutros ancla, los acentos, y qué pieza cubre cada ocasión. Decide esto ANTES de listar prendas.",
            },
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
            // DESPUÉS de items a propósito: la firma se escribe con la lista ya
            // decidida (resume la estrategia real, no una intención).
            firma: {
              type: "string",
              description:
                "1-2 líneas cálidas (tuteo) con la lógica de la maleta: estrategia de mezcla, ocasiones y clima. La persona la lee arriba de su maleta.",
            },
          },
          required: ["plan", "items", "firma"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  // Truncado por tope de tokens = JSON incompleto; error distinguible.
  if (response.stop_reason === "max_tokens") throw new Error("TRUNCATED_RESPONSE");
  const parsed = JSON.parse(text) as { items: CapsuleItem[]; firma?: string };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("BAD_TRIP_CAPSULE");
  }
  const items = parsed.items
    .slice()
    .sort((a, b) => a.prioridad - b.prioridad)
    .map((it, i) => ({ ...it, prioridad: i + 1 }));
  const firma = parsed.firma?.trim();
  return firma ? { version: 2, items, firma } : { version: 2, items };
}
