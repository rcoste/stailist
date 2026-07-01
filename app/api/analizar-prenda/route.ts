import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export type PrendaAnalisis = {
  nombre: string;
  categoria: "top" | "saco" | "bottom" | "calzado" | "abrigo" | "vestido" | "accesorio";
  color: string;
  color_hex: string;
  formalidad: "casual" | "formal-casual" | "formal";
  temporada: "calor" | "templado" | "frio" | "todo-el-año";
  // Atributos de styling (opcionales): habilitan tips de "cómo llevarlo"
  // (fajar/arremangar/proporción). El modelo los llena cuando aplican.
  largo?: "crop" | "regular" | "largo";
  corte?: "entallado" | "recto" | "holgado";
  manga?: "sin" | "corta" | "larga";
};

// Claude vision mira la foto de UNA prenda y devuelve sus atributos. El
// usuario confirma/ajusta después (la detección nunca bloquea — falla #1 del
// alfa era inventar; aquí la persona corrige en un tap). Gemini genera, Claude
// analiza.
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
      max_tokens: 500,
      system:
        "Eres experta en moda. Miras la foto de UNA prenda y describes sus atributos para un clóset digital. El nombre es corto y natural en español ('Jeans rectos azules', 'Tenis blancos de piel'). Identifica con cuidado el TIPO exacto de prenda, que es lo que más se confunde: un POLO (tejido de punto, cuello tejido con botonadura corta de 2-3 botones, sin abertura completa) NO es una camisa (tela plana, botonadura de arriba a abajo); una playera/camiseta (sin botones ni cuello rígido) tampoco es una camisa; una sudadera no es un suéter; unos chinos no son jeans. Ante la duda entre polo y camisa, fíjate en si la botonadura llega hasta abajo (camisa) o solo al pecho (polo). CATEGORÍA — distingue con cuidado: 'saco' = saco, blazer, saco de traje o smoking (prenda estructurada de torso que se usa por FORMALIDAD, no por frío); 'abrigo' = SOLO capas por clima (abrigo, gabardina, parka, cárdigan, suéter grueso de capa). Un traje se registra como dos prendas: el saco (categoría 'saco') y su pantalón (categoría 'bottom'), por separado. El color_hex es el color dominante real de la prenda. Si hay varias prendas o ninguna clara, elige la prenda principal. Cuando apliquen a la prenda, agrega también largo (crop/regular/largo), corte (entallado/recto/holgado) y manga (sin/corta/larga) — sirven para sugerir cómo llevarla.",
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
              text: "Describe esta prenda para mi clóset.",
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
            },
            required: [
              "nombre",
              "categoria",
              "color",
              "color_hex",
              "formalidad",
              "temporada",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "vacio" }, { status: 502 });
    const analisis = JSON.parse(text) as PrendaAnalisis;
    return NextResponse.json({ analisis });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
