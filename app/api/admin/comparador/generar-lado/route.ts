import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generarLadoYGuardar } from "@/lib/comparador/generar-lado";

export const maxDuration = 60;

// UN lado: una variante del motor resolviendo un brief. La pantalla los pide
// de a poco desde el navegador, igual que las lecturas del comparador de
// visión, y por las mismas dos razones: Vercel corta a los 60s (un lado cabe,
// una corrida entera no), y cerrar la pestaña deja de gastar.
//
// El trabajo vive en lib/comparador/generar-lado.ts, compartido con el script
// que deja corridas generadas sin nadie mirando. Esta ruta pone HTTP y sesión.
export async function POST(request: NextRequest) {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  let body: { corridaId?: string; parId?: string; variante?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { corridaId, parId, variante } = body;
  if (!corridaId || !parId || !variante) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const r = await generarLadoYGuardar({
    supabase,
    corridaId,
    parId,
    variante,
    actorId: perfil.id,
  });

  if ("error" in r) {
    return NextResponse.json(
      { error: r.error, ...(r.detalle ? { detalle: r.detalle } : {}) },
      { status: r.status }
    );
  }
  return NextResponse.json(r);
}
