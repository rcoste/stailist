import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarTryon } from "@/lib/tryon";

export const maxDuration = 60;

// "Verme con este look": viste el avatar de la usuaria con las prendas reales
// del outfit usando Gemini 3 Pro Image. Cachea el resultado por outfit (no
// regenera). Bajo demanda — cada try-on cuesta y tarda. Gemini genera, Claude
// razona.
//
// El prompt, las referencias de identidad y el pipeline de imágenes viven en
// lib/tryon.ts, COMPARTIDOS con el comparador de motores (donde los looks no
// tienen fila en `outfits` a propósito). Esta ruta solo pone de dónde salen
// las prendas y dónde se apunta el resultado.
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

  // Outfit (y cache si ya se generó antes)
  const { data: outfit } = await supabase
    .from("outfits")
    .select("id, item_ids, tryon_path, tip")
    .eq("id", outfitId)
    .eq("user_id", user.id)
    .single();
  if (!outfit) return NextResponse.json({ error: "no_outfit" }, { status: 404 });

  const r = await generarTryon({
    supabase,
    userId: user.id,
    itemIds: (outfit.item_ids as string[]) ?? [],
    tip: (outfit.tip as string | null) ?? null,
    cachePath: `${user.id}/tryons/${outfitId}.jpg`,
    yaGenerado: (outfit.tryon_path as string | null) ?? null,
    origin: request.nextUrl.origin,
  });

  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.cached) {
    await supabase
      .from("outfits")
      .update({ tryon_path: `${user.id}/tryons/${outfitId}.jpg` })
      .eq("id", outfitId);
  }
  return NextResponse.json({ image: r.image, cached: r.cached });
}
