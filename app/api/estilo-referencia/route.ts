import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Estilo de referencia: el usuario sube la foto de alguien cuyo estilo le gusta.
// Analizamos el ESTILO (no la persona) con Claude visión → resumen + tags, lo
// guardamos en profiles.style_reference (+ la foto en bucket privado), y el motor
// de outfits lo usa como inspiración de vibe/silueta (NO de color: la colorimetría
// del usuario sigue mandando el color).
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

  // 1) Guarda la foto en el bucket privado (es la referencia del usuario, no se publica).
  const ext = mediaType.includes("png") ? "png" : "jpg";
  const path = `${user.id}/style-ref/${crypto.randomUUID()}.${ext}`;
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const up = await supabase.storage
    .from("prendas")
    .upload(path, bytes, { contentType: mediaType, upsert: false });
  if (up.error) {
    return NextResponse.json({ error: "upload" }, { status: 502 });
  }

  // 2) Analiza el ESTILO con Claude visión (estructurado).
  let summary = "";
  let tags: string[] = [];
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      system:
        "Eres estilista. Miras la foto de una persona cuyo ESTILO le gusta a tu clienta y describes el ESTILO, NO a la persona (nunca menciones su físico, cara ni identidad). Captura: estética general, tipos de prenda y siluetas, nivel de formalidad, y el aire de la paleta (cálida/fría, neutra/colorida). Voz cálida y directa, tuteo, cero jerga técnica de moda. `summary`: 1-2 frases que un motor de outfits pueda usar para empujar el vibe (ej: 'Off-duty europeo elegante: sastrería relajada con denim, neutros y tonos tierra, accesorios estructurados, loafers o botas'). `tags`: 4-6 etiquetas cortas en minúscula (ej: 'minimalista', 'sastrería', 'neutro', 'elevado-casual').",
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
            { type: "text", text: "Describe el estilo de esta persona." },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "tags"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    if (text) {
      const parsed = JSON.parse(text) as { summary?: string; tags?: string[] };
      summary = (parsed.summary ?? "").trim();
      tags = (parsed.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 6);
    }
  } catch {
    // Si el análisis falla, limpiamos la foto huérfana y avisamos.
    await supabase.storage.from("prendas").remove([path]);
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
  if (!summary) {
    await supabase.storage.from("prendas").remove([path]);
    return NextResponse.json({ error: "vacio" }, { status: 502 });
  }

  // 3) Guarda en el perfil (reemplaza la referencia anterior; borra su foto vieja).
  const { data: prev } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const oldPath = (prev?.style_reference as { image_path?: string } | null)?.image_path;
  if (oldPath && oldPath !== path) {
    await supabase.storage.from("prendas").remove([oldPath]);
  }

  const style_reference = { summary, tags, image_path: path };
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ style_reference })
    .eq("id", user.id);
  if (updErr) return NextResponse.json({ error: "save" }, { status: 502 });

  const { data: signed } = await supabase.storage
    .from("prendas")
    .createSignedUrl(path, 3600);

  return NextResponse.json({ summary, tags, image: signed?.signedUrl ?? null });
}
