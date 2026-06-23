import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderItemImage } from "@/lib/render-item";

// Genera el render limpio (tipo catálogo) de UNA prenda del clóset SIN imagen —
// las que el usuario agregó por descripción (nombre + atributos), sin foto, que
// salían como swatch en los outfits. Lo dispara el auto-sanado del clóset. La
// lógica vive en lib/render-item (compartida con "ya lo tengo"); aquí solo
// auth + devolver la URL firmada del render para que el cliente lo muestre.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let itemId: string | undefined;
  try {
    itemId = (await request.json())?.itemId;
  } catch {
    // sin body
  }
  if (!itemId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const result = await renderItemImage(supabase, user.id, itemId);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 502;
    return NextResponse.json({ error: result.error ?? "render_fallo" }, { status });
  }
  if (result.skipped || !result.path) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: signed } = await supabase.storage
    .from("prendas")
    .createSignedUrl(result.path, 3600);
  return NextResponse.json({ ok: true, path: result.path, url: signed?.signedUrl ?? null });
}
