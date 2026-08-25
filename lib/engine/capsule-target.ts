import { ENGINE_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import {
  ASSESSMENT_QUESTIONS,
  CATEGORIES,
  FORMALIDADES,
  type AssessmentQuestion,
  type CapsuleItem,
  type CapsulePilar,
  type CapsuleTarget,
  type LifestyleAnswers,
} from "@/lib/capsule";
import { SEASONS, seasonMetal, seasonPalette, type Season } from "@/lib/colorimetria";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { REGLA_PRENDAS_REALES, tasteSignalLines } from "@/lib/engine/prompt";
import { hasTasteSignal, type TasteSignal } from "@/lib/engine/taste-signal";

export type CapsuleInputs = {
  answers: LifestyleAnswers;
  gender: "hombre" | "mujer" | null;
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
  build: Build | null;
  volume: Volume | null;
  styleReference?: string | null; // resumen del "estilo de referencia" (vibe/silueta, NO color)
  // Vetos duros (labels): prendas/colores/detalles que NUNCA debe proponer. Vienen
  // de style_vetoes (incluye lo que la usuaria descartó de su cápsula, issue #89).
  vetoes?: string[];
  // Preguntas del assessment (fijas + las personalizadas de su estilo). Si no se
  // pasan, usa solo las fijas. Define qué se renderiza en el bloque "vida".
  questions?: AssessmentQuestion[];
  // v24 — señales que antes NO llegaban a la cápsula:
  styleWords?: string | null; // su estilo en sus palabras (perfil)
  tasteSignal?: TasteSignal; // feedback real (worn/votos) — señal suave
  ageStyling?: string | null; // orientación por edad (life-stage) — señal suave, solo extremos
  /** Cuánto color quiere llevar, si lo ELIGIÓ (lib/looks.ts). Decide DÓNDE
   *  viven sus acentos en la cápsula, no cuántos. */
  acentoApetito?: import("@/lib/looks").ApetitoAcentos | null;
};

/**
 * UN TRAJE SON DOS PIEZAS, y el modelo a veces manda una.
 *
 * El prompt lo dice desde siempre ("un traje va como 'saco' + su pantalón
 * 'bottom' aparte") y aun así devolvió "Traje de lana azul marino" como un
 * solo item de categoría `saco` — Roberto lo cazó al ver que su tile traía
 * saco Y pantalón en la misma foto (2026-08-25).
 *
 * NO ES COSMÉTICO, y por eso se arregla en código en vez de insistir en el
 * prompt: (1) la lista dice 39 piezas cuando en realidad son 40; (2) el
 * pantalón del traje no existe como hueco, así que el motor nunca lo tendrá
 * para armar un look formal; (3) el match contra el clóset compara UN item
 * contra DOS prendas reales (el saco y el pantalón, que se dan de alta por
 * separado) y no puede cubrirlo bien.
 *
 * La partición es DETERMINISTA —el pantalón de un traje marino es un pantalón
 * de traje marino, no hay criterio que elegir— así que va aquí y no al juez.
 * Hereda color, formalidad, temporada y prioridad; el `porque` del pantalón
 * se reescribe para que no repita el del saco palabra por palabra.
 */
export function partirTrajes(items: CapsuleItem[]): CapsuleItem[] {
  const esTraje = (it: CapsuleItem) =>
    /(^|[^a-z])traje([^a-z]|$)/i.test(`${it.tipo} ${it.nombre}`) &&
    !/ba[ñn]o/i.test(`${it.tipo} ${it.nombre}`) && // el traje de BAÑO no se parte
    it.category === "saco";
  // ¿La lista YA trae el pantalón de ese traje? Pasa: el modelo a veces manda
  // el traje entero Y su pantalón por separado. Sin este chequeo la partición
  // creaba un duplicado — lo cazó el dry run del backfill, no un test.
  const yaHayPantalon = (color: string) =>
    items.some(
      (o) =>
        o.category === "bottom" &&
        o.colorFamilia === color &&
        /pantal[oó]n/i.test(o.nombre) &&
        /traje|vestir|sastre/i.test(`${o.tipo} ${o.nombre}`)
    );

  const salida: CapsuleItem[] = [];
  for (const it of items) {
    if (!esTraje(it)) {
      salida.push(it);
      continue;
    }
    const color = it.colorFamilia;
    salida.push({
      ...it,
      // El "(saco)" que a veces trae el nombre sobra en cuanto la pieza YA se
      // llama saco.
      nombre: it.nombre.replace(/^traje/i, "Saco de traje").replace(/\s*\(saco\)\s*$/i, ""),
      tipo: "saco-de-traje",
      hueco: "saco de traje",
    });
    if (yaHayPantalon(color)) continue;
    salida.push({
      ...it,
      nombre: `Pantalón de traje ${color}`,
      tipo: "pantalon-de-traje",
      category: "bottom",
      hueco: "pantalón de traje",
      porque: `Es la otra mitad del traje ${color}: juntos son tu traje completo, y suelto te sirve de pantalón de vestir.`,
    });
  }
  return salida;
}

/**
 * DÓNDE deben caer los acentos de la cápsula, según lo que la persona ELIGIÓ
 * en el grid de acentos (docs/designs/pantalla-apetito-acentos.md).
 *
 * NO cambia CUÁNTOS acentos lleva la cápsula —eso es el 70/30 de la paleta—
 * sino en qué CLASE de prenda viven, que es lo que decide si sus looks salen
 * discretos o con el color mandando. Pura y exportada para poder probarla: lo
 * que blinda no es el formato sino que un "discreto" no reciba tres suéteres
 * de color.
 */
export function lineaAcentosCapsula(
  apetito: import("@/lib/looks").ApetitoAcentos | null
): string {
  if (apetito === "discreto")
    return "\n- ELLA PREFIERE EL COLOR EN DOSIS CHICAS (lo eligió viendo fotos): sus acentos van CASI TODOS en piezas chicas; los tops, abrigos y pantalones de la cápsula van en neutros o en tonos profundos y apagados. Como mucho UNA pieza grande de color en toda la lista.";
  if (apetito === "protagonista")
    return "\n- ELLA QUIERE QUE EL COLOR SE VEA (lo eligió viendo fotos): además de las piezas chicas, dale 2-3 piezas GRANDES de color (un suéter, un abrigo, un pantalón) — son las que van a mandar en sus looks. Siguen valiendo la regla de 3 y sus neutros como base.";
  if (apetito === "medio")
    return "\n- ELLA QUIERE UNA PIEZA DE COLOR POR LOOK (lo eligió viendo fotos): reparte los acentos entre piezas chicas y UNA o DOS medianas cerca de la cara (suéter, camisa, polo).";
  return "";
}

/**
 * El bloque "vida" del prompt: una línea por pregunta contestada, con la
 * pregunta y lo que eligió. Pura y exportada para poder probarla — lo que
 * blinda no es el formato sino QUÉ frase le llega al motor: cuando una
 * pregunta trae `promptLabel`, manda esa y no la de la pantalla (ver el porqué
 * en lib/capsule.ts). Las preguntas sin contestar no ocupan línea.
 */
export function bloqueVida(
  questions: AssessmentQuestion[],
  answers: LifestyleAnswers
): string {
  return questions
    .map((q) => {
      const raw = answers[q.id];
      if (!raw) return null;
      const vals = q.multi ? raw.split(",").filter(Boolean) : [raw];
      const labels = vals
        .map((v) => q.options.find((o) => o.value === v)?.label)
        .filter(Boolean);
      return labels.length ? `- ${q.promptLabel ?? q.label} → ${labels.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

// CAPA 1 — la cápsula IDEAL: una lista de prendas concretas y nombradas que
// ESA persona debería tener, mezclando lo que su vida exige con quién es cuando
// elige, y aterrizada a su paleta de color. Libre del catálogo (puede pedir
// prendas que no tenemos). Se llama una vez al guardar/editar el assessment.
export async function generateCapsuleTarget(
  inputs: CapsuleInputs
): Promise<CapsuleTarget> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");

  const client = new Anthropic();

  const vida = bloqueVida(inputs.questions ?? ASSESSMENT_QUESTIONS, inputs.answers);

  let paletaTxt = "No definida (usa neutros versátiles).";
  if (inputs.season) {
    const { mejores, prestados, evita } = seasonPalette(inputs.season, inputs.flow);
    const favs = [...mejores, ...prestados];
    // El flow puede "rescatar" un color que la base EVITA (ej. invierno evita
    // oliva, pero su flow otoño lo ama). No lo prohíbas si ya es favorable: si no,
    // el prompt se contradice ("le favorece oliva" + "evita oliva") y el modelo
    // duda. Match por familia = primer token del nombre ("Oliva apagado" → oliva).
    const fam = (n: string) => n.toLowerCase().split(/\s+/)[0];
    const favFams = new Set(favs.map((c) => fam(c.nombre)));
    const avoid = evita.filter((c) => !favFams.has(fam(c.nombre)));
    const favsTxt = favs.map((c) => c.nombre).join(", ");
    const avoidTxt = avoid.map((c) => c.nombre).join(", ");
    paletaTxt = `Paleta ${SEASONS[inputs.season].label}. Le favorecen: ${favsTxt}. EVITA: ${avoidTxt}.`;
  }
  const metal = seasonMetal(inputs.season, inputs.flow);
  const metalTxt = `Su metal es ${metal.toUpperCase()}: en accesorios metálicos (reloj, hebilla, joyería) usa SIEMPRE ${metal}, nunca ${metal === "oro" ? "plata" : "oro"}.`;
  const siluetaLine = siluetaPromptLine(inputs.build, inputs.volume);
  const vetosTxt = inputs.vetoes && inputs.vetoes.length
    ? `\n\nVETOS DUROS (regla innegociable): la persona NO quiere estas prendas/colores/detalles — JAMÁS los propongas ni una variante cercana: ${inputs.vetoes.join(", ")}.`
    : "";

  const estilo = inputs.archetype
    ? `"${inputs.archetype.nombre}" — ${inputs.archetype.descripcion}`
    : "sin definir";
  const tags = inputs.tasteTags.length ? inputs.tasteTags.join(", ") : "sin tags";
  const refTxt = inputs.styleReference
    ? `\nESTILO DE REFERENCIA que le encanta (inspira el VIBE y las siluetas de la cápsula, NO los colores — la colorimetría de abajo manda el color): ${inputs.styleReference}. Empuja la cápsula hacia ese aire sin copiarlo literal.`
    : "";
  const palabrasTxt = inputs.styleWords?.trim()
    ? `\nSU ESTILO EN SUS PALABRAS: "${inputs.styleWords.trim().slice(0, 280)}" — la señal más directa de quién es; si contradice los tags, sus palabras mandan (pero las REGLAS DURAS — vetos, género — siempre están por encima).`
    : "";
  const feedbackTxt =
    inputs.tasteSignal && hasTasteSignal(inputs.tasteSignal)
      ? `\n${tasteSignalLines(inputs.tasteSignal).join("\n")}`
      : "";
  const acentoTxt = lineaAcentosCapsula(inputs.acentoApetito ?? null);

  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: TODA la cápsula es ropa de hombre. Jamás propongas prendas de mujer (faldas, vestidos, blusas, tacones, etc.)."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: TODA la cápsula es ropa de mujer. Jamás propongas prendas pensadas solo para hombre."
        : "Género no definido: usa prendas neutras/unisex.";

  const response = await client.messages.create({
    model: ENGINE_MODEL,
    // ~25-40 prendas con material + por qué cada una, más el "plan" (borrador
    // de razonamiento del schema): la cápsula nueva es grande y ya corría cerca
    // del tope viejo (8000) — margen holgado; solo se paga lo que se emite.
    max_tokens: 10000,
    // Thinking OFF: en los modelos 5 viene ON por default y se come el
    // presupuesto de salida (ver capsule-match.ts — ahí dejó la pantalla de
    // esenciales muerta). El schema ya obliga a razonar en un campo antes de
    // comprometer la respuesta, que es la misma idea dentro del presupuesto.
    thinking: { type: "disabled" },
    system: `Eres la stylist senior de stailist — del nivel de una asesora de imagen que cobra una fortuna, pero mejor y más honesta. Defines el CLÓSET CÁPSULA IDEAL de una persona: las prendas concretas que DEBERÍA tener para vivir bien vestida según su vida real, su cuerpo y su color. Partes de cero (no miras lo que ya tiene); después la app le dirá qué ya tiene y qué le falta, así que tu trabajo es definir el deber-ser, completo y honesto.

REGLA INNEGOCIABLE DE GÉNERO: ${generoTxt}

El objetivo NO es una lista larga: es un SISTEMA que se combina solo. Una cápsula bien hecha rinde 100+ outfits porque cada prenda se MULTIPLICA con las demás. Optimiza por COMBINABILIDAD, no por cantidad.

Cómo trabajas: PRIMERO llena el campo "plan" — tu borrador de trabajo, la persona no lo ve. Ahí decide el esqueleto ANTES de listar prendas: qué 2-4 neutros serán la espina dorsal, qué 2-3 acentos de su paleta los acompañan, cuántas piezas por categoría le tocan a SU vida (y por qué), y qué códigos de vestimenta tiene que cubrir. DESPUÉS genera los items ejecutando ese plan — cada prenda debe caber en él.

== CUÁNTAS PRENDAS ==
No hay número fijo. Dimensiona la cápsula al ideal REAL de ESTA persona: típicamente 25-40 piezas (incluyendo calzado y accesorios clave). Flexa con honestidad: menos para una vida simple/minimalista o clima de una sola estación; más si tiene varios códigos de vestimenta (oficina formal + salidas + eventos) o clima de varias estaciones. Da el número que de verdad necesita — ni inflado ni recortado por miedo a que "le falte mucho".

== ESTRUCTURA POR CATEGORÍA ==
Los tops son la categoría más grande y el principal multiplicador (se ven más, se lavan más, varían barato): apunta a ~2 tops por cada bottom. Reparte el resto en calzado, sacos/sastrería (si su vida tiene códigos formales o eventos), abrigos (solo si el clima lo pide) y accesorios. En mujer, los vestidos cuentan como multiplicador; en hombre, ese presupuesto va a más camisas/pantalones/sastrería.

== PALETA (restricción dura, no sugerencia) ==
- 2-4 NEUTROS como espina dorsal (la mayoría del clóset, ~70%) + 2-3 ACENTOS de su paleta (~30%).
- Cada acento debe combinar con AL MENOS 3 de los neutros; si un color no pega con sus neutros, fuera.
- NUNCA uses un color de su lista de EVITA.
- Apunta a que un outfit típico use ≤3 colores.
- DÓNDE VIVE EL COLOR, no sólo cuánto: al menos DOS de sus acentos tienen que ir en piezas CHICAS —bufanda, calzado, cinturón, bolso, corbata, calcetín—, no todos en tops y abrigos. Sin piezas chicas de color, el único modo de darle color a un look es un suéter entero, y la persona acaba llevando color en dosis que no pidió. (Medido en un clóset real: 12 acentos en piezas grandes contra 6 en chicas, y de esas 6 casi ninguna salía.)${acentoTxt}

== COHESIÓN (regla de 3) ==
Cada prenda debe combinar con AL MENOS 3 otras de la cápsula. Si una pieza solo pega con 1-2, no se ganó su lugar: cámbiala por algo más versátil. ÚNICA excepción: las piezas que entran por CLIMA DE VIAJE (abajo) están exentas de esta regla — un traje de baño no combina con nada y aun así hace falta. Ancla todo en los neutros para que casi cada top funcione con casi cada bottom. Básicos primero; permite 2-3 piezas "héroe" con carácter, pero cada una debe seguir entrando en ≥3 outfits.

== ATERRIZAJE EN SU VIDA Y SU CUERPO ==
- VIDA: refleja cómo pasa su tiempo DE VERDAD (sus respuestas). El peso de la cápsula sigue su vida real, no una aspiracional. Cubre AMBOS lados: lo que su día exige Y cómo le gusta vestir cuando elige.
- CUERPO: ${siluetaLine ?? "sin datos de silueta; usa cortes versátiles y favorecedores en general"}. Esto cambia QUÉ cortes eliges (no las cantidades). Marco de agencia: "este corte te luce", nunca "esconde tu X".
- COLOR/METAL: nombra colores de su paleta; ${metalTxt}

Devuelve "items". Cada prenda:
- nombre: etiqueta humana y específica, con color y material cuando aporte. Ej: "Cuello tortuga de lana merino azul marino", "Chukka de ante café".
- tipo: clave corta normalizada, sin color. Ej: "cuello-tortuga", "chukka", "blazer", "jeans".
- hueco: el ROL que cubre, en 2-4 palabras, minúsculas, sin color ni marca. Ej: "pantalón no denim", "tenis limpio", "abrigo de diario". Lo LEE la persona, así que va en español correcto y con acentos (a diferencia de "tipo", que es una llave interna).
- category ∈ {${CATEGORIES.join(", ")}} — 'saco' para sacos/blazers/sastrería (pieza formal por ocasión); 'abrigo' SOLO para capas por clima (abrigo, cárdigan, parka). Un traje va como 'saco' + su pantalón 'bottom' aparte.
- colorFamilia: familia simple ("marino", "gris", "camel", "blanco"…), dentro de su paleta.
- formalidad ∈ {${FORMALIDADES.join(", ")}}
- temporada: "todo-el-año" | "calor" | "frio".
- prioridad: 1 = la usaría casi diario; sube hacia los caprichos. Ordena con criterio.
- porque: UNA línea cálida (tuteo, voz amiga); cuando sea natural, menciona con qué se combina o qué desbloquea.

Y tres campos que explican POR QUÉ esta cápsula es de ESTA persona — la sustancia detrás de tus decisiones, aterrizada a SUS datos reales. PROHIBIDO el relleno genérico ("consideramos tu estilo de vida"): cada cosa nombra algo concreto suyo (su estación, su trabajo, su cuerpo, su metal) o NO va.
LENGUAJE (la marca es "cero jerga de moda"): escribe para quien NO sabe de moda. En el texto que LEE la persona, nada de "silueta", "cortes", "proporción", "estructura", "statement", "monocromía", "textura" — y tampoco "cápsula" (jerga de moda: en la app esto se llama "tus esenciales"; di "tu lista" o "tus esenciales"); dilo cotidiano (en vez de "corte que estiliza tu silueta" → "que te quede bien y te alargue"). Los conceptos piénsalos tú; las palabras van llanas.
- "firma": UNA frase corta (voz de amiga, tuteo) que nombre su SELLO de estilo — un titular, no una oración larga. Envuelve la frase CLAVE (2-3 palabras) entre *asteriscos*. Ej: "Vas por un pulido versátil, con un *guiño edgy*."
- "subline": UNA línea (≤ ~95 chars) que conecte la firma con cómo armaste su lista. Ej: "Así armé tus esenciales para que ese sea tu default, sin pensarlo."
- "pilares": 3 o 4 razones, cada una con "titulo" (2-3 palabras) + "detalle" (UNA sola línea, ≤ ~90 chars) + "icono". Cubre su PALETA (icono:"paleta"), su VIDA real / versatilidad casa↔noche (icono:"versatilidad" o "vida"), su CUERPO/silueta (icono:"estructura") y su METAL (icono:"metal").

Calidad sobre cantidad: piezas reales y combinables, fibras nobles cuando aporte. Abrigos solo si su clima es frío/templado.
${REGLA_PRENDAS_REALES}
CLIMA DE VIAJE: su ciudad define el centro de gravedad del clóset, pero no puede empacar lo que no tiene. Si dice que viaja a un clima DISTINTO al suyo, súmale las piezas de ese clima aunque su ciudad no las pida, integradas a su paleta y su estilo (un abrigo de lana camel o carbón sirve igual en su ciudad para una noche fría). No es un guardarropa paralelo, pero SÍ tiene que alcanzar para vestirse de pies a cabeza allá:
- FRÍO (y su clima no es frío): 1 o 2 piezas bastan, porque el frío se resuelve por CAPAS ENCIMA de lo que ya tiene. Un abrigo real (lana, largo), no una chamarra ligera; suma un suéter grueso si su clima es de plano cálido.
- CALOR o playa (y su clima no es de calor): aquí NO alcanza con una pieza. Un viaje de calor le cambia el outfit COMPLETO — su ropa de diario no sirve. Dale un SET mínimo de 3 a 4: traje de baño (obligatorio si mencionó playa; no lo omitas por combinable que no sea), al menos un short o bermuda de calle (de lino o algodón — NO de baño: son prendas distintas y necesita las dos), y 1 o 2 tops frescos (camisa de lino, playera ligera). Si su clima ya es de calor, esto ya está cubierto por su día a día y no lo dupliques.
Si contestó que no viaja a nada distinto, NO agregues nada por este concepto. Nada de ropa de gym salvo que el deporte sea claramente central en su vida.${vetosTxt}`,
    messages: [
      {
        role: "user",
        content: `VIDA:\n${vida}\n\nESTILO: ${estilo}\nTags de gusto (en orden de fuerza): ${tags}${refTxt}${palabrasTxt}${feedbackTxt}\nCOLORIMETRÍA: ${paletaTxt} ${metalTxt}\nSILUETA: ${siluetaLine}${inputs.ageStyling ? `\n${inputs.ageStyling}` : ""}\n\nDefine su cápsula ideal (items).`,
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
                "Tu borrador de trabajo (la persona NO lo ve; 4-8 líneas, MÁXIMO 8): los 2-4 neutros espina dorsal, los 2-3 acentos de su paleta, cuántas piezas por categoría le tocan a SU vida y por qué, y qué códigos de vestimenta cubres. Decide esto ANTES de listar prendas.",
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre: { type: "string" },
                  tipo: { type: "string" },
                  hueco: { type: "string" },
                  category: { type: "string", enum: [...CATEGORIES] },
                  colorFamilia: { type: "string" },
                  formalidad: { type: "string", enum: [...FORMALIDADES] },
                  temporada: { type: "string" },
                  // sin minimum/maximum: el structured output no los soporta.
                  prioridad: { type: "integer" },
                  porque: { type: "string" },
                },
                required: [
                  "nombre",
                  "tipo",
                  "hueco",
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
            firma: { type: "string" },
            subline: { type: "string" },
            pilares: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  detalle: { type: "string" },
                  icono: {
                    type: "string",
                    enum: ["paleta", "versatilidad", "estructura", "metal", "color", "vida"],
                  },
                },
                required: ["titulo", "detalle", "icono"],
                additionalProperties: false,
              },
            },
          },
          required: ["plan", "items", "firma", "subline", "pilares"],
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
    items: CapsuleItem[];
    firma?: string;
    subline?: string;
    pilares?: CapsulePilar[];
  };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("BAD_CAPSULE_TARGET");
  }
  // Re-ranking limpio 1..n por la prioridad que sugirió el modelo (estable).
  // Los trajes se parten ANTES del re-ranking, para que el pantalón herede su
  // sitio en la lista junto al saco en vez de caer al final.
  const items = partirTrajes(parsed.items)
    .slice()
    .sort((a, b) => a.prioridad - b.prioridad)
    .map((it, i) => ({ ...it, prioridad: i + 1 }));
  return {
    version: 2,
    items,
    firma: parsed.firma?.trim() || undefined,
    subline: parsed.subline?.trim() || undefined,
    pilares: parsed.pilares?.filter((p) => p.titulo && p.detalle) || undefined,
  };
}
