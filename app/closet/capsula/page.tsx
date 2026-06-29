import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClosetNav } from "@/components/closet-nav";
import { CapsuleList } from "@/components/capsule-list";
import { PorQueEsTuya } from "@/components/por-que-es-tuya";
import { Icon, type IconName } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { capsuleView, closetSignature } from "@/lib/capsule";
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
  const view = match ? capsuleView(target, match, profile.capsule_overrides) : null;
  // Estado completo: match al día y 17/17 cubiertas → pantalla de mantenimiento.
  const done = !!view && !stale && view.coveragePct >= 100;

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-1">
        <ClosetNav />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
            tu cápsula
          </h1>
          <Link
            href="/closet/capsula/editar"
            className="shrink-0 text-sm font-semibold text-accent hover:underline"
          >
            editar
          </Link>
        </div>

        {/* Por qué esta cápsula es tuya: sello en serif + pilares cortos (sin caja). */}
        {target.firma || target.pilares?.length || target.resumen ? (
          <PorQueEsTuya
            firma={target.firma}
            subline={target.subline}
            pilares={target.pilares}
            resumen={target.resumen}
          />
        ) : null}

        {done && view ? (
          <DoneState have={view.haveCount} total={view.totalCount} />
        ) : (
          <>
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
          </>
        )}
      </section>
    </AppShell>
  );
}

// Estado de cápsula completa (Screen 6): encabezado compacto (anillo verde con
// palomita) + "¿Y ahora qué?" — deja de exigir y pasa a mantener.
function DoneState({ have, total }: { have: number; total: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3.5">
        <GreenRing size={54} stroke={5} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex w-fit items-center gap-1.5 rounded-sm bg-success/12 px-2 py-[3px] text-[11px] font-semibold text-success">
            <Icon name="check" size={13} strokeWidth={2.2} />
            <span className="tabular">
              Completa · {have} de {total}
            </span>
          </span>
          <h2 className="display text-[18px] font-semibold leading-tight text-ink">
            Tu guardarropa esencial está completo
          </h2>
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-muted">
        Tienes las {total} piezas que tu vida pide. Ahora se trata de mantenerlo afilado.
      </p>

      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          ¿Y ahora qué?
        </span>
        <NextCard
          icon="hoja"
          href="/closet/capsula/editar"
          title="Revisa por temporada"
          sub="Cambia el clima — algunas piezas pueden rotar"
        />
        <NextCard
          icon="corazon"
          href="/perfil"
          title="Afina tus gustos"
          sub="Ajusta la cápsula si tu estilo cambió"
        />
        <NextCard
          icon="gancho"
          href="/closet"
          title="Ve todo tu guardarropa"
          sub="Toda tu ropa, no solo la cápsula"
        />
      </div>
    </div>
  );
}

function NextCard({
  icon,
  href,
  title,
  sub,
}: {
  icon: IconName;
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-md border border-line bg-surface p-3.5 transition-colors hover:border-accent"
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-muted">{sub}</span>
      </span>
      <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
    </Link>
  );
}

function GreenRing({ size, stroke }: { size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--c-success)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-success">
        <Icon name="check" size={20} strokeWidth={2.4} />
      </span>
    </span>
  );
}
