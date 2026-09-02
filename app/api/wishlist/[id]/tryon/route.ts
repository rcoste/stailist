import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pedirImagen } from "@/lib/gemini-imagen";
import { revisarCuota } from "@/lib/cuotas";

export const maxDuration = 60;


// Mismo lenguaje v3 que /api/tryon: viste el avatar con la prenda, foto limpia.
const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image " +
  "wearing the garment shown in the second image. Keep the person's face, facial " +
  "expression, apparent age, body type, skin tone and hair identical. Replace only their top/relevant clothing " +
  "with the provided garment, keeping the rest of a simple neutral base outfit. " +
  "Plain flat light-grey wall, cool neutral daylight (no warm golden tones), " +
  "crisp and clear. Relaxed natural posture, and keep the person's natural facial " +
  "expression from the first image — do NOT change or neutralize it. Full body head to feet. No text.";

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

  // Tope diario de IA (lib/cuotas.ts). 429 y NO 500: no es un fallo, es un
  // límite, y el cliente lo distingue para enseñar el mensaje tal cual.
  const cuota = await revisarCuota(supabase, user.id, "tryon");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

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
    // Por la puerta común (lib/gemini-imagen): reintento, timeout y motivo real.
    // Esta era otra copia suelta del mismo fetch — las cazó lib/thinking.test.ts.
    const r = await pedirImagen(parts, {
      aspecto: "3:4",
      ctx: { supabase, userId: user.id, tarea: "tryon-wishlist" },
    });
    if ("motivo" in r) {
      console.error(`[wishlist tryon] ${r.motivo}`);
      return NextResponse.json(
        { error: "generacion", detalle: r.motivo },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(r.data, "base64");
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
