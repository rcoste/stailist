import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import {
  carteraDepth,
  subSeasonLabel,
  seasonMetal,
  normSeason,
  METAL_HEX,
} from "@/lib/colorimetria";
import { subPalette } from "@/lib/palette-data";
import { CarteraClient } from "@/components/cartera/cartera-client";

// Cartera de Colorimetría (Fase 1): la mega-paleta del usuario según su
// sub-estación (estación × profundidad). La profundidad se deriva del quiz que
// ya contestó (palette_quiz); no requiere columna nueva. Sin colorimetría aún →
// empty state que manda a hacerla.
export default async function CarteraPage() {
  const profile = await requireOnboarded();
  const season = normSeason(profile.palette_season);

  if (!season) {
    return (
      <AppShell>
        <section className="flex flex-col gap-5 pt-4">
          <div>
            <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
              tu cartera de colores
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              tus colores viven aquí, listos para la tienda.
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line text-muted">
              <Icon name="destello" size={26} />
            </span>
            <p className="editorial text-lg text-ink">primero, tus colores</p>
            <p className="text-sm text-muted">
              haz tu test de colorimetría (2 min, sin selfie) y te armo tu paleta
              completa.
            </p>
            <Link
              href="/perfil"
              className="flex min-h-12 items-center rounded-sm bg-accent px-6 text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
            >
              hacer mi colorimetría
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  const depth = carteraDepth(profile.palette_quiz, season, profile.palette_flow);
  const subLabel = subSeasonLabel(season, depth);
  const metal = seasonMetal(season, profile.palette_flow);
  const palette = subPalette(season, depth);

  return (
    <AppShell>
      <CarteraClient
        subLabel={subLabel}
        reveal={palette.reveal}
        metal={metal}
        metalHex={METAL_HEX[metal]}
        familias={palette.familias}
        evita={palette.evita}
      />
    </AppShell>
  );
}
