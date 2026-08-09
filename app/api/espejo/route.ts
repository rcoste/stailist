import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { MODELO_ESPEJO } from "@/lib/models";
import { resolveWeather } from "@/lib/weather";
import { vetoLabels, type StyleVetoes } from "@/lib/vetoes";
import {
  contextoEspejo,
  mirarEspejo,
  ESPEJO_VERSION,
  type LecturaEspejo,
} from "@/lib/espejo";

// "¿ME VEO BIEN?" — recibe la foto de cómo se vistió y contesta.
//
// El porqué del módulo, y por qué NO es una evaluación, viven en lib/espejo.
//
// GUARDA Y CONTESTA EN LA MISMA LLAMADA. Podría devolver el consejo y dejar el
// guardado para un segundo paso, pero entonces "ya quedó en tu diario" sería
// mentira mientras lee la respuesta — y el diario es media promesa del módulo.
// Si el guardado falla, el consejo se entrega igual: la respuesta es el
// trabajo, el diario es el registro.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Mismo gate de menores que el resto de lo que mira fotos.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  let body: {
    image?: string;
    photoPath?: string;
    lat?: number;
    lon?: number;
    weather?: { temp_c?: number; condition?: string };
    paraguas?: boolean;
    momento?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  // La ruta de la foto viene del cliente (la subió con su RLS). Defensa extra:
  // tiene que estar dentro de su propia carpeta.
  const photoPath =
    body.photoPath && body.photoPath.startsWith(`${user.id}/`) ? body.photoPath : null;

  const [{ data: profile }, weather] = await Promise.all([
    supabase
      .from("profiles")
      .select("gender, palette_season, palette_flow, style_vetoes")
      .eq("id", user.id)
      .single(),
    resolveWeather(body),
  ]);

  const contexto = contextoEspejo({
    gender: (profile?.gender as "hombre" | "mujer" | null) ?? null,
    season: (profile?.palette_season as string | null) ?? null,
    flow: (profile?.palette_flow as string | null) ?? null,
    weather,
    // Solo cuenta si de verdad llueve — mismo criterio que el look de hoy: un
    // "sí llevo paraguas" con sol no debe cambiar nada.
    paraguas: body.paraguas === true && !!weather,
    vetos: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? null),
    momento: body.momento === "noche" ? "noche" : body.momento === "dia" ? "dia" : null,
  });

  let lectura: LecturaEspejo;
  try {
    lectura = await mirarEspejo({ mediaType, base64: b64 }, contexto, MODELO_ESPEJO);
  } catch {
    return NextResponse.json({ error: "no_pude_mirar" }, { status: 502 });
  }

  // FALLA HACIA ADELANTE: si el guardado truena, el consejo sale igual.
  let outfitId: string | null = null;
  try {
    const { data } = await supabase
      .from("outfits")
      .insert({
        user_id: user.id,
        // Sin empatar contra el clóset todavía — a propósito (ver lib/espejo).
        item_ids: [],
        source: "espejo",
        occasion: "espejo",
        // El TÍTULO, no el resumen: el resumen es un párrafo y el diario lo
        // pinta en la serif grande.
        title: lectura.titulo,
        explanation: lectura.colorimetria,
        tip: lectura.ajuste,
        prompt_version: ESPEJO_VERSION,
        weather,
        photo_path: photoPath,
        // Es lo que SE PUSO, no una propuesta: nace marcado como usado, que es
        // justo la señal de oro que el resto del producto persigue a duras penas.
        favorited_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    outfitId = (data?.id as string) ?? null;

    await supabase.from("events").insert({
      user_id: user.id,
      type: "espejo_subido",
      data: { outfit_id: outfitId, con_clima: !!weather },
    });
  } catch {
    // el consejo ya está; el registro se pierde
  }

  return NextResponse.json({ ...lectura, outfitId });
}
