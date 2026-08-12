import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickItemImage, ITEM_IMAGE_SELECT, type ItemImageRow } from "@/lib/item-image";
import { pedirImagen } from "@/lib/gemini-imagen";
import { llaveDeCombo } from "@/lib/tryon-combo";

export const maxDuration = 60;

const MAX_GARMENTS = 4;

const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image " +
  "wearing an outfit made of the exact clothing items shown in the following " +
  "images, combined into one coherent look. Keep the person's face, facial " +
  "expression, apparent age, body type, skin tone and hair identical. Use only the provided garments (fill obvious " +
  "gaps with simple neutral basics). Plain flat light-grey wall, cool neutral " +
  "daylight (no warm golden tones), crisp and clear. Relaxed natural posture, and " +
  "keep the person's natural facial expression from the first image — do NOT change or neutralize it. Full body head to feet. No text.";

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
// solo try-on sobre el avatar.
//
// CON CACHÉ DESDE 2026-08-12. Nació sin él a propósito —"es ad-hoc", decía el
// comentario, "para no escribir storage por cada combinación"— y la intención
// era buena. El hueco es que **ad-hoc no significa irrepetible**: probar los
// mismos zapatos con el mismo pantalón dos veces ES la forma de una decisión de
// compra, y cada vez se pagaba una generación de imagen entera. Peor: la imagen
// se devolvía en base64 y se perdía al cerrar la hoja, así que ni siquiera la
// primera sobrevivía.
//
// El caché no llena Storage de basura porque la llave es DETERMINISTA (ver
// llaveDeCombo): la misma combinación siempre escribe el mismo archivo. Diez
// intentos de la misma combinación son un archivo, no diez. Mismo patrón que su
// hermano de una sola prenda, que ya cacheaba en `wishlist_items.tryon_path`.
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

  // ¿Ya dibujamos ESTA combinación sobre ESTE avatar? Se pregunta antes de
  // bajar una sola imagen: firmar una ruta que no existe devuelve error y
  // `signFresh` lo vuelve null, así que la ausencia se detecta sin listar el
  // bucket ni consultar tabla alguna.
  const comboPath = `${user.id}/combo-${llaveDeCombo(
    profile.avatar_path as string,
    wishlistIds,
    itemIds
  )}.jpg`;
  const cacheada = await signFresh(comboPath);
  if (cacheada) return NextResponse.json({ image: cacheada, cached: true });

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
    // Por la puerta común (lib/gemini-imagen): reintento, timeout y motivo real.
    // Esta era otra copia suelta del mismo fetch — las cazó lib/thinking.test.ts.
    const r = await pedirImagen(parts, { aspecto: "3:4" });
    if ("motivo" in r) {
      console.error(`[wishlist combo] ${r.motivo}`);
      return NextResponse.json(
        { error: "generacion", detalle: r.motivo },
        { status: 502 }
      );
    }

    // Se sube ANTES de responder, con `upsert`: la ruta es determinista, así
    // que reescribir es idempotente y no acumula copias.
    //
    // Si la subida falla NO se pierde el trabajo: se devuelve la imagen igual,
    // en base64 como antes. La persona ve su look —que es lo que pidió y lo que
    // ya se pagó— y lo único que se pierde es el ahorro de la próxima vez.
    const buffer = Buffer.from(r.data, "base64");
    const up = await supabase.storage
      .from("prendas")
      .upload(comboPath, buffer, { contentType: "image/jpeg", upsert: true });
    if (!up.error) {
      const url = await signFresh(comboPath);
      if (url) return NextResponse.json({ image: url });
    }
    return NextResponse.json({ image: `data:image/jpeg;base64,${r.data}` });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
