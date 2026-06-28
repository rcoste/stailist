import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickItemImage, ITEM_IMAGE_SELECT, type ItemImageRow } from "@/lib/item-image";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";
const MAX_GARMENTS = 4;

const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image " +
  "wearing an outfit made of the exact clothing items shown in the following " +
  "images, combined into one coherent look. Keep the person's face, body type, " +
  "skin tone and hair identical. Use only the provided garments (fill obvious " +
  "gaps with simple neutral basics). Plain flat light-grey wall, cool neutral " +
  "daylight (no warm golden tones), crisp and clear. Calm neutral expression, " +
  "closed mouth, relaxed natural posture. Full body head to feet. No text.";

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

// Cartera · Fase 3c: combinar candidatos del Wishlist + prendas del clóset en un
// solo try-on sobre el avatar. Bajo demanda (sin caché — es ad-hoc). Devuelve la
// imagen como data URL para no escribir storage por cada combinación.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: { wishlistIds?: string[]; itemIds?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const wishlistIds = (body.wishlistIds ?? []).filter(Boolean);
  const itemIds = (body.itemIds ?? []).filter(Boolean);
  const total = wishlistIds.length + itemIds.length;
  if (total === 0) return NextResponse.json({ error: "sin_prendas" }, { status: 400 });
  if (total > MAX_GARMENTS) return NextResponse.json({ error: "demasiadas" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.avatar_path) {
    return NextResponse.json({ error: "sin_avatar" }, { status: 200 });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  const origin = request.nextUrl.origin;
  const signFresh = async (path: string) => {
    const { data } = await supabase.storage.from("prendas").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const garmentUrls: string[] = [];

  // Candidatos del wishlist (foto privada del usuario).
  if (wishlistIds.length) {
    const { data: wl } = await supabase
      .from("wishlist_items")
      .select("id, image_path")
      .eq("user_id", user.id)
      .in("id", wishlistIds);
    for (const w of wl ?? []) {
      const u = await signFresh(w.image_path as string);
      if (u) garmentUrls.push(u);
    }
  }

  // Prendas del clóset (arquetipo público o render/foto privada).
  if (itemIds.length) {
    const { data: items } = await supabase
      .from("items")
      .select(`id, ${ITEM_IMAGE_SELECT}`)
      .eq("user_id", user.id)
      .in("id", itemIds);
    for (const it of items ?? []) {
      const pick = pickItemImage(it as ItemImageRow);
      const u = pick
        ? pick.kind === "public"
          ? origin + pick.path
          : await signFresh(pick.path)
        : null;
      if (u) garmentUrls.push(u);
    }
  }

  if (garmentUrls.length === 0) {
    return NextResponse.json({ error: "sin_prendas" }, { status: 400 });
  }

  const avatarUrl = await signFresh(profile.avatar_path);
  if (!avatarUrl) return NextResponse.json({ error: "avatar" }, { status: 502 });
  const avatarB64 = await fetchAsBase64(avatarUrl);
  const garmentsB64 = (await Promise.all(garmentUrls.map(fetchAsBase64))).filter(
    (b): b is string => !!b
  );
  if (!avatarB64 || garmentsB64.length === 0) {
    return NextResponse.json({ error: "descarga" }, { status: 502 });
  }

  try {
    const parts = [
      { text: PROMPT },
      { inlineData: { mimeType: "image/jpeg", data: avatarB64 } },
      ...garmentsB64.map((d) => ({ inlineData: { mimeType: "image/jpeg", data: d } })),
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
    return NextResponse.json({ image: `data:image/jpeg;base64,${img.inlineData.data}` });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
