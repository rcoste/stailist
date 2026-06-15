import Link from "next/link";
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
  const [{ data: catalog }, { data: items }] = await Promise.all([
    supabase
      .from("archetypes")
      .select("id, name, category, attrs, image_path")
      .in("segment", ["unisex", profile.gender ?? "hombre"])
      .order("sort_order"),
    supabase
      .from("items")
      .select("archetype_id")
      .eq("user_id", profile.id)
      .is("deleted_at", null),
  ]);

  const have = new Set(
    (items ?? []).map((i) => i.archetype_id).filter(Boolean)
  );
  const available = ((catalog ?? []) as CatalogItem[]).filter(
    (a) => !have.has(a.id)
  );

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-2">
          <Link href="/closet" className="text-sm text-muted hover:text-ink">
            ← Clóset
          </Link>
          <h1 className="text-h1 font-semibold text-ink">Biblioteca</h1>
          <p className="text-sm text-muted">
            Agrega más básicos a tu clóset. Marca los que también tengas.
          </p>
        </div>

        {available.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
            <p className="editorial text-lg text-ink">
              ya tienes todos los básicos
            </p>
            <p className="text-sm text-muted">
              Si te falta algo específico, súbelo como foto desde tu clóset.
            </p>
          </div>
        ) : (
          <BibliotecaPicker catalog={available} />
        )}
      </section>
    </AppShell>
  );
}
