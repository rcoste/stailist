import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClosetNav } from "@/components/closet-nav";
import { CapsuleList } from "@/components/capsule-list";
import { Hint } from "@/components/hint";
import { CapsuleLooks } from "@/components/capsule-looks";
import { CapsuleTabs } from "@/components/capsule-tabs";
import { EsencialesGate } from "@/components/esenciales-intro";
import { PorQueEsTuya } from "@/components/por-que-es-tuya";
import type { Occasion, TripOutfit } from "@/lib/trip";
import { Icon, type IconName } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleEscalated,
  capsuleLookKey,
  capsuleView,
  occasionsFromLifestyle,
} from "@/lib/capsule";
import { matchSignature } from "@/lib/engine/capsule-match";
import {
  loadClosetLite,
  loadClosetImageMap,
  loadClosetNameToId,
} from "@/lib/capsule-data";
import { catalogStorageKey, faltaKey } from "@/lib/capsule-images";
import { catalogPublicUrl } from "@/lib/catalog-render";
import { regenerateCapsuleTarget } from "./actions";
import { MatchRecalc } from "@/components/match-recalc";
import { styleSignature } from "@/lib/estilo-referencia";

// recalcularMatch (1 llamada a Opus con el clóset completo) se dispara desde aquí.
export const maxDuration = 60;

