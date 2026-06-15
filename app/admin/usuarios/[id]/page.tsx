import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

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

  const [{ data: items }, { data: outfits }, { data: events }] = await Promise.all([
    supabase.from("items").select("id, source, attrs").eq("user_id", id),
    supabase
      .from("outfits")
      .select("id, title, explanation, item_ids, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("events")
      .select("type, outfit_id")
      .eq("user_id", id)
      .in("type", ["vote_up", "vote_down", "worn"]),
  ]);

  const voteOf = new Map<string, string>();
  const wornSet = new Set<string>();
  for (const e of events ?? []) {
    if (!e.outfit_id) continue;
    if (e.type === "worn") wornSet.add(e.outfit_id);
    else voteOf.set(e.outfit_id, e.type === "vote_up" ? "👍" : "👎");
  }

  const arch = profile.style_archetype as { nombre?: string; descripcion?: string } | null;
  const paleta = [profile.palette_season, profile.palette_flow]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/usuarios" className="text-sm text-muted hover:text-ink">
        ← Usuarios
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">{profile.email}</h1>
        <p className="text-sm text-muted">
          {profile.onboarding_step >= 5 ? "Onboarding completo" : `En el paso ${profile.onboarding_step}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3">
        <Field label="Género" value={profile.gender ?? "—"} />
        <Field label="Colorimetría" value={paleta || "—"} />
        <Field label="Objetivo" value={profile.last_objective ?? "—"} />
        <Field label="Estilo" value={arch?.nombre ?? "—"} />
        <Field label="Gustos" value={(profile.taste_tags ?? []).slice(0, 6).join(", ") || "—"} />
        <Field label="Avatar" value={profile.avatar_path ? "sí" : "no"} />
      </div>

      {arch?.descripcion ? (
        <p className="editorial text-sm text-muted">“{arch.descripcion}”</p>
      ) : null}

      {/* Clóset */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Clóset ({items?.length ?? 0})
        </h2>
        <div className="flex flex-wrap gap-2">
          {(items ?? []).map((it) => {
            const a = it.attrs as { nombre?: string; color_hex?: string };
            return (
              <span
                key={it.id}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink"
              >
                <span
                  className="h-3 w-3 rounded-full border border-line"
                  style={{ backgroundColor: a.color_hex ?? "#E5E1DD" }}
                />
                {a.nombre ?? "prenda"}
                {it.source === "photo" ? " 📷" : ""}
              </span>
            );
          })}
          {(items ?? []).length === 0 ? (
            <span className="text-sm text-muted">Clóset vacío.</span>
          ) : null}
        </div>
      </section>

      {/* Outfits */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Outfits ({outfits?.length ?? 0})
        </h2>
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {(outfits ?? []).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {o.title ?? "Look"}
                </span>
                <span className="truncate text-xs text-muted">{o.explanation}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-sm">
                {voteOf.get(o.id) ?? ""}
                {wornSet.has(o.id) ? "✓puesto" : ""}
              </div>
            </div>
          ))}
          {(outfits ?? []).length === 0 ? (
            <span className="px-4 py-3 text-sm text-muted">Sin outfits aún.</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
