import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";
// Juez de parecido: visión barata. Si puntúa bajo, se regenera UNA vez y se
// devuelve el mejor de los dos — el usuario nunca ve el intento malo.
const JUDGE_MODEL = "claude-haiku-4-5";
const JUDGE_MIN = 6; // umbral 1-10 para reintentar

// El tipo de cuerpo (de la silueta del perfil o del wizard) alimenta el prompt.
// Espejo fiel: NO adelgazar. Básicos ajustados → la silueta se ve para que el
// try-on sea fiel.
const BUILD: Record<string, string> = {
  slim: "slim",
  athletic: "athletic and toned",
  average: "average",
  full: "fuller, heavier-set",
};

function buildPrompt(build: string, nFaces: number): string {
  const faceRef =
    nFaces > 1
      ? `the first ${nFaces} images show their face from different angles`
      : "the first image is their face";
  return (
    "Generate a photorealistic full-body portrait of the SAME person shown in " +
    `the provided photos (${faceRef}; the others show their ` +
    "body). Keep their face, skin tone, hair and identity identical and clearly " +
    `recognizable. The person has a ${build} build — render realistic body ` +
    "proportions that match them; DO NOT slim them down or alter their body " +
    "shape. Dress them in a plain white crew-neck t-shirt and classic mid-blue " +
    "jeans (the same base outfit every time). Show the ENTIRE body from head to " +
    "feet: the head and the feet (with shoes) must be fully visible and NOT " +
    "cropped, leaving a little empty space above the head and below the feet. " +
    "The person stands centered and full-length in the frame, facing forward in " +
    "a natural relaxed posture. Plain flat light-grey studio background, cool " +
    "neutral lighting (NO warm or golden tones). Editorial, clean. No text, no " +
    "props, no extra people."
  );
}

// Una generación con Gemini. Devuelve el base64 de la imagen o null.
async function generarAvatar(parts: unknown[]): Promise<string | null> {
  const gemRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:4" },
        },
      }),
    }
  );
  if (!gemRes.ok) return null;
  const data = await gemRes.json();
  const img = data?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data
  );
  return (img?.inlineData?.data as string | undefined) ?? null;
}

// Juez de parecido (best-effort): compara la selfie con el avatar generado y
// puntúa la identidad facial 1-10. Si no hay API key o falla, devuelve null y
// el avatar pasa sin juez (nunca rompe la generación).
async function juzgarParecido(
  faceB64: string,
  avatarB64: string
): Promise<{ score: number; problema: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      system:
        "Comparas la SELFIE real de una persona (primera imagen) con un AVATAR generado por IA (segunda imagen). Puntúa del 1 al 10 qué tan reconocible es como LA MISMA persona: rasgos faciales, tono de piel, pelo (color, largo, textura), edad aparente. 10 = claramente la misma persona; 5 = parecido genérico; 1 = otra persona. Sé exigente con la identidad facial. Señala en una frase el problema principal si hay uno.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: faceB64 } },
            { type: "image", source: { type: "base64", media_type: "image/png", data: avatarB64 } },
            { type: "text", text: "¿Qué tan parecido es el avatar a la persona de la selfie?" },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              score: { type: "integer" },
              problema: { type: "string" },
            },
            required: ["score", "problema"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { score: number; problema: string };
    if (typeof parsed.score !== "number") return null;
    return { score: Math.max(1, Math.min(10, parsed.score)), problema: parsed.problema ?? "" };
  } catch {
    return null;
  }
}

// Genera el avatar digital base (cuerpo completo, neutral) a partir de las fotos
// que sube la persona. Las fotos fuente NO se persisten — solo viajan en esta
// request. Devuelve la imagen como base64; el cliente la confirma o rehace.
// Consistencia: acepta hasta 2 fotos de cara y 3 de cuerpo (Gemini 3 Pro Image
// soporta muchas referencias — más ángulos = identidad más fiel), y un juez de
// visión puntúa el parecido: si sale bajo, se regenera una vez en silencio.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: {
    faceB64?: string;
    faceExtraB64?: string[];
    bodyB64?: string[];
    bodyType?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { faceB64, faceExtraB64, bodyB64, bodyType } = body;
  if (
    !faceB64 ||
    !Array.isArray(bodyB64) ||
    bodyB64.length === 0 ||
    !bodyType ||
    !BUILD[bodyType]
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // Topes de referencias (defensa; el wizard manda máx 2 caras + 3 cuerpos).
  const faces = [faceB64, ...(Array.isArray(faceExtraB64) ? faceExtraB64 : [])].slice(0, 2);
  const bodies = bodyB64.slice(0, 3);

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  try {
    const parts = [
      { text: buildPrompt(BUILD[bodyType], faces.length) },
      ...faces.map((d) => ({ inlineData: { mimeType: "image/jpeg", data: d } })),
      ...bodies.map((d) => ({ inlineData: { mimeType: "image/jpeg", data: d } })),
    ];

    let image = await generarAvatar(parts);
    if (!image) return NextResponse.json({ error: "generacion" }, { status: 502 });

    // Juez de parecido: si el primer intento sale bajo, UN reintento y nos
    // quedamos con el de mejor score. Best-effort: sin juez, pasa tal cual.
    let veredicto = await juzgarParecido(faceB64, image);
    let reintento = false;
    if (veredicto && veredicto.score < JUDGE_MIN) {
      reintento = true;
      const segunda = await generarAvatar(parts);
      if (segunda) {
        const v2 = await juzgarParecido(faceB64, segunda);
        if (v2 && v2.score > veredicto.score) {
          image = segunda;
          veredicto = v2;
        }
      }
    }

    // Instrumentación del flywheel: cómo puntúa el juez y cuánto reintenta.
    await supabase.from("events").insert({
      user_id: user.id,
      type: "avatar_judge",
      data: {
        score: veredicto?.score ?? null,
        problema: veredicto?.problema || null,
        reintento,
        n_caras: faces.length,
        n_cuerpos: bodies.length,
      },
    });

    return NextResponse.json({ image });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
