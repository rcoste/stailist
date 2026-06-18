import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth";
import { looksForGender } from "@/lib/looks";
import { SwipeDeck } from "@/app/onboarding/gustos/swipe-deck";
import { updateTastes } from "@/app/onboarding/gustos/actions";

// Rehacer gustos desde el Perfil: reusa el mismo deck de swipes del onboarding,
// pero guarda con updateTastes (no toca el onboarding_step) y al revelar el nuevo
// arquetipo regresa al Perfil. generateArchetype (IA) corre en updateTastes.
export const maxDuration = 60;

export default async function PerfilEstiloPage() {
  const profile = await requireOnboarded();
  if (!profile.gender) redirect("/onboarding/genero");
  const looks = looksForGender(profile.gender);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href="/perfil" className="text-sm font-medium text-muted hover:text-ink">
        ← Perfil
      </Link>
      <div className="mb-4 mt-2 flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-ink">Rehaz tus gustos</h1>
        <p className="text-sm text-muted">
          Vuelve a swipear y actualizo tu estilo.
        </p>
      </div>
      <SwipeDeck
        looks={looks}
        save={updateTastes}
        doneHref="/perfil"
        doneLabel="Listo, volver a mi perfil"
      />
    </div>
  );
}
