import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Season } from "@/lib/colorimetria";

export const maxDuration = 60;

export type FotoAnalisis = {
  estacion: Season;
  confianza: "alta" | "media" | "baja";
  por_que: string;
  calidad_foto: string;
};

// Analiza una selfie con Claude vision → estación + confianza. La clave es la
// AUTOEVALUACIÓN: la luz amarilla y los filtros mienten con el color, así que
// el modelo juzga si la foto sirve y baja la confianza cuando no. No guarda
// nada — el cliente decide qué hacer según la confianza (Gemini genera,
// Claude analiza/razona).
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
  // image: dataURL "data:image/jpeg;base64,...." (ya comprimida en el cliente)
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      system:
        "Eres colorimetrista experto y cálido. Analizas piel, ojos y cabello para estimar la estación (primavera/verano/otono/invierno) en el sistema de las 4 estaciones. Eres MUY consciente de que la luz amarilla, los filtros y la sobreexposición falsean el color real: si la foto no es confiable, baja la confianza a 'baja' y dilo. El campo por_que va en voz cálida de amiga cool, sin jerga técnica, tuteando.",
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
              text: "Analiza la colorimetría de esta persona y di con qué confianza, considerando si la luz de la foto permite juzgar bien el color.",
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
              estacion: {
                type: "string",
                enum: ["primavera", "verano", "otono", "invierno"],
              },
              confianza: { type: "string", enum: ["alta", "media", "baja"] },
              por_que: { type: "string" },
              calidad_foto: { type: "string" },
            },
            required: ["estacion", "confianza", "por_que", "calidad_foto"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "vacio" }, { status: 502 });
    const analisis = JSON.parse(text) as FotoAnalisis;
    return NextResponse.json({ analisis });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
