import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
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

// Versión multi-prenda de /api/analizar-prenda: mira UNA foto de una persona
// vestida y devuelve el ARRAY de prendas que lleva puestas. El usuario confirma
// cada una en lote antes de que se genere nada (el humano es el filtro contra la
// alucinación). Tope ~6 prendas por foto. Spec: docs/designs/import-carrete-multiprenda.md
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

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
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system:
        "Eres experta en moda. Miras la foto de UNA PERSONA VESTIDA y listas CADA prenda visible que lleva puesta (top, pantalón, calzado, abrigo, vestido, accesorio), para un clóset digital. Reglas: (1) una entrada por prenda real; no inventes prendas que no se ven. (2) Si una prenda está tapada, en perspectiva difícil, o el color es dudoso por la luz, márcala confianza 'baja' (NO la omitas, pero avisa). (3) El nombre es corto y natural en español ('Jeans rectos azules', 'Tenis blancos'). Identifica con cuidado el TIPO exacto, que es lo que más se confunde: un POLO (tejido de punto, cuello tejido con botonadura corta de 2-3 botones) NO es una camisa (tela plana, botonadura de arriba a abajo); una playera/camiseta tampoco es una camisa; una sudadera no es un suéter; unos chinos no son jeans. Ante la duda entre polo y camisa, fíjate si la botonadura llega hasta abajo (camisa) o solo al pecho (polo). (4) color_hex es el color dominante real de la prenda. (5) descripcion: una descripción VISUAL detallada en español, pensada para que un generador de imágenes recree la prenda fielmente — incluye tipo de prenda, corte/silueta, material/textura aparente, color exacto, y detalles distintivos (cuello, mangas, botones, estampado, cierre, suela, montura, etc.). Ej: 'chaqueta tipo bomber de nylon negro mate, cierre metálico frontal, puños y cintura elásticos acanalados, sin capucha'. Máximo 6 prendas.",
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
                      enum: ["top", "bottom", "calzado", "abrigo", "vestido", "accesorio"],
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
    // Tope duro: nunca más de 6 aunque el modelo se exceda.
    const prendas = (parsed.prendas ?? []).slice(0, 6);
    return NextResponse.json({ prendas });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
