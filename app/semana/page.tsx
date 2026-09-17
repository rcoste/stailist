import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MIN_PRENDAS_SEMANA } from "@/lib/semana";
import { SemanaMontaje } from "./semana-montaje";

// "Arma mi semana" (lib/semana.ts). El servidor sólo cuenta las prendas: los
// días dependen de la fecha LOCAL del teléfono, que el servidor (en UTC) no
// conoce, así que el cliente los calcula y pide su estado.
export const dynamic = "force-dynamic";

export default async function SemanaPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  return (
    <AppShell back={{ href: "/hoy", label: "inicio" }}>
      <SemanaMontaje
        prendas={count ?? 0}
        minimo={MIN_PRENDAS_SEMANA}
        gender={profile.gender ?? "hombre"}
        codigoTrabajo={profile.work_dress_code ?? null}
      />
    </AppShell>
  );
}
