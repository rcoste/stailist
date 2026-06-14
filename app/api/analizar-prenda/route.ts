import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export type PrendaAnalisis = {
  nombre: string;
  categoria: "top" | "bottom" | "calzado" | "abrigo" | "vestido" | "accesorio";
  color: string;
  color_hex: string;
  formalidad: "casual" | "formal-casual" | "formal";
  temporada: "calor" | "templado" | "frio" | "todo-el-año";
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
        "Eres experta en moda. Miras la foto de UNA prenda y describes sus atributos para un clóset digital. El nombre es corto y natural en español ('Camisa de lino beige', 'Tenis blancos'). El color_hex es el color dominante real de la prenda. Si hay varias prendas o ninguna clara, elige la prenda principal.",
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
