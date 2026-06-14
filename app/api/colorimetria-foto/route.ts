import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Season } from "@/lib/colorimetria";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3.1-pro-preview";

type ModelRead = {
  estacion: Season;
  confianza: "alta" | "media" | "baja";
  por_que: string;
  calidad_foto: string;
};

// El resultado reconciliado del ensemble (Claude + Gemini):
// - confident: ambos coinciden → una estación.
// - border: difieren → la persona está en la frontera; cada modelo nombró una
//   candidata (base = lo que vio Claude, flow = lo que vio Gemini).
// - baja: la foto no permite leer el color con confianza.
export type FotoResult =
  | { kind: "confident"; season: Season; confianza: "alta" | "media"; por_que: string }
  | { kind: "border"; season: Season; flow: Season; por_que: string }
  | { kind: "baja"; por_que: string };

const SYSTEM =
  "Eres colorimetrista experto y cálido. Analizas piel, ojos y cabello para estimar la estación (primavera/verano/otono/invierno) en el sistema de las 4 estaciones. Eres MUY consciente de que la luz amarilla, los filtros y la sobreexposición falsean el color real: si la foto no es confiable, baja la confianza a 'baja' y dilo. El campo por_que va en voz cálida de amiga cool, sin jerga técnica, tuteando.";
const USER_TEXT =
  "Analiza la colorimetría de esta persona y di con qué confianza, considerando si la luz de la foto permite juzgar bien el color.";

const SCHEMA = {
  type: "object" as const,
  properties: {
    estacion: { type: "string", enum: ["primavera", "verano", "otono", "invierno"] },
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    por_que: { type: "string" },
    calidad_foto: { type: "string" },
  },
  required: ["estacion", "confianza", "por_que", "calidad_foto"],
  additionalProperties: false,
};

// Claude analiza (voz + razonamiento). Devuelve null si falla para que el
// ensemble degrade con elegancia al otro modelo.
async function readClaude(
  mediaType: string,
  b64: string
): Promise<ModelRead | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      system: SYSTEM,
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
            { type: "text", text: USER_TEXT },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    return text ? (JSON.parse(text) as ModelRead) : null;
  } catch {
    return null;
  }
}

// Gemini aporta una segunda lectura independiente. Su VALOR es el desacuerdo
// con Claude: cuando difieren, eso marca la frontera. Devuelve null si falla.
async function readGemini(
  mediaType: string,
  b64: string
): Promise<ModelRead | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [
            {
              parts: [
                { text: USER_TEXT },
                { inlineData: { mimeType: mediaType, data: b64 } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .filter(Boolean)
      .join("");
    return txt ? (JSON.parse(txt) as ModelRead) : null;
  } catch {
    return null;
  }
}

const peor = (a: string, b: string) =>
  a === "baja" || b === "baja" ? "baja" : a === "media" || b === "media" ? "media" : "alta";

// Analiza una selfie con DOS modelos en paralelo y reconcilia. Gemini genera
// imágenes en el resto de la app, pero aquí también analiza: su desacuerdo con
// Claude es justo la señal de frontera. No guarda nada — el cliente decide.
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

  const [claude, gemini] = await Promise.all([
    readClaude(mediaType, b64),
    readGemini(mediaType, b64),
  ]);

  if (!claude && !gemini) {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }

  // Si solo respondió uno, ese decide (sin frontera; no hay con qué contrastar).
  if (!claude || !gemini) {
    const solo = (claude ?? gemini) as ModelRead;
    if (solo.confianza === "baja") {
      return NextResponse.json({ result: { kind: "baja", por_que: solo.por_que } });
    }
    return NextResponse.json({
      result: {
        kind: "confident",
        season: solo.estacion,
        confianza: solo.confianza === "alta" ? "alta" : "media",
        por_que: solo.por_que,
      },
    });
  }

  // Foto mala según ambos: ni intentamos dar estación.
  if (claude.confianza === "baja" && gemini.confianza === "baja") {
    return NextResponse.json({
      result: { kind: "baja", por_que: claude.por_que },
    });
  }

  // Coinciden → confianza; difieren → frontera (cada uno nombró una candidata).
  if (claude.estacion === gemini.estacion) {
    const conf = peor(claude.confianza, gemini.confianza);
    return NextResponse.json({
      result: {
        kind: "confident",
        season: claude.estacion,
        confianza: conf === "alta" ? "alta" : "media",
        por_que: claude.por_que,
      },
    });
  }

  return NextResponse.json({
    result: {
      kind: "border",
      season: claude.estacion, // base: la lectura de Claude (voz/razonamiento)
      flow: gemini.estacion, // flow: la candidata que vio Gemini
      por_que: claude.por_que,
    },
  });
}
