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

// Reglas de identidad compartidas por las dos etapas (retrato y cuerpo).
const IDENTITY_RULES =
  "Keep their face, skin tone, hair and identity identical and clearly " +
  "recognizable, INCLUDING their natural facial expression from the photos — if " +
  "they are smiling, keep the smile; if they are serious or neutral, keep that; " +
  "do NOT change or neutralize their expression. Also keep their apparent age " +
  "from the photos — do NOT make them look younger or older than they are, and " +
  "do NOT beautify or idealize them. ";

// Etapa 1 — retrato (cara primero): la identidad se aprueba barata y enfocada
// antes de gastar en el cuerpo. `ajuste` = corrección dirigida de la persona
// ("pelo más corto", "sin lentes"…) aplicada sobre el retrato previo.
function buildFacePrompt(nFaces: number, ajuste: string | null, hasPrev: boolean): string {
  const faceRef =
    nFaces > 1
      ? `the first ${nFaces} images show their face from different angles`
      : "the first image is their face";
  let p =
    "Generate a photorealistic head-and-shoulders studio portrait of the SAME " +
    `person shown in the provided photos (${faceRef}). ` +
    IDENTITY_RULES +
    "They wear a plain white crew-neck t-shirt. They face the camera directly, " +
    "head and shoulders centered. Plain flat light-grey studio background, cool " +
    "neutral lighting (NO warm or golden tones). Editorial, clean. No text, no " +
    "props, no extra people.";
  if (ajuste && hasPrev) {
    p +=
      " The LAST image is the previous attempt. The person asked for exactly ONE " +
      `correction (given in Spanish): "${ajuste}". Apply ONLY that correction and ` +
      "keep everything else from the previous attempt unchanged.";
  } else if (ajuste) {
    p += ` The person asked for one correction (given in Spanish): "${ajuste}". Apply it.`;
  }
  return p;
}

