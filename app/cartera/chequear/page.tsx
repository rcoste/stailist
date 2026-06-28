import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { computeDepth } from "@/lib/colorimetria";
import { goSwatches, subPalette } from "@/lib/palette-data";
import { ChequearClient } from "@/components/cartera/chequear-client";

// Cartera · Fase 2: chequea un color. Sube la foto de una prenda → el cliente
// extrae el color dominante y lo compara (deltaE) con la paleta del usuario.
// Todo client-side; aquí solo resolvemos la paleta. Sin colorimetría → a /cartera.
export default async function ChequearPage() {
  const profile = await requireOnboarded();
  const season = profile.palette_season;
  if (!season) redirect("/cartera");

  const depth = computeDepth(profile.palette_quiz);
  const va = goSwatches(season, depth);
  const evita = subPalette(season, depth).evita;

  return (
    <AppShell>
      <ChequearClient va={va} evita={evita} />
    </AppShell>
  );
}
