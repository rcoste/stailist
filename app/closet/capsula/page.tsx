import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CapsuleList } from "@/components/capsule-list";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { closetSignature } from "@/lib/capsule";
import { loadClosetLite, loadClosetImageMap } from "@/lib/capsule-data";
import { recalcularMatch } from "./actions";

// recalcularMatch (1 llamada a Opus con el clóset completo) se dispara desde aquí.
export const maxDuration = 60;

export default async function CapsulaPage() {
  const profile = await requireOnboarded();
  const target = profile.capsule_target;
  // Sin cápsula todavía → al cuestionario.
  if (!target) redirect("/closet/capsula/editar");

  const match = profile.capsule_match;
  const supabase = await createClient();
  const [closet, images] = await Promise.all([
    loadClosetLite(supabase, profile.id),
    loadClosetImageMap(supabase, profile.id),
  ]);
  const stale = !match || match.signature !== closetSignature(closet);

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/closet" className="text-sm font-medium text-muted hover:text-ink">
              ← Clóset
            </Link>
            <h1 className="text-h1 font-semibold text-ink">Tu clóset cápsula</h1>
          </div>
          <Link
            href="/closet/capsula/editar"
            className="mt-6 shrink-0 text-sm font-medium text-accent hover:underline"
          >
            Editar
          </Link>
        </div>

        {stale ? (
          <form action={recalcularMatch}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-accent-soft p-3 text-left text-sm font-medium text-accent transition-colors hover:border-accent"
            >
              <Icon name="repetir" size={16} />
              {match
                ? "Tu clóset cambió — recalcular qué tienes"
                : "Calcular qué ya tienes y qué te falta"}
            </button>
          </form>
        ) : null}

        <CapsuleList
          target={target}
          match={match}
          overrides={profile.capsule_overrides}
          images={images}
        />
      </section>
    </AppShell>
  );
}
