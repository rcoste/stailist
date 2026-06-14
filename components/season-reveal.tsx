import Link from "next/link";
import { SEASONS, type Season } from "@/lib/colorimetria";

// Reveal de la estación de colorimetría: lo comparten el quiz y la selfie.
// `nota` opcional aparece bajo la paleta (p.ej. la confianza de la foto).
export function SeasonReveal({
  season,
  nota,
}: {
  season: Season;
  nota?: string;
}) {
  const s = SEASONS[season];
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 font-semibold text-ink">{s.reveal}</h2>
        <p className="text-sm text-muted">
          Tu paleta es tipo {s.label} — así la llamamos por acá. El stylist la
          usa para que cada look te favorezca.
        </p>
      </div>
      <div className="flex gap-2">
        {s.colores.map((c) => (
          <div key={c.nombre} className="flex flex-1 flex-col gap-1">
            <span
              className="h-12 rounded-lg border border-line"
              style={{ backgroundColor: c.hex }}
              title={c.nombre}
            />
            <span className="text-center text-xs text-muted">{c.nombre}</span>
          </div>
        ))}
      </div>
      {nota ? <p className="text-center text-xs text-muted">{nota}</p> : null}
      <Link
        href="/onboarding/closet"
        className="flex min-h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        Vamos con tu clóset
      </Link>
    </div>
  );
}
