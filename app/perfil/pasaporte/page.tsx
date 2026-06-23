import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildPasaporte } from "@/lib/pasaporte";
import { PasaporteShare } from "@/components/pasaporte-share";

// Inlinea una imagen del bucket privado como data URL (para que html-to-image la
// capture limpia: una URL firmada cross-origin ensuciaría el canvas).
async function inlineSigned(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("prendas").createSignedUrl(path, 600);
  if (!data?.signedUrl) return null;
  try {
    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function PerfilPasaportePage() {
  const profile = await requireOnboarded();
  const data = buildPasaporte(profile);
  const supabase = await createClient();

  // Héroe = avatar (inline data URL).
  if (profile.avatar_path) {
    data.heroImage = await inlineSigned(supabase, profile.avatar_path);
  }

  // Fórmula = el look más reciente con miniaturas de sus prendas. Arquetipos =
  // imagen pública (mismo origen, directo); fotos propias = inline.
  const { data: lastOutfit } = await supabase
    .from("outfits")
    .select("item_ids")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ids = (lastOutfit?.item_ids as string[] | undefined) ?? [];
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("items")
      .select("id, render_status, render_path, photo_path, attrs, archetypes(name, image_path)")
      .in("id", ids);
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
    const formula: { nombre: string; image: string | null }[] = [];
    for (const id of ids.slice(0, 4)) {
      const r = byId.get(id);
      if (!r) continue;
      const arch = r.archetypes as { name?: string; image_path?: string | null } | null;
      const attrs = r.attrs as { nombre?: string };
      let image: string | null = arch?.image_path ?? null; // arquetipo: directo
      if (!image && r.render_status === "done" && r.render_path) {
        image = await inlineSigned(supabase, r.render_path as string);
      } else if (!image && r.photo_path) {
        image = await inlineSigned(supabase, r.photo_path as string);
      }
      formula.push({ nombre: arch?.name ?? attrs.nombre ?? "Prenda", image });
    }
    data.formula = formula;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href="/perfil" className="text-sm font-medium text-muted hover:text-ink">
        ← Perfil
      </Link>
      <div className="mb-5 mt-4 flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-ink">Tu pasaporte de estilo</h1>
        <p className="text-sm text-muted">Tu identidad en una tarjeta. Compártela.</p>
      </div>
      <PasaporteShare data={data} />
    </div>
  );
}