export default async function CapsulaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireOnboarded();
  const target = profile.capsule_target;
  // Sin cápsula todavía → al cuestionario.
  if (!target) redirect("/closet/capsula/editar");

  const { tab } = await searchParams;
  const initialTab = tab === "looks" ? "looks" : "capsula";

  const match = profile.capsule_match;
  const supabase = await createClient();
  const [closet, images] = await Promise.all([
    loadClosetLite(supabase, profile.id),
    loadClosetImageMap(supabase, profile.id),
  ]);
  // Biblioteca compartida: para los combos ideales (tipo+color+género) que ya tienen
  // un render generado, los mostramos al instante. Una sola query por todos los items.
  const gender = profile.gender;
  const skByItem = target.items.map((it) => ({
    fk: faltaKey(it),
    sk: catalogStorageKey(it.tipo, it.colorFamilia, gender),
  }));
  const { data: crows } = await supabase
    .from("catalog_renders")
    .select("key, path")
    .in(
      "key",
      skByItem.map((s) => s.sk)
    );
  const pathBySk = new Map((crows ?? []).map((r) => [r.key as string, r.path as string]));
  const catalogImages: Record<string, string> = {};
  for (const { fk, sk } of skByItem) {
    const path = pathBySk.get(sk);
    if (path) catalogImages[fk] = catalogPublicUrl(supabase, path);
  }

  // Prendas de la cápsula ya guardadas en la wishlist (para el estado del botón).
  const { data: wishRows } = await supabase
    .from("wishlist_items")
    .select("capsule_key")
    .eq("user_id", profile.id)
    .eq("source", "capsule");
  const savedWishKeys = (wishRows ?? [])
    .map((r) => r.capsule_key as string | null)
    .filter((k): k is string => !!k);

  const sig = matchSignature(closet);
  const stale = !match || match.signature !== sig;
  // ¿La cápsula se generó con un estilo de referencia distinto al actual? → outdated.
  const styleStale =
    styleSignature(profile.style_reference, profile.style_words) !==
    ((target.styleSig as string | null) ?? null);
  const view = match
    ? capsuleView(target, match, profile.capsule_overrides, profile.capsule_swaps)
    : null;
  // Estado completo: match al día y 17/17 cubiertas → pantalla de mantenimiento.
  const done = !!view && !stale && view.coveragePct >= 100;
  // Escalada (issue #89): descartó ≥ 1/3 → afinar el estilo en vez de dejarla coja.
  const escalated = capsuleEscalated(target, profile.capsule_swaps);

  // Pestaña "tus looks": outfits ya generados con lo que tienes de la cápsula.
  const rawLooks = (profile.capsule_outfits as TripOutfit[] | null) ?? null;
  const looksStale = !!rawLooks && profile.capsule_outfits_sig !== sig;

  // Estado que vive FUERA del jsonb del look: el corazón y el try-on ya generado
  // viven en su fila de `outfits` (source='capsula', llave = las prendas del
  // look — ver migración 0088). Sin esto, el corazón se apagaba al recargar y el
  // try-on se volvía a generar (y a cobrar) cada vez.
  let lookRowByKey = new Map<string, { favorito: boolean; tryon: string | null }>();
  let nameToId: Record<string, string> = {};
  if (rawLooks?.length) {
    const [{ data: lookRows }, ids] = await Promise.all([
      supabase
        .from("outfits")
        .select("capsule_look_key, favorited_at, tryon_path")
        .eq("user_id", profile.id)
        .eq("source", "capsula")
        .is("deleted_at", null),
      loadClosetNameToId(supabase, profile.id),
    ]);
    nameToId = ids;
    const paths = (lookRows ?? [])
      .map((r) => r.tryon_path as string | null)
      .filter((p): p is string => !!p);
    const signedTryon = new Map<string, string>();
    if (paths.length > 0) {
      const { data } = await supabase.storage.from("prendas").createSignedUrls(paths, 3600);
      data?.forEach((s) => {
        if (s.path && s.signedUrl) signedTryon.set(s.path, s.signedUrl);
      });
    }
    lookRowByKey = new Map(
      (lookRows ?? []).map((r) => [
        r.capsule_look_key as string,
        {
          favorito: !!r.favorited_at,
          tryon: r.tryon_path ? (signedTryon.get(r.tryon_path as string) ?? null) : null,
        },
      ])
    );
  }

  const resolvedLooks = rawLooks
    ? rawLooks.map((o) => {
        const row = lookRowByKey.get(capsuleLookKey(o.prendas));
        return {
          ocasion: o.ocasion as string,
          titulo: o.titulo,
          porque: o.porque,
          tip: o.tip ?? null,
          voto: (o.voto ?? null) as "up" | "down" | null,
          favorito: row?.favorito ?? false,
          tryonImage: row?.tryon ?? null,
          prendas: o.prendas.map((nombre) => ({
            nombre,
            image: images[nombre] ?? null,
            id: nameToId[nombre] ?? null,
          })),
        };
      })
    : null;

  return (
    <AppShell desktop="wide">
      <section className="flex flex-col gap-6 pt-1">
        <ClosetNav />
        {/* La primera visita explica la idea antes de soltar la lista: sin eso,
            15 prendas que no compraste se leen como una lista de compras que la
            app se sacó de la manga. La navegación del clóset se queda arriba —
            la intro informa, no secuestra. */}
        <EsencialesGate
          vista={!!profile.hints_seen?.["intro:esenciales"]}
          total={target.items.length}
        >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink lg:text-[38px]">
            tus esenciales
          </h1>
          <Link
            href="/closet/capsula/editar"
            className="shrink-0 text-sm font-semibold text-accent hover:underline lg:hidden"
          >
            editar
          </Link>
        </div>

        <CapsuleTabs
          capsulaCount={view ? view.totalCount : target.items.length}
          looksCount={resolvedLooks?.length ?? 0}
          looksStale={looksStale}
          initialTab={initialTab}
          capsula={
            // Desktop (F3): 2 columnas — "por qué es tuya" + avisos sticky a la
            // izquierda, la lista de prendas a la derecha. Móvil: una columna.
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:w-[38%] lg:shrink-0">
              {/* Por qué esta cápsula es tuya: sello en serif + pilares cortos (sin caja). */}
              {target.firma || target.pilares?.length || target.resumen ? (
                <PorQueEsTuya
                  firma={target.firma}
                  subline={target.subline}
                  pilares={target.pilares}
                  resumen={target.resumen}
                />
              ) : null}

              {/* Un solo nudge "está vieja" cuando cambió el estilo: regenerar ya
                  pone capsule_match=null, así que el recálculo del clóset (abajo)
                  se encadena solo. Por eso ese banner se oculta si styleStale. */}
              {styleStale ? (
                <form action={regenerateCapsuleTarget}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft p-3 text-left text-sm font-medium text-accent transition-colors hover:border-accent"
                  >
                    <Icon name="destello" size={16} />
                    Tus esenciales se quedaron atrás de ti — ponlos al día
                  </button>
                </form>
              ) : null}

              {escalated ? (
                <div className="flex flex-col gap-2.5 rounded-lg border border-accent/40 bg-accent-soft p-3.5">
                  <span className="text-sm font-semibold text-ink">
                    Descartaste varias piezas
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted">
                    Cuando varias no te laten, casi siempre es que hay que afinar tu
                    estilo, no la prenda. Ajusta lo que no va y te rearmo la lista.
                  </span>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <Link
                      href="/perfil"
                      className="flex min-h-9 items-center rounded-sm border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-ink"
                    >
                      Afinar mi estilo
                    </Link>
                    <form action={regenerateCapsuleTarget}>
                      <button
                        type="submit"
                        className="flex min-h-9 items-center gap-1.5 rounded-sm bg-accent px-3 text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
                      >
                        <Icon name="destello" size={15} /> Rearmar mi lista
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}

              {/* Editar: en desktop vive al pie del rail (handoff); en móvil el
                  link sigue junto al título. */}
              <Link
                href="/closet/capsula/editar"
                className="hidden w-fit items-center gap-1 text-sm font-semibold text-ink hover:underline lg:flex"
              >
                editar mis esenciales <Icon name="chevron" size={14} />
              </Link>
            </div>

            <div className="flex flex-col gap-6 lg:min-w-0 lg:flex-1">
              {done && view ? (
                <DoneState have={view.haveCount} total={view.totalCount} />
              ) : (
                <>
                  {/* Si styleStale, el nudge de arriba ya cubre esto (regenerar
                      encadena el recálculo) — no dupliques el aviso. */}
                  {stale && !styleStale ? (
                    <MatchRecalc
                      auto={!match}
                      label={
                        match
                          ? "Tu clóset cambió — recalcular qué tienes"
                          : "Calcular qué ya tienes y qué te falta"
                      }
                    />
                  ) : null}

                  {/* Hint de función (una vez): el swap "no me convence". El
                      coach-mark apunta al botón; si no hay ningún hueco en
                      pantalla, no se muestra ni se marca visto (espera). */}
                  {!profile.hints_seen?.["capsula-swap"] ? (
                    <Hint id="capsula-swap">
                      ¿alguna pieza no te convence? dímelo y te sugiero otra en su
                      lugar
                    </Hint>
                  ) : null}

                  <CapsuleList
                    target={target}
                    match={match}
                    overrides={profile.capsule_overrides}
                    swaps={profile.capsule_swaps}
                    images={images}
                    catalogImages={catalogImages}
                    savedWishKeys={savedWishKeys}
                    userId={profile.id}
                  />
                </>
              )}
            </div>
            </div>
          }
          looks={
            <CapsuleLooks
              outfits={resolvedLooks}
              stale={looksStale}
              ocasiones={occasionsFromLifestyle(profile.lifestyle) as Occasion[]}
            />
          }
        />
        </EsencialesGate>
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
          <h2 className="text-[18px] font-semibold leading-tight text-ink">
            Tienes todos tus esenciales
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
          sub="Ajusta tus esenciales si tu estilo cambió"
        />
        <NextCard
          icon="gancho"
          href="/closet"
          title="Ve todo tu guardarropa"
          sub="Toda tu ropa, no solo lo esencial"
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
