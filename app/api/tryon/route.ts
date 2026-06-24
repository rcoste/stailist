import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";

const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image wearing the exact clothing items shown in the following images. Keep the person's face, body type, skin tone and hair identical. Replace only their outfit with the provided garments. Plain warm off-white background, soft natural light, editorial street-style look, standing naturally. No text.";

// Construye el prompt final inyectando el TIP de styling del outfit (cómo se lleva
// el look: arremangar, fajar, abrir un botón…) para que la imagen lo refleje. El
// tip viene en español; Gemini lo entiende. Sin tip, el prompt base tal cual.
function buildPrompt(tip: string | null): string {
  const t = (tip ?? "").trim();
  if (!t) return PROMPT;
  return `${PROMPT} IMPORTANT styling detail — wear the garments following this note (written in Spanish), reflecting it visibly in how the clothes are styled on the body: "${t}".`;
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch {
    return null;
  }
}

// "Verme con este look": viste el avatar de la usuaria con las prendas reales
// del outfit usando Gemini 3 Pro Image. Cachea el resultado por outfit (no
// regenera). Bajo demanda — cada try-on cuesta y tarda. Gemini genera, Claude
// razona.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: { outfitId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { outfitId } = body;
  if (!outfitId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Avatar de la usuaria
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.avatar_path) {
    return NextResponse.json({ error: "sin_avatar" }, { status: 200 });
  }

  // Outfit (y cache si ya se generó antes)
  const { data: outfit } = await supabase
    .from("outfits")
    .select("id, item_ids, tryon_path, tip")
    .eq("id", outfitId)
    .eq("user_id", user.id)
    .single();
  if (!outfit) return NextResponse.json({ error: "no_outfit" }, { status: 404 });

  const signFresh = async (path: string) => {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  if (outfit.tryon_path) {
    const url = await signFresh(outfit.tryon_path);
    if (url) return NextResponse.json({ image: url, cached: true });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  // Resolver las imágenes: avatar (privado) + cada prenda (arquetipo público o
  // foto propia privada).
  const { data: items } = await supabase
    .from("items")
    .select("id, photo_path, render_path, render_status, attrs, archetypes(image_path)")
    .in("id", outfit.item_ids as string[]);

  const origin = request.nextUrl.origin;
  const avatarUrl = await signFresh(profile.avatar_path);
  if (!avatarUrl) return NextResponse.json({ error: "avatar" }, { status: 502 });

  // Mismo orden que el resto de la app (loadClosetImageMap): arquetipo → render
  // limpio → foto cruda → prestada. Antes solo leía arquetipo + foto, así que las
  // prendas de "ya lo tengo" (sin archetype_id ni foto: su imagen vive en
  // render_path o attrs.image_path) NO aportaban imagen → Gemini inventaba una
  // prenda genérica (una t-shirt blanca por un suéter esmeralda).
  const prendaUrls: string[] = [];
  for (const it of items ?? []) {
    const arch = it.archetypes as { image_path?: string | null } | null;
    const attrs = (it.attrs ?? {}) as { image_path?: string | null };
    const renderDone = it.render_status === "done" && it.render_path;
    if (arch?.image_path) {
      prendaUrls.push(origin + arch.image_path);
    } else if (renderDone) {
      const u = await signFresh(it.render_path as string);
      if (u) prendaUrls.push(u);
    } else if (it.photo_path) {
      const u = await signFresh(it.photo_path as string);
      if (u) prendaUrls.push(u);
    } else if (attrs.image_path) {
      prendaUrls.push(origin + attrs.image_path);
    }
  }
  if (prendaUrls.length === 0) {
    return NextResponse.json({ error: "sin_prendas" }, { status: 400 });
  }

  const avatarB64 = await fetchAsBase64(avatarUrl);
  const prendasB64 = (await Promise.all(prendaUrls.map(fetchAsBase64))).filter(
    (b): b is string => !!b
  );
  if (!avatarB64 || prendasB64.length === 0) {
    return NextResponse.json({ error: "descarga" }, { status: 502 });
  }

  try {
    const parts = [
      { text: buildPrompt((outfit.tip as string | null) ?? null) },
      { inlineData: { mimeType: "image/jpeg", data: avatarB64 } },
      ...prendasB64.map((d) => ({ inlineData: { mimeType: "image/jpeg", data: d } })),
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
    const path = `${user.id}/tryons/${outfitId}.jpg`;
    const up = await supabase.storage
      .from("prendas")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (up.error) return NextResponse.json({ error: "guardar" }, { status: 502 });

    await supabase.from("outfits").update({ tryon_path: path }).eq("id", outfitId);
    const url = await signFresh(path);
    return NextResponse.json({ image: url, cached: false });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
