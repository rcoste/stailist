import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateArchetypeImage } from "@/lib/archetype-image";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";

// Render limpio de UNA prenda. La estrategia ganadora es IMAGEN→IMAGEN: en vez
// de describir la prenda en texto (que pierde el estilo real — hay mil cortes),
// le pasamos a Gemini la FOTO ORIGINAL y le pedimos extraer ESA prenda en
// flat-lay, conservando su color/corte/material/detalles reales. El texto solo
// sirve para señalar CUÁL prenda extraer de la foto. Fallback a texto→imagen si
// no llega foto. Un render por request (límite 60s de Vercel).
// Spec: docs/designs/import-carrete-multiprenda.md
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_gemini" }, { status: 503 });
  }

  let body: { image?: string; attrs?: Partial<PrendaAnalisis> & { descripcion?: string } } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const attrs = body.attrs ?? {};
  const nombre = (attrs.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "sin_nombre" }, { status: 400 });

  // Qué prenda extraer: la descripción visual + el color confirmado (si el
  // usuario lo corrigió con el swatch, manda sobre lo que diga la foto).
  const quePrenda = (attrs.descripcion ?? "").trim() || nombre;
  const conColor = attrs.color ? `${quePrenda}, en color ${attrs.color}` : quePrenda;

  let bytes: Buffer | null = null;

  // Camino principal: imagen→imagen desde la foto original.
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) {
    const [, mediaType, b64] = match;
    bytes = await extractGarment(b64, mediaType, conColor, attrs.categoria);
  }

  // Fallback: texto→imagen (si no llegó foto o falló la extracción).
  if (!bytes) {
    const type = attrs.categoria === "calzado" ? "shoes" : "flat";
    bytes = await generateArchetypeImage(conColor, type);
  }
  if (!bytes) return NextResponse.json({ error: "render_fallo" }, { status: 502 });

  const path = `${user.id}/render-${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (up.error) {
    return NextResponse.json({ error: "upload_fallo" }, { status: 502 });
  }

  const { data: signed } = await supabase.storage
    .from("prendas")
    .createSignedUrl(path, 3600);

  return NextResponse.json({ path, url: signed?.signedUrl ?? null });
}

// Extrae UNA prenda de la foto de la persona y la devuelve como flat-lay limpio,
// fiel a la prenda real. Devuelve null si falla (el caller cae al fallback).
async function extractGarment(
  photoB64: string,
  mimeType: string,
  quePrenda: string,
  categoria?: string
): Promise<Buffer | null> {
  const encuadre =
    categoria === "calzado"
      ? "placed neatly side by side, shot from a slight top-down angle, filling about 65% of the frame"
      : "neatly laid flat and slightly styled, shot directly from above, filling about 70% of the frame";

  const prompt = `From the photo of the person, isolate ONLY this single garment they are wearing: ${quePrenda}. Produce a professional e-commerce flat lay photograph of just that one garment, ${encuadre}. CRITICAL: preserve the garment's exact real-world color, cut, silhouette, fabric, texture, pattern and distinctive details (collar, sleeves, buttons, zipper, sole, etc.) exactly as seen on the person — do not redesign it, do not change its style. Remove the person, any other garments, and the background entirely. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. No people, no props, no text, no labels.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: photoB64 } },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "1:1" },
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("[render-prenda] Gemini HTTP", res.status);
      return null;
    }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string } }) => p.inlineData?.data
    );
    if (!part?.inlineData?.data) return null;
    return Buffer.from(part.inlineData.data, "base64");
  } catch (err) {
    console.error("[render-prenda] fallo:", err);
    return null;
  }
}
