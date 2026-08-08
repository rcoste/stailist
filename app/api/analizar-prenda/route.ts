import { VISION_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { leerPrenda, contarPrendas } from "@/lib/vision-prenda";

export const maxDuration = 60;

// Re-exportados para no romper a quien los importaba desde aquí. El prompt, el
// schema y la llamada viven ahora en lib/vision-prenda.ts, compartidos con el
// comparador de modelos: la única forma de que una comparación signifique algo
// es que mida el mismo código que corre en producción.
export {
  INSEGURO_CAMPOS,
  type InseguroCampo,
  type PrendaAnalisis,
} from "@/lib/vision-prenda";

// Vision mira la foto de UNA prenda y devuelve sus atributos. El usuario
// confirma/ajusta después (la detección nunca bloquea — falla #1 del alfa era
// inventar; aquí la persona corrige en un tap). Gemini genera, Claude analiza.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Menor (13-17) sin permiso parental confirmado: las fotos quedan bloqueadas.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  let body: { image?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  try {
    // Las dos preguntas van EN PARALELO y por separado: mezclar "¿cuántas
    // prendas hay?" dentro del schema de lectura movía `subtipo` y `temporada`
    // (z = 3.05 sobre 425 prendas). Ver contarPrendas.
    const [{ analisis }, varias] = await Promise.all([
      leerPrenda({ mediaType, base64: b64 }, VISION_MODEL),
      contarPrendas({ mediaType, base64: b64 }, VISION_MODEL),
    ]);
    return NextResponse.json({ analisis: { ...analisis, varias } });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
