import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";

// El tipo de cuerpo que eligió en bocetos alimenta el prompt. Espejo fiel: NO
// adelgazar. Básicos ajustados → la silueta se ve para que el try-on sea fiel.
const BUILD: Record<string, string> = {
  slim: "slim",
  athletic: "athletic and toned",
  average: "average",
  full: "fuller, heavier-set",
};

function buildPrompt(build: string): string {
  return (
    "Generate a photorealistic full-body portrait of the SAME person shown in " +
    "the provided photos (the first image is their face; the others show their " +
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

// Genera el avatar digital base (cuerpo completo, neutral) a partir de las fotos
// que sube la persona. Las fotos fuente NO se persisten — solo viajan en esta
// request. Devuelve la imagen como base64; el cliente la confirma o rehace.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: { faceB64?: string; bodyB64?: string[]; bodyType?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { faceB64, bodyB64, bodyType } = body;
  if (
    !faceB64 ||
    !Array.isArray(bodyB64) ||
    bodyB64.length === 0 ||
    !bodyType ||
    !BUILD[bodyType]
  ) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  try {
    const parts = [
      { text: buildPrompt(BUILD[bodyType]) },
      { inlineData: { mimeType: "image/jpeg", data: faceB64 } },
      ...bodyB64.map((d) => ({ inlineData: { mimeType: "image/jpeg", data: d } })),
    ];
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
    if (!gemRes.ok) return NextResponse.json({ error: "generacion" }, { status: 502 });
    const data = await gemRes.json();
    const img = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string } }) => p.inlineData?.data
    );
    if (!img) return NextResponse.json({ error: "sin_imagen" }, { status: 502 });

    return NextResponse.json({ image: img.inlineData.data as string });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
