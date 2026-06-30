import Anthropic from "@anthropic-ai/sdk";
import {
  ASSESSMENT_QUESTIONS,
  CATEGORIES,
  FORMALIDADES,
  type CapsuleItem,
  type CapsulePilar,
  type CapsuleTarget,
  type LifestyleAnswers,
} from "@/lib/capsule";
import { SEASONS, seasonMetal, seasonPalette, type Season } from "@/lib/colorimetria";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";

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
};

// CAPA 1 — la cápsula IDEAL: una lista de prendas concretas y nombradas que
// ESA persona debería tener, mezclando lo que su vida exige con quién es cuando
// elige, y aterrizada a su paleta de color. Libre del catálogo (puede pedir
// prendas que no tenemos). Se llama una vez al guardar/editar el assessment.
export async function generateCapsuleTarget(
  inputs: CapsuleInputs
): Promise<CapsuleTarget> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ENGINE_NOT_CONNECTED");

  const client = new Anthropic();

  const vida = ASSESSMENT_QUESTIONS.map((q) => {
    const opt = q.options.find((o) => o.value === inputs.answers[q.id]);
    return opt ? `- ${q.label} → ${opt.label}` : null;
  })
    .filter(Boolean)
    .join("\n");

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

  const estilo = inputs.archetype
    ? `"${inputs.archetype.nombre}" — ${inputs.archetype.descripcion}`
    : "sin definir";
  const tags = inputs.tasteTags.length ? inputs.tasteTags.join(", ") : "sin tags";
  const refTxt = inputs.styleReference
    ? `\nESTILO DE REFERENCIA que le encanta (inspira el VIBE y las siluetas de la cápsula, NO los colores — la colorimetría de abajo manda el color): ${inputs.styleReference}. Empuja la cápsula hacia ese aire sin copiarlo literal.`
    : "";
  const generoTxt =
    inputs.gender === "hombre"
      ? "La persona es HOMBRE: TODA la cápsula es ropa de hombre. Jamás propongas prendas de mujer (faldas, vestidos, blusas, tacones, etc.)."
      : inputs.gender === "mujer"
        ? "La persona es MUJER: TODA la cápsula es ropa de mujer. Jamás propongas prendas pensadas solo para hombre."
        : "Género no definido: usa prendas neutras/unisex.";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    // ~25-40 prendas con material + por qué cada una: la cápsula nueva es grande.
    max_tokens: 8000,
    system: `Eres la stylist senior de stailist — del nivel de una asesora de imagen que cobra una fortuna, pero mejor y más honesta. Defines el CLÓSET CÁPSULA IDEAL de una persona: las prendas concretas que DEBERÍA tener para vivir bien vestida según su vida real, su cuerpo y su color. Partes de cero (no miras lo que ya tiene); después la app le dirá qué ya tiene y qué le falta, así que tu trabajo es definir el deber-ser, completo y honesto.

REGLA INNEGOCIABLE DE GÉNERO: ${generoTxt}

El objetivo NO es una lista larga: es un SISTEMA que se combina solo. Una cápsula bien hecha rinde 100+ outfits porque cada prenda se MULTIPLICA con las demás. Optimiza por COMBINABILIDAD, no por cantidad.

== CUÁNTAS PRENDAS ==
No hay número fijo. Dimensiona la cápsula al ideal REAL de ESTA persona: típicamente 25-40 piezas (incluyendo calzado y accesorios clave). Flexa con honestidad: menos para una vida simple/minimalista o clima de una sola estación; más si tiene varios códigos de vestimenta (oficina formal + salidas + eventos) o clima de varias estaciones. Da el número que de verdad necesita — ni inflado ni recortado por miedo a que "le falte mucho".

== ESTRUCTURA POR CATEGORÍA ==
Los tops son la categoría más grande y el principal multiplicador (se ven más, se lavan más, varían barato): apunta a ~2 tops por cada bottom. Reparte el resto en capas, calzado, abrigos (solo si el clima lo pide) y accesorios. En mujer, los vestidos cuentan como multiplicador; en hombre, ese presupuesto va a más camisas/pantalones/sastrería.

== PALETA (restricción dura, no sugerencia) ==
- 2-4 NEUTROS como espina dorsal (la mayoría del clóset, ~70%) + 2-3 ACENTOS de su paleta (~30%).
- Cada acento debe combinar con AL MENOS 3 de los neutros; si un color no pega con sus neutros, fuera.
- NUNCA uses un color de su lista de EVITA.
- Apunta a que un outfit típico use ≤3 colores.

== COHESIÓN (regla de 3) ==
Cada prenda debe combinar con AL MENOS 3 otras de la cápsula. Si una pieza solo pega con 1-2, no se ganó su lugar: cámbiala por algo más versátil. Ancla todo en los neutros para que casi cada top funcione con casi cada bottom. Básicos primero; permite 2-3 piezas "héroe" con carácter, pero cada una debe seguir entrando en ≥3 outfits.

== ATERRIZAJE EN SU VIDA Y SU CUERPO ==
- VIDA: refleja cómo pasa su tiempo DE VERDAD (sus respuestas). El peso de la cápsula sigue su vida real, no una aspiracional. Cubre AMBOS lados: lo que su día exige Y cómo le gusta vestir cuando elige.
- CUERPO: ${siluetaLine ?? "sin datos de silueta; usa cortes versátiles y favorecedores en general"}. Esto cambia QUÉ cortes eliges (no las cantidades). Marco de agencia: "este corte te luce", nunca "esconde tu X".
- COLOR/METAL: nombra colores de su paleta; ${metalTxt}

Devuelve "items". Cada prenda:
- nombre: etiqueta humana y específica, con color y material cuando aporte. Ej: "Cuello tortuga de lana merino azul marino", "Chukka de ante café".
- tipo: clave corta normalizada, sin color. Ej: "cuello-tortuga", "chukka", "blazer", "jeans".
- category ∈ {${CATEGORIES.join(", ")}}
- colorFamilia: familia simple ("marino", "gris", "camel", "blanco"…), dentro de su paleta.
- formalidad ∈ {${FORMALIDADES.join(", ")}}
- temporada: "todo-el-año" | "calor" | "frio".
- prioridad: 1 = la usaría casi diario; sube hacia los caprichos. Ordena con criterio.
- porque: UNA línea cálida (tuteo, voz amiga); cuando sea natural, menciona con qué se combina o qué desbloquea.
- visual: descripción VISUAL precisa para renderizar su imagen flat-lay (NO se le muestra al usuario; es para el generador de imagen). Nombra material/tejido, silueta/corte, largo, detalles concretos (cuello, manga, pretina, botones) y color. Sé inequívoco para que no se confunda con otra prenda: ej. un short de calle vs uno de baño. Ej: "Short chino de lino azul marino, corte recto, largo a la rodilla, pretina con botón y trabillas, dos bolsillos laterales". Una frase, en español, sin marcas.

Y tres campos que explican POR QUÉ esta cápsula es de ESTA persona — la sustancia detrás de tus decisiones, aterrizada a SUS datos reales. PROHIBIDO el relleno genérico ("consideramos tu estilo de vida"): cada cosa nombra algo concreto suyo (su estación, su trabajo, su silueta, su metal) o NO va.
- "firma": UNA frase corta (voz de amiga, tuteo) que nombre su SELLO de estilo — un titular, no una oración larga. Envuelve la frase CLAVE (2-3 palabras) entre *asteriscos*. Ej: "Vas por un pulido versátil, con un *guiño edgy*."
- "subline": UNA línea (≤ ~95 chars) que conecte la firma con cómo armaste la cápsula. Ej: "Así armé tu cápsula para que ese sea tu default, sin pensarlo."
- "pilares": 3 o 4 razones, cada una con "titulo" (2-3 palabras) + "detalle" (UNA sola línea, ≤ ~90 chars) + "icono". Cubre su PALETA (icono:"paleta"), su VIDA real / versatilidad casa↔noche (icono:"versatilidad" o "vida"), su CUERPO/silueta (icono:"estructura") y su METAL (icono:"metal").

Calidad sobre cantidad: piezas reales y combinables, fibras nobles cuando aporte. Abrigos solo si su clima es frío/templado. Nada de ropa de gym salvo que el deporte sea claramente central en su vida.`,
    messages: [
      {
        role: "user",
        content: `VIDA:\n${vida}\n\nESTILO: ${estilo}\nTags de gusto: ${tags}${refTxt}\nCOLORIMETRÍA: ${paletaTxt} ${metalTxt}\nSILUETA: ${siluetaLine}\n\nDefine su cápsula ideal (items).`,
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
                  // sin minimum/maximum: el structured output no los soporta.
                  prioridad: { type: "integer" },
                  porque: { type: "string" },
                  visual: { type: "string" },
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
                  "visual",
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
          required: ["items", "firma", "subline", "pilares"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
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
  const items = parsed.items
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
