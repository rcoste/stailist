import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";

// Mismo lenguaje v3 que /api/tryon: viste el avatar con la prenda, foto limpia.
const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image " +
  "wearing the garment shown in the second image. Keep the person's face, body " +
  "type, skin tone and hair identical. Replace only their top/relevant clothing " +
  "with the provided garment, keeping the rest of a simple neutral base outfit. " +
  "Plain flat light-grey wall, cool neutral daylight (no warm golden tones), " +
  "crisp and clear. Calm neutral expression, closed mouth, relaxed natural " +
  "posture. Full body head to feet. No text.";

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

// Cartera · Fase 3b: "verme con esto" sobre un candidato del Wishlist. Reusa el
// motor de try-on (Gemini) con el avatar + la foto de la prenda del wishlist.
// Cachea en wishlist_items.tryon_path (no regenera). Bajo demanda: cuesta/tarda.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.avatar_path) {
    return NextResponse.json({ error: "sin_avatar" }, { status: 200 });
  }

  const { data: item } = await supabase
    .from("wishlist_items")
    .select("id, image_path, tryon_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!item) return NextResponse.json({ error: "no_item" }, { status: 404 });

  const signFresh = async (path: string) => {
    const { data } = await supabase.storage.from("prendas").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  if (item.tryon_path) {
    const url = await signFresh(item.tryon_path as string);
    if (url) return NextResponse.json({ image: url, cached: true });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  const avatarUrl = await signFresh(profile.avatar_path);
  const garmentUrl = await signFresh(item.image_path as string);
  if (!avatarUrl || !garmentUrl) {
    return NextResponse.json({ error: "avatar" }, { status: 502 });
  }
  const avatarB64 = await fetchAsBase64(avatarUrl);
  const garmentB64 = await fetchAsBase64(garmentUrl);
  if (!avatarB64 || !garmentB64) {
    return NextResponse.json({ error: "descarga" }, { status: 502 });
  }

  try {
    const parts = [
      { text: PROMPT },
      { inlineData: { mimeType: "image/jpeg", data: avatarB64 } },
      { inlineData: { mimeType: "image/jpeg", data: garmentB64 } },
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

    const buffer = Buffer.from(img.inlineData.data, "base64");
    const path = `${user.id}/tryons/wishlist-${id}.jpg`;
    const up = await supabase.storage
      .from("prendas")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (up.error) {
      console.error("[wishlist tryon] upload falló:", up.error.message);
      return NextResponse.json({ error: "guardar" }, { status: 502 });
    }
    await supabase.from("wishlist_items").update({ tryon_path: path }).eq("id", id);
    const url = await signFresh(path);
    return NextResponse.json({ image: url, cached: false });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
