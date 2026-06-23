import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateArchetypeImage } from "@/lib/archetype-image";

// Genera el render limpio (tipo catálogo) de UNA prenda del clóset que NO tiene
// imagen — las que el usuario agregó por descripción (nombre + atributos), sin
// foto, que hoy salen como swatch de color en los outfits. Render DESDE atributos
// (texto→imagen con Gemini, reusa generateArchetypeImage), sube a Storage y
// CACHEA el resultado en el item (render_path + render_status='done'). Idempotente:
// si la prenda ya tiene de dónde sacar imagen o ya se está renderizando, no hace
// nada. Un render por prenda, una sola vez.
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

  const { data: item } = await supabase
    .from("items")
    .select("id, archetype_id, photo_path, render_status, render_path, attrs")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const attrs = (item.attrs ?? {}) as {
    nombre?: string;
    color?: string;
    categoria?: string;
    tipo?: string;
    image_path?: string;
  };

  // Idempotencia: si ya tiene de dónde sacar imagen (arquetipo, render previo,
  // foto, o imagen prestada) o ya hay un render en curso → no regeneres.
  const yaTieneImagen =
    !!item.archetype_id ||
    (item.render_status === "done" && !!item.render_path) ||
    !!item.photo_path ||
    !!attrs.image_path;
  if (yaTieneImagen || item.render_status === "pending") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const nombre = (attrs.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "sin_atributos" }, { status: 422 });
  }
  const categoria = attrs.categoria ?? attrs.tipo ?? "";

  // Marca "en curso" antes del trabajo pesado (guard anti doble-generación si dos
  // vistas la disparan a la vez).
  await supabase
    .from("items")
    .update({ render_status: "pending" })
    .eq("id", itemId)
    .eq("user_id", user.id);

  // Descripción para el render: el nombre suele traer el color; lo reforzamos si no.
  const conColor =
    attrs.color && !nombre.toLowerCase().includes(attrs.color.toLowerCase())
      ? `${nombre} en color ${attrs.color}`
      : nombre;
  const type = categoria === "calzado" ? "shoes" : "flat";

  const bytes = await generateArchetypeImage(conColor, type);
  if (!bytes) {
    await supabase
      .from("items")
      .update({ render_status: "failed" })
      .eq("id", itemId)
      .eq("user_id", user.id);
    return NextResponse.json({ error: "render_fallo" }, { status: 502 });
  }

  // Mismo bucket privado y patrón de path que /api/render-prenda y /api/tryon.
  const path = `${user.id}/render-${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (up.error) {
    await supabase
      .from("items")
      .update({ render_status: "failed" })
      .eq("id", itemId)
      .eq("user_id", user.id);
    return NextResponse.json({ error: "upload_fallo" }, { status: 502 });
  }

  await supabase
    .from("items")
    .update({ render_path: path, render_status: "done" })
    .eq("id", itemId)
    .eq("user_id", user.id);

  const { data: signed } = await supabase.storage
    .from("prendas")
    .createSignedUrl(path, 3600);

  return NextResponse.json({ ok: true, path, url: signed?.signedUrl ?? null });
}
