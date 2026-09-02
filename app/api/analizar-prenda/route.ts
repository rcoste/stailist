import { VISION_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { leerPrenda, contarPrendas } from "@/lib/vision-prenda";
import { revisarCuota } from "@/lib/cuotas";
import { leerImagenEntrante, MOTIVO_IMAGEN } from "@/lib/imagen-entrante";

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

  // Tope diario de IA (lib/cuotas.ts). 429 y NO 500: no es un fallo, es un
  // límite, y el cliente lo distingue para enseñar el mensaje tal cual.
  const cuota = await revisarCuota(supabase, user.id, "fotos");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

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
  // Los BYTES deciden qué es la foto, no la etiqueta que mandó el cliente
  // (lib/imagen-entrante.ts). También corta lo que pesa de más antes de
  // pagarle al modelo por leer basura.
  const foto = leerImagenEntrante(body.image);
  if (!foto.ok) {
    return NextResponse.json(
      { error: "bad_image", mensaje: MOTIVO_IMAGEN[foto.motivo] },
      { status: 400 }
    );
  }
  const { mediaType, b64 } = foto;

  try {
    // Las dos preguntas van EN PARALELO y por separado: mezclar "¿cuántas
    // prendas hay?" dentro del schema de lectura movía `subtipo` y `temporada`
    // (z = 3.05 sobre 425 prendas). Ver contarPrendas.
    //
    // Las dos dejan recibo, y con tarea SEPARADA (ver lib/vision-prenda): son
    // dos llamadas de precio muy distinto y juntarlas escondería justo lo que
    // se quiere ver.
    const quien = { supabase, userId: user.id };
    const [{ analisis }, varias] = await Promise.all([
      leerPrenda({ mediaType, base64: b64 }, VISION_MODEL, quien),
      contarPrendas({ mediaType, base64: b64 }, VISION_MODEL, quien),
    ]);
    return NextResponse.json({ analisis: { ...analisis, varias } });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
