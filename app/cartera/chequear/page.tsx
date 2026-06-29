import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { carteraDepth, normSeason } from "@/lib/colorimetria";
import { carteraGoSwatches, carteraPalette } from "@/lib/palette-data";
import { ChequearClient } from "@/components/cartera/chequear-client";

// Cartera · Fase 2: chequea un color. Sube la foto de una prenda → el cliente
// extrae el color dominante y lo compara (deltaE) con la paleta del usuario.
// Todo client-side; aquí solo resolvemos la paleta. Sin colorimetría → a /cartera.
export default async function ChequearPage() {
  const profile = await requireOnboarded();
  const season = normSeason(profile.palette_season);
  if (!season) redirect("/cartera");

  const flow = profile.palette_flow;
  const depth = carteraDepth(profile.palette_quiz, season, flow);
  const va = carteraGoSwatches(season, depth, flow);
  const evita = carteraPalette(season, depth, flow).evita;

  return (
    <AppShell>
      <ChequearClient va={va} evita={evita} />
    </AppShell>
  );
}
