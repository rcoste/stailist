import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pasoEval } from "@/lib/evales/paso";

export const maxDuration = 60;

// UN paso del eval: generar un brief o calificarlo con los tres jueces. La
// pantalla los pide de a poco desde el navegador — Vercel corta a los 60s (un
// paso cabe, la corrida entera no) y cerrar la pestaña deja de gastar.
export async function POST(request: NextRequest) {
  const perfil = await requireAdmin();
  const supabase = await createClient();

  let body: { corridaId?: string; briefId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { corridaId, briefId } = body;
  if (!corridaId || !briefId) {
    return NextResponse.json({ error: "faltan_datos" }, { status: 400 });
  }

  const r = await pasoEval({ supabase, corridaId, briefId, actorId: perfil.id });

  if ("error" in r) {
    return NextResponse.json(
      { error: r.error, ...(r.detalle ? { detalle: r.detalle } : {}) },
      { status: r.status }
    );
  }
  return NextResponse.json(r);
}
