import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureCatalogRender } from "@/lib/catalog-render";

// "Ver cómo se ve": genera con IA la imagen de una prenda SUGERIDA (ideal) que aún
// no tiene imagen, y la suma a la biblioteca general compartida (bucket público
// `catalog`). El siguiente usuario que necesite ese mismo combo la verá al instante.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: {
    tipo?: string;
    colorFamilia?: string;
    nombre?: string;
    categoria?: string;
    formalidad?: string;
    temporada?: string;
    visual?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { tipo, colorFamilia, nombre, categoria, formalidad, temporada, visual } = body ?? {};
  if (!tipo || !colorFamilia || !nombre) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  const r = await ensureCatalogRender(supabase, {
    tipo,
    colorFamilia,
    nombre,
    categoria: categoria ?? "",
    gender,
    formalidad: formalidad ?? null,
    temporada: temporada ?? null,
    visual: visual ?? null,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error ?? "render_fallo" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: r.url });
}