// Etapa 2 — cuerpo completo anclado al retrato APROBADO (primera imagen): la
// identidad ya no se re-interpreta, se copia. Las fotos de cuerpo son opcionales.
function buildBodyPrompt(build: string, nBodies: number): string {
  return (
    "Generate a photorealistic full-body portrait of the SAME person shown in " +
    "the FIRST image — an approved studio portrait of them. Match their face, " +
    "hair, skin tone and facial expression from that portrait EXACTLY; it is " +
    "the source of truth for their identity. " +
    (nBodies > 0
      ? `The last ${nBodies} image(s) show their real body — use them for body ` +
        "proportions and posture. "
      : "") +
    IDENTITY_RULES +
    `The person has a ${build} build — render realistic body ` +
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

// Etapa 3 (A2) — character sheet: UNA generación con las TRES vistas (frente /
// perfil / espalda) a partir del retrato y el cuerpo APROBADOS. Una sola imagen
// = consistente por construcción (3 generaciones separadas re-interpretan la
// identidad 3 veces). El sheet alimenta el try-on como referencia de identidad.
function buildSheetPrompt(): string {
  return (
    "Generate a photorealistic character reference sheet of the SAME person " +
    "shown in the provided images (their approved portrait and full-body view). " +
    "ONE single image containing THREE full-body views of that person standing " +
    "side by side, evenly spaced on one row: (1) facing the camera front-on, " +
    "(2) exact left profile side view, (3) seen fully from the back. " +
    IDENTITY_RULES +
    "Identical hairstyle, identical white crew-neck t-shirt, classic mid-blue " +
    "jeans and the same shoes in ALL three views. Same height and body " +
    "proportions in all views, full body head to feet visible in each. Plain " +
    "flat light-grey studio background, cool neutral lighting (NO warm or " +
    "golden tones). No text, no labels, no props, no extra people."
  );
}

// Legacy (clientes con JS viejo cacheado): una sola pasada fotos → cuerpo entero.
function buildPrompt(build: string, nFaces: number): string {
  const faceRef =
    nFaces > 1
      ? `the first ${nFaces} images show their face from different angles`
      : "the first image is their face";
  return (
    "Generate a photorealistic full-body portrait of the SAME person shown in " +
    `the provided photos (${faceRef}; the others show their ` +
    "body). " +
    IDENTITY_RULES +
    `The person has a ${build} build — render realistic body ` +
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
// `aspect`: 3:4 para retrato/cuerpo; 16:9 para el character sheet (3 vistas).
async function generarAvatar(parts: unknown[], aspect: "3:4" | "16:9" = "3:4"): Promise<string | null> {
  const gemRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: aspect },
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

// El media_type DEBE coincidir con los bytes reales (la API lo valida y truena
// con 400 si no) — Gemini devuelve JPEG o PNG según le da. Detectamos por los
// magic bytes del base64. Este mismatch tuvo al juez roto en silencio desde su
// estreno (declaraba png fijo): score null en todos los eventos.
function mediaTypeOf(b64: string): "image/png" | "image/jpeg" | "image/webp" {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
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
            { type: "image", source: { type: "base64", media_type: mediaTypeOf(faceB64), data: faceB64 } },
            { type: "image", source: { type: "base64", media_type: mediaTypeOf(avatarB64), data: avatarB64 } },
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
    stage?: string; // "face" | "body" | "sheet" | ausente (legacy: una pasada)
    faceB64?: string;
    faceExtraB64?: string[];
    bodyB64?: string[];
    bodyType?: string;
    ajuste?: string; // etapa face: corrección dirigida ("pelo más corto"…)
    prevFaceB64?: string; // etapa face: retrato previo (base del ajuste)
    headshotB64?: string; // etapas body/sheet: retrato APROBADO (ancla)
    avatarB64?: string; // etapa sheet: cuerpo completo APROBADO
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { faceB64, faceExtraB64, bodyB64, bodyType } = body;
  const stage =
    body.stage === "face" || body.stage === "body" || body.stage === "sheet"
      ? body.stage
      : null;

  // El sheet no usa las fotos crudas: parte del retrato + cuerpo APROBADOS.
  if (stage === "sheet") {
    if (!body.headshotB64 || !body.avatarB64) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
    }
    try {
      const img = (d: string) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } });
      const image = await generarAvatar(
        [{ text: buildSheetPrompt() }, img(body.headshotB64), img(body.avatarB64)],
        "16:9"
      );
      if (!image) return NextResponse.json({ error: "generacion" }, { status: 502 });
      return NextResponse.json({ image });
    } catch {
      return NextResponse.json({ error: "generacion" }, { status: 502 });
    }
  }

  if (!faceB64) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  // Cuerpo (etapa 2 o legacy) exige bodyType; las fotos de cuerpo son opcionales
  // en la etapa 2 (el retrato aprobado + la complexión bastan) y obligatorias
  // solo en el flujo legacy.
  const bodies = (Array.isArray(bodyB64) ? bodyB64 : []).slice(0, 3);
  if (stage !== "face") {
    if (!bodyType || !BUILD[bodyType]) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (stage === "body" && !body.headshotB64) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (stage === null && bodies.length === 0) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
  }
  // Topes de referencias (defensa; el wizard manda máx 2 caras + 3 cuerpos).
  const faces = [faceB64, ...(Array.isArray(faceExtraB64) ? faceExtraB64 : [])].slice(0, 2);
  const ajuste = typeof body.ajuste === "string" ? body.ajuste.trim().slice(0, 140) : "";

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  try {
    const img = (d: string) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } });
    let parts: unknown[];
    if (stage === "face") {
      const hasPrev = !!body.prevFaceB64 && !!ajuste;
      parts = [
        { text: buildFacePrompt(faces.length, ajuste || null, hasPrev) },
        ...faces.map(img),
        ...(hasPrev ? [img(body.prevFaceB64 as string)] : []),
      ];
    } else if (stage === "body") {
      parts = [
        { text: buildBodyPrompt(BUILD[bodyType as string], bodies.length) },
        img(body.headshotB64 as string),
        ...bodies.map(img),
      ];
    } else {
      parts = [
        { text: buildPrompt(BUILD[bodyType as string], faces.length) },
        ...faces.map(img),
        ...bodies.map(img),
      ];
    }

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
        stage: stage ?? "legacy",
        ajuste: ajuste || null,
        n_caras: faces.length,
        n_cuerpos: bodies.length,
      },
    });

    // El veredicto ya no se tira: el wizard lo muestra ("ojo: {problema}") y
    // ofrece ajustes dirigidos cuando sale bajo.
    return NextResponse.json({
      image,
      score: veredicto?.score ?? null,
      problema: veredicto?.problema || null,
    });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
