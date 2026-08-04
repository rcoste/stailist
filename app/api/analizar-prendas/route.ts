import { ENGINE_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PATRONES } from "@/lib/prenda-atributos";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

export const maxDuration = 60;

// Una prenda detectada en una foto de persona vestida. Hereda los atributos de
// PrendaAnalisis y suma `confianza`: cuando la IA no ve bien la prenda (oclusión,
// perspectiva), lo dice en vez de inventar — la UI la marca "revisa esto".
export type PrendaDetectada = PrendaAnalisis & {
  confianza: "alta" | "media" | "baja";
  // Descripción visual detallada (estilo, corte, material, detalles) para que
  // Gemini regenere una imagen fiel. El `nombre` es corto para mostrar; ESTA es
  // la que alimenta el render.
  descripcion: string;
};

// Versión multi-prenda de /api/analizar-prenda: mira UNA foto — persona vestida
// O prendas extendidas (cama, colgadas, apiladas: el caso "vacía tu clóset") — y
// devuelve el ARRAY de prendas. El usuario confirma cada una en lote antes de que
// se genere nada (el humano es el filtro contra la alucinación). Tope 8 prendas
// por foto (una cama trae más que un outfit). Spec: docs/designs/import-carrete-multiprenda.md
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Menor (13-17) sin permiso parental confirmado: las fotos quedan bloqueadas.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  let body: { image?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: ENGINE_MODEL,
      // 2800: hasta 8 prendas con descripcion larga + los campos nuevos
      // (material/patron/color_secundario); menos arriesgaba truncar el JSON.
      max_tokens: 2800,
      system:
        "Eres experta en moda. Miras UNA foto y listas CADA prenda visible, para un clóset digital. La foto puede ser de dos tipos: (a) una PERSONA VESTIDA — listas cada prenda que lleva puesta; o (b) PRENDAS SUELTAS sin persona — extendidas sobre una cama o el piso, colgadas en ganchos o apiladas — listas cada prenda distinguible. Detecta el tipo tú sola; no preguntes. Reglas: (1) una entrada por prenda real; no inventes prendas que no se ven. En fotos de prendas sueltas, ignora lo que NO es ropa (cobijas, sábanas, almohadas, muebles, ganchos vacíos, cajas). (2) Si una prenda está tapada, doblada de forma que oculte su corte, en perspectiva difícil, o el color es dudoso por la luz, márcala confianza 'baja' (NO la omitas, pero avisa). (3) El nombre es corto y natural en español ('Jeans rectos azules', 'Tenis blancos', 'Blusa blanca de seda', 'Falda midi plisada negra'). Identifica con cuidado el TIPO exacto, que es lo que más se confunde: un POLO (tejido de punto, cuello tejido con botonadura corta de 2-3 botones) NO es una camisa (tela plana, botonadura de arriba a abajo); una playera/camiseta tampoco es una camisa; una sudadera no es un suéter; unos chinos no son jeans. Ante la duda entre polo y camisa, fíjate si la botonadura llega hasta abajo (camisa) o solo al pecho (polo). En ropa de mujer distingue igual de fino: una BLUSA (tela fluida, con o sin botones) no es una camisa de vestir ni una playera; una falda (cualquier largo) va en 'bottom'; un vestido o un enterizo/jumpsuit van en 'vestido'; tacones, flats, sandalias y botas van en 'calzado'; una bolsa va en 'accesorio'. CATEGORÍA: 'saco' = saco/blazer/saco de traje/smoking (torso estructurado por FORMALIDAD, no por frío); 'abrigo' = solo capas por clima (abrigo/gabardina/parka/cárdigan/suéter grueso). Un traje = saco (categoría 'saco') + su pantalón (categoría 'bottom') por separado. FORMALIDAD — calibra con cuidado, es donde más te equivocas: 'formal' se reserva para sastrería y prendas de evento (saco de traje, camisa de vestir estructurada, vestido de coctel, tacón de vestir); una camisa o blusa del diario suele ser 'formal-casual' (versátil, juega para ambos lados) o 'casual' si es relajada. Ante la duda entre dos niveles, elige 'formal-casual'. (4) color_hex es el color dominante real de la prenda (el de la TELA, ignorando sombras y luz). Si es claramente bicolor o estampada con un segundo color protagonista, da color_secundario (nombre); si no, omítelo. Da el material aparente ('algodón', 'lana', 'mezclilla', 'lino', 'piel', 'punto', 'sintético'…); si no se distingue, omítelo en vez de adivinar. Da el patron: 'liso' o el que tenga (rayas/cuadros/floral/animal-print/grafico/estampado). (5) descripcion: una descripción VISUAL detallada en español, pensada para que un generador de imágenes recree la prenda fielmente — incluye tipo de prenda, corte/silueta, material/textura aparente, color exacto, y detalles distintivos (cuello, mangas, botones, estampado, cierre, suela, montura, etc.). Ej: 'chaqueta tipo bomber de nylon negro mate, cierre metálico frontal, puños y cintura elásticos acanalados, sin capucha'. Máximo 8 prendas; si hay más, prioriza las que se ven completas y con color claro.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png",
                data: b64,
              },
            },
            {
              type: "text",
              text: "Lista cada prenda que lleva puesta esta persona.",
            },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              prendas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nombre: { type: "string" },
                    categoria: {
                      type: "string",
                      enum: ["top", "saco", "bottom", "calzado", "abrigo", "vestido", "accesorio"],
                    },
                    color: { type: "string" },
                    color_hex: { type: "string" },
                    formalidad: {
                      type: "string",
                      enum: ["casual", "formal-casual", "formal"],
                    },
                    temporada: {
                      type: "string",
                      enum: ["calor", "templado", "frio", "todo-el-año"],
                    },
                    largo: { type: "string", enum: ["crop", "regular", "largo"] },
                    corte: { type: "string", enum: ["entallado", "recto", "holgado"] },
                    manga: { type: "string", enum: ["sin", "corta", "larga"] },
                    material: { type: "string" },
                    patron: { type: "string", enum: [...PATRONES] },
                    color_secundario: { type: "string" },
                    confianza: {
                      type: "string",
                      enum: ["alta", "media", "baja"],
                    },
                    descripcion: { type: "string" },
                  },
                  required: [
                    "nombre",
                    "categoria",
                    "color",
                    "color_hex",
                    "formalidad",
                    "temporada",
                    "patron",
                    "confianza",
                    "descripcion",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["prendas"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "vacio" }, { status: 502 });
    const parsed = JSON.parse(text) as { prendas: PrendaDetectada[] };
    // Tope duro: nunca más de 8 aunque el modelo se exceda.
    const prendas = (parsed.prendas ?? []).slice(0, 8);
    return NextResponse.json({ prendas });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
