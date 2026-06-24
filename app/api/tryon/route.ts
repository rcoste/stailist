import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickItemImage, ITEM_IMAGE_SELECT, type ItemImageRow } from "@/lib/item-image";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";

const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image wearing the exact clothing items shown in the following images. Keep the person's face, body type, skin tone and hair identical. Replace only their outfit with the provided garments. Plain warm off-white background, soft natural light, editorial street-style look, standing naturally. No text.";

// Construye el prompt final inyectando el TIP de styling del outfit (cómo se lleva
// el look: arremangar, fajar, abrir un botón…) para que la imagen lo refleje. El
// tip viene en español; Gemini lo entiende. Sin tip, el prompt base tal cual.
function buildPrompt(tip: string | null, garments: string[]): string {
  let p = PROMPT;
  // Ancla de texto (red de seguridad): nombra las prendas (en español; Gemini las
  // entiende). Si por lo que sea una imagen no llega, el modelo no inventa una
  // prenda genérica — sabe que es "un suéter esmeralda", no una t-shirt blanca.
  if (garments.length > 0) {
    p += ` The garments are (described in Spanish): ${garments.join("; ")}.`;
  }
  const t = (tip ?? "").trim();
  if (t) {
    p += ` IMPORTANT styling detail — wear the garments following this note (written in Spanish), reflecting it visibly in how the clothes are styled on the body: "${t}".`;
  }
  return p;
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
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .in("id", outfit.item_ids as string[]);

  const origin = request.nextUrl.origin;
  const avatarUrl = await signFresh(profile.avatar_path);
  if (!avatarUrl) return NextResponse.json({ error: "avatar" }, { status: 502 });

  // Imagen de cada prenda vía el resolver único (pickItemImage): arquetipo → render
  // limpio → foto → prestada. Pública = origin + ruta; privada = URL firmada.
  const prendaUrls: string[] = [];
  const prendaNames: string[] = [];
  for (const it of items ?? []) {
    const pick = pickItemImage(it as ItemImageRow);
    if (pick) {
      const u = pick.kind === "public" ? origin + pick.path : await signFresh(pick.path);
      if (u) prendaUrls.push(u);
    }
    const archName = (it.archetypes as { name?: string | null } | null)?.name;
    const attrs = (it.attrs ?? {}) as { nombre?: string; color?: string };
    const nm = (archName ?? attrs.nombre ?? "").trim();
    if (nm) {
      prendaNames.push(
        attrs.color && !nm.toLowerCase().includes(attrs.color.toLowerCase())
          ? `${nm} (color ${attrs.color})`
          : nm
      );
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
      { text: buildPrompt((outfit.tip as string | null) ?? null, prendaNames) },
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
