import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ITEM_IMAGE_SELECT,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";

// "Cuándo" en lenguaje humano (mismo criterio que la lista de usuarios).
function hace(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

// Devuelve el ISO más reciente entre dos (o null si ambos faltan).
function masReciente(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

// TTV en lenguaje humano. La promesa es <2 min; cuentas viejas traen valores de
// días (dejaron el onboarding a medias) — mostrarlos en segundos es ilegible.
function ttvHumano(seconds: number): string {
  if (seconds < 120) return `${Math.round(seconds)} s`;
  const min = seconds / 60;
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} días`;
}

// Etiqueta humana por tipo de evento para la línea de actividad. Los tipos de
// instrumentación interna (jueces, timings) se filtran en la query.
const EVENTO_LABEL: Record<string, string> = {
  vote_up: "👍 votó un look",
  vote_down: "👎 votó un look",
  worn: "✓ se puso un look",
  another_look: "🔄 pidió otro look",
  trip_look_vote: "✈️ votó un look de viaje",
  avatar_generated: "🪞 generó su avatar",
  style_vetoes_edit: "🚫 editó sus vetos",
  onboarding_step: "🚶 avanzó en onboarding",
  first_outfit_ttv: "⏱️ primer outfit",
  pwa_installed: "📱 instaló la app",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

type ItemRow = ItemImageRow & {
  id: string;
  source: string | null;
};

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (!profile) notFound();

  const [
    { data: itemsRaw },
    { data: outfits },
    { data: events },
    { data: actividad },
    { data: ttvEvent },
  ] = await Promise.all([
    supabase
      .from("items")
      .select(`id, source, ${ITEM_IMAGE_SELECT}`)
      .eq("user_id", id),
    supabase
      .from("outfits")
      .select("id, title, explanation, occasion, item_ids, created_at, tryon_path, source")
      .eq("user_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("events")
      .select("type, outfit_id")
      .eq("user_id", id)
      .in("type", ["vote_up", "vote_down", "worn"]),
    // Actividad reciente: solo eventos con significado humano (sin instrumentación).
    supabase
      .from("events")
      .select("type, created_at, data")
      .eq("user_id", id)
      .in("type", Object.keys(EVENTO_LABEL))
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("events")
      .select("data")
      .eq("user_id", id)
      .eq("type", "first_outfit_ttv")
      .limit(1)
      .maybeSingle(),
  ]);
  const items = (itemsRaw ?? []) as unknown as ItemRow[];

  // Firmar en un solo batch: avatar + try-ons + paths privados de prendas.
  const toSign = [
    ...new Set([
      profile.avatar_path as string | null,
      ...(outfits ?? []).map((o) => o.tryon_path as string | null),
      ...items.flatMap((i) => itemPrivatePaths(i)),
    ]),
  ].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (toSign.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(toSign, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }
  const avatarUrl = profile.avatar_path
    ? signed.get(profile.avatar_path) ?? null
    : null;

  // Imagen + nombre por prenda (mismo orden canónico que toda la app).
  const prendaById = new Map<
    string,
    { nombre: string; swatch: string; imagen: string | null }
  >(
    items.map((i) => {
      const attrs = (i.attrs ?? {}) as { nombre?: string; color_hex?: string };
      return [
        i.id,
        {
          nombre: i.archetypes?.name ?? attrs.nombre ?? "Prenda",
          swatch: attrs.color_hex ?? "#E5E1DD",
          imagen: itemImageUrlSync(i, (p) => signed.get(p)),
        },
      ];
    })
  );

  const voteOf = new Map<string, string>();
  const wornSet = new Set<string>();
  for (const e of events ?? []) {
    if (!e.outfit_id) continue;
    if (e.type === "worn") wornSet.add(e.outfit_id);
    else voteOf.set(e.outfit_id, e.type === "vote_up" ? "👍" : "👎");
  }

  // Último uso = lo más reciente entre su última actividad y su último outfit.
  const lastActive = masReciente(
    actividad?.[0]?.created_at,
    outfits?.[0]?.created_at
  );
  const ttv = (ttvEvent?.data as { seconds?: number } | null)?.seconds;

  const arch = profile.style_archetype as { nombre?: string; descripcion?: string } | null;
  const paleta = [profile.palette_season, profile.palette_flow]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/usuarios" className="text-sm text-muted hover:text-ink">
        ← Usuarios
      </Link>

      {/* Cabecera: avatar real + perfil */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {avatarUrl ? (
          <div className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-surface sm:w-40">
            <Image
              src={avatarUrl}
              alt="Avatar del usuario"
              fill
              sizes="160px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex aspect-[3/4] w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-xs text-muted sm:w-40">
            sin avatar
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-h2 font-semibold text-ink">{profile.email}</h1>
              <p className="text-sm text-muted">
                {profile.onboarding_step >= 5
                  ? "Onboarding completo"
                  : `En el paso ${profile.onboarding_step}`}
              </p>
            </div>
            {/* Solo con onboarding completo: si no, sus pantallas redirigen a
                su paso pendiente y el modo no tiene nada útil que mostrar. */}
            {profile.onboarding_step >= 5 ? (
              <a
                href={`/admin/ver-como/${profile.id}`}
                className="flex min-h-9 shrink-0 items-center rounded-sm bg-ink px-4 text-xs font-medium text-bg transition-opacity duration-200 hover:opacity-80"
              >
                👁 Ver su app
              </a>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3">
            <Field label="Género" value={profile.gender ?? "—"} />
            <Field label="Colorimetría" value={paleta || "—"} />
            <Field label="Objetivo" value={profile.last_objective ?? "—"} />
            <Field label="Estilo" value={arch?.nombre ?? "—"} />
            <Field
              label="Gustos"
              value={(profile.taste_tags ?? []).slice(0, 6).join(", ") || "—"}
            />
            <Field label="Último uso" value={hace(lastActive)} />
            <Field
              label="TTV (1er outfit)"
              value={ttv != null ? ttvHumano(ttv) : "—"}
            />
          </div>
        </div>
      </div>

      {arch?.descripcion ? (
        <p className="editorial text-sm text-muted">“{arch.descripcion}”</p>
      ) : null}

      {/* Clóset visual */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold font-sans uppercase tracking-wide text-muted">
          Clóset ({items.length})
        </h2>
        {items.length === 0 ? (
          <span className="text-sm text-muted">Clóset vacío.</span>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {items.map((it) => {
              const p = prendaById.get(it.id)!;
              return (
                <figure
                  key={it.id}
                  className="flex flex-col gap-1 overflow-hidden rounded-xl border border-line bg-surface"
                >
                  <div className="relative aspect-square w-full">
                    {p.imagen ? (
                      <Image
                        src={p.imagen}
                        alt={p.nombre}
                        fill
                        sizes="120px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ backgroundColor: p.swatch }}
                      />
                    )}
                  </div>
                  <figcaption className="truncate px-2 pb-1.5 text-xs text-ink">
                    {p.nombre}
                    {it.source === "photo" ? " 📷" : ""}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </section>

      {/* Outfits visuales */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold font-sans uppercase tracking-wide text-muted">
          Outfits ({outfits?.length ?? 0})
        </h2>
        {(outfits ?? []).length === 0 ? (
          <span className="text-sm text-muted">Sin outfits aún.</span>
        ) : (
          <div className="flex flex-col gap-3">
            {(outfits ?? []).map((o) => {
              const tryon = o.tryon_path
                ? signed.get(o.tryon_path as string) ?? null
                : null;
              const prendas = (o.item_ids as string[]).map(
                (pid) =>
                  prendaById.get(pid) ?? {
                    nombre: "Prenda",
                    swatch: "#E5E1DD",
                    imagen: null,
                  }
              );
              return (
                <div
                  key={o.id}
                  className="flex gap-3 rounded-xl border border-line bg-surface p-3"
                >
                  {tryon ? (
                    <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg border border-line sm:w-24">
                      <Image
                        src={tryon}
                        alt={o.title ?? "Look"}
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-ink">
                          {o.title ?? "Look"}
                          {(o.source as string | null) === "viaje" ? " ✈️" : ""}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(o.created_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                          })}
                          {o.occasion ? ` · ${o.occasion}` : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-sm">
                        {voteOf.get(o.id) ?? ""}
                        {wornSet.has(o.id) ? (
                          <span className="text-xs text-success">✓ puesto</span>
                        ) : null}
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted">{o.explanation}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {prendas.map((p, k) => (
                        <div
                          key={k}
                          className="relative h-10 w-10 overflow-hidden rounded-md border border-line"
                          title={p.nombre}
                        >
                          {p.imagen ? (
                            <Image
                              src={p.imagen}
                              alt={p.nombre}
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div
                              className="h-full w-full"
                              style={{ backgroundColor: p.swatch }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Actividad reciente */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold font-sans uppercase tracking-wide text-muted">
          Actividad reciente
        </h2>
        {(actividad ?? []).length === 0 ? (
          <span className="text-sm text-muted">Sin actividad registrada.</span>
        ) : (
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {(actividad ?? []).map((e, k) => {
              const extra =
                e.type === "first_outfit_ttv"
                  ? ` en ${ttvHumano((e.data as { seconds?: number })?.seconds ?? 0)}`
                  : e.type === "onboarding_step"
                    ? ` (paso ${(e.data as { step?: number })?.step ?? "?"})`
                    : "";
              return (
                <div
                  key={k}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-sm text-ink">
                    {EVENTO_LABEL[e.type] ?? e.type}
                    {extra}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {hace(e.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
