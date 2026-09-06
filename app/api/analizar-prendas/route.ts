import { VISION_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import { createClient } from "@/lib/supabase/server";
import { leerPrendas } from "@/lib/vision-prendas";
import { revisarCuota } from "@/lib/cuotas";
import { leerImagenEntrante, MOTIVO_IMAGEN } from "@/lib/imagen-entrante";

// El prompt, el schema y el tipo viven en lib/vision-prendas.ts, compartidos
// con el comparador de modelos: una comparación sólo significa algo si mide el
// MISMO código que corre en producción, no una copia que puede desincronizarse.
export type { PrendaDetectada } from "@/lib/vision-prendas";

export const maxDuration = 60;

// Versión multi-prenda de /api/analizar-prenda: mira UNA foto — persona vestida
// O prendas extendidas (cama, colgadas, apiladas: el caso "vacía tu clóset") — y
// devuelve el ARRAY de prendas. El usuario confirma cada una en lote antes de que
// se genere nada (el humano es el filtro contra la alucinación). Tope 8 prendas
// por foto (una cama trae más que un outfit). Spec: docs/designs/import-carrete-multiprenda.md
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
    const { prendas } = await leerPrendas(
      { mediaType, base64: b64 },
      VISION_MODEL,
      // Con recibo: es la vía principal de alta del clóset (303 de las 953
      // prendas de la base entraron por aquí), así que su costo y su tiempo son
      // los que hay que poder consultar.
      { supabase, userId: user.id }
    );
    // Tope duro: nunca más de 8 aunque el modelo se exceda.
    return NextResponse.json({ prendas: prendas.slice(0, 8) });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
