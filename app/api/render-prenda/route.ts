import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateArchetypeImage } from "@/lib/archetype-image";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

export const maxDuration = 60;

// Render limpio de UNA prenda con Gemini, desde los atributos YA confirmados por
// el usuario (no de la foto cruda). Un render por request — respeta el límite de
// 60s de Vercel. La imagen sube al bucket privado 'prendas' (igual que las fotos
// del usuario), y la ruta se guarda en items.render_path.
// Spec: docs/designs/import-carrete-multiprenda.md
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_gemini" }, { status: 503 });
  }

  let attrs: Partial<PrendaAnalisis> = {};
  try {
    attrs = (await request.json()) as Partial<PrendaAnalisis>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const nombre = (attrs.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "sin_nombre" }, { status: 400 });

  // El nombre ya es descriptivo ("Camisa de lino beige"); reforzamos con el
  // color para que el render respete el tono confirmado.
  const desc = attrs.color ? `${nombre}, color ${attrs.color}` : nombre;
  const type = attrs.categoria === "calzado" ? "shoes" : "flat";

  const bytes = await generateArchetypeImage(desc, type);
  if (!bytes) return NextResponse.json({ error: "render_fallo" }, { status: 502 });

  const path = `${user.id}/render-${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (up.error) {
    return NextResponse.json({ error: "upload_fallo" }, { status: 502 });
  }

  // URL firmada para que el cliente muestre el render en la confirmación visual
  // (el bucket es privado). La ruta `path` es la que se guarda en la BD.
  const { data: signed } = await supabase.storage
    .from("prendas")
    .createSignedUrl(path, 3600);

  return NextResponse.json({ path, url: signed?.signedUrl ?? null });
}
