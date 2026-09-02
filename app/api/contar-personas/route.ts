import { VISION_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { contarPersonas } from "@/lib/vision-personas";
import { revisarCuota } from "@/lib/cuotas";
import { leerImagenEntrante, MOTIVO_IMAGEN } from "@/lib/imagen-entrante";

// Cuántas personas salen en una foto — para avisar ANTES de leerla que ahí sale
// alguien más y que conviene recortar. El porqué (y por qué es una llamada
// aparte, y por qué no es reconocimiento facial) vive en lib/vision-personas.
export const maxDuration = 30;

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

  // Mismo gate de menores que el resto de las rutas que miran fotos.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

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

  // contarPersonas ya falla hacia 0 por dentro: esta ruta nunca es un 502 que
  // el cliente tenga que manejar. El aviso es una ayuda, la carga es el trabajo.
  const personas = await contarPersonas({ mediaType, base64: b64 }, VISION_MODEL, {
    supabase,
    userId: user.id,
  });
  return NextResponse.json({ personas });
}
