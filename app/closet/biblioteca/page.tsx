import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BibliotecaPicker } from "./biblioteca-picker";
import type { CatalogItem } from "@/app/onboarding/closet/checklist";

// Biblioteca completa: todos los básicos del género del usuario (la que NO
// entró al onboarding incluida), menos lo que ya tiene. Aquí amplía su clóset.
export default async function BibliotecaPage() {
  const profile = await requireOnboarded();

  const supabase = await createClient();
  const [{ data: catalog }, { data: items }, { data: wishRows }] = await Promise.all([
    supabase
      .from("archetypes")
      .select("id, name, category, attrs, image_path")
      .in("segment", ["unisex", profile.gender ?? "hombre"])
      // Las retiradas del catálogo (borrado suave, migración 0137) no se ofrecen.
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("items")
      .select("archetype_id")
      .eq("user_id", profile.id)
      .is("deleted_at", null),
    supabase
      .from("wishlist_items")
      .select("capsule_key")
      .eq("user_id", profile.id)
      .eq("source", "biblioteca"),
  ]);

  const have = new Set(
    (items ?? []).map((i) => i.archetype_id).filter(Boolean)
  );
  const available = ((catalog ?? []) as CatalogItem[]).filter(
    (a) => !have.has(a.id)
  );
  // Arquetipos que ya están en la wishlist (para el estado del bookmark).
  const savedWishIds = (wishRows ?? [])
    .map((r) => r.capsule_key as string | null)
    .filter((k): k is string => !!k && k.startsWith("biblio-"))
    .map((k) => Number(k.slice("biblio-".length)))
    .filter((n) => Number.isFinite(n));

  // Sin tab bar: esta pantalla tiene una barra de acción fija abajo (Agregar) y
  // el handoff prohíbe que CTA y tab bar coexistan.
  return (
    // La vuelta sube al header, a la altura del wordmark (ver AppShell): aquí
    // no hay menú de pantalla, así que la esquina derecha se queda con el
    // perfil de siempre.
    <AppShell hideTabBar desktop="wide" back={{ href: "/closet", label: "clóset" }}>
      <section className="flex flex-col gap-4 pt-1">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
            la biblioteca
          </h1>
          <p className="text-sm text-muted">
            marca los básicos que ya tienes, o guárdalos en tu wishlist.
          </p>
        </div>

        {available.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-14 text-center">
            <p className="display text-lg text-ink">ya tienes todos los básicos</p>
            <p className="text-sm text-muted">
              Si te falta algo específico, súbelo como foto desde tu clóset.
            </p>
          </div>
        ) : (
          <BibliotecaPicker catalog={available} savedWishIds={savedWishIds} />
        )}
      </section>
    </AppShell>
  );
}
