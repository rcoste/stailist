import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { generateArchetypeImage } from "@/lib/archetype-image";
import { extraerPrendaDeFoto } from "@/lib/extraer-prenda";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";
import { revisarCuota } from "@/lib/cuotas";
import { leerImagenEntrante, MOTIVO_IMAGEN } from "@/lib/imagen-entrante";

export const maxDuration = 60;

// El modelo del render de prenda, en un solo lugar. Medido el 2026-08-06
// sobre la misma foto y el mismo prompt: este 17.3s de promedio; el rápido
// (GEMINI_MODEL_RAPIDO) 7.7s, con salidas que a ojo no se distinguen. El
// cambio NO se hace de oído: lo decide Roberto viendo los renders.

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

  // Tope diario de IA (lib/cuotas.ts). 429 y NO 500: no es un fallo, es un
  // límite, y el cliente lo distingue para enseñar el mensaje tal cual.
  const cuota = await revisarCuota(supabase, user.id, "fotos");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

  // Recibe la foto de la persona (aísla la prenda que trae puesta) → mismo
  // gate de menores que analizar-prenda/s: sin permiso del tutor, no procesa.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_gemini" }, { status: 503 });
  }

  type AttrsBody = Partial<PrendaAnalisis> & { descripcion?: string };
  let body: { image?: string; attrs?: AttrsBody } & AttrsBody = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // Robusto a ambos formatos: {image, attrs:{...}} (nuevo) o los atributos al
  // nivel raíz (cliente viejo). Así un desfase de versiones no rompe el render.
  const attrs: AttrsBody = body.attrs ?? body;
  const nombre = (attrs.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "sin_nombre" }, { status: 400 });

  // Qué prenda extraer: la descripción visual + el color confirmado (si el
  // usuario lo corrigió con el swatch, manda sobre lo que diga la foto).
  const quePrenda = (attrs.descripcion ?? "").trim() || nombre;
  const conColor = attrs.color ? `${quePrenda}, en color ${attrs.color}` : quePrenda;

  let bytes: Buffer | null = null;

  // Camino principal: imagen→imagen desde la foto original (lib/extraer-prenda).
  // La foto es opcional aquí: sin ella hay otro camino (texto→imagen). Cuando
  // viene, mandan los bytes y no la etiqueta (lib/imagen-entrante.ts).
  const foto = leerImagenEntrante(body.image);
  if (!foto.ok && foto.motivo !== "falta") {
    return NextResponse.json(
      { error: "bad_image", mensaje: MOTIVO_IMAGEN[foto.motivo] },
      { status: 400 }
    );
  }
  if (foto.ok) {
    const { mediaType, b64 } = foto;
    bytes = await extraerPrendaDeFoto(
      { base64: b64, mediaType },
      { quePrenda, categoria: attrs.categoria, color: attrs.color, aspecto: "1:1" },
      { supabase, userId: user.id }
    );
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
