import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_COMPLETE } from "@/lib/onboarding";

type Profile = {
  id: string;
  email: string;
  gender: string | null;
  onboarding_step: number;
  palette_season: string | null;
  is_admin: boolean;
  created_at: string;
};

// Actividad agregada por usuario: la señal de "quién usa esto de verdad".
type Activity = {
  lastActive: number | null; // ms epoch del evento/outfit más reciente
  outfits: number;
  votes: number;
  worn: number;
};

const EMPTY_ACTIVITY: Activity = { lastActive: null, outfits: 0, votes: 0, worn: 0 };

// "Cuándo" en lenguaje humano. Sin librerías: la tabla es chica y esto basta.
function hace(ts: number | null): string {
  if (ts === null) return "nunca";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function AdminUsuarios() {
  const supabase = await createClient();

  // Perfiles + toda la actividad. En beta cerrada las tablas son diminutas, así
  // que traer eventos/outfits completos y agregar en memoria es lo más simple
  // (mismo patrón que el dashboard). Si esto crece, se mueve a una vista SQL.
  const [profilesRes, eventsRes, outfitsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, gender, onboarding_step, palette_season, is_admin, created_at"),
    supabase.from("events").select("user_id, type, created_at"),
    supabase.from("outfits").select("user_id, created_at"),
  ]);

  const profiles = (profilesRes.data ?? []) as Profile[];

  // Agrega actividad por usuario en un solo mapa.
  const activity = new Map<string, Activity>();
  const bump = (uid: string): Activity => {
    let a = activity.get(uid);
    if (!a) {
      a = { ...EMPTY_ACTIVITY };
      activity.set(uid, a);
    }
    return a;
  };
  const touch = (a: Activity, iso: string) => {
    const t = new Date(iso).getTime();
    if (a.lastActive === null || t > a.lastActive) a.lastActive = t;
  };

  for (const e of eventsRes.data ?? []) {
    if (!e.user_id) continue;
    const a = bump(e.user_id);
    touch(a, e.created_at);
    if (e.type === "vote_up" || e.type === "vote_down") a.votes++;
    else if (e.type === "worn") a.worn++;
  }
  for (const o of outfitsRes.data ?? []) {
    if (!o.user_id) continue;
    const a = bump(o.user_id);
    a.outfits++;
    touch(a, o.created_at);
  }

  // Ordena por último uso (los que nunca usaron caen al fondo). Empate → registro.
  const rows = profiles
    .map((p) => ({ ...p, act: activity.get(p.id) ?? EMPTY_ACTIVITY }))
    .sort((a, b) => {
      const la = a.act.lastActive ?? 0;
      const lb = b.act.lastActive ?? 0;
      if (lb !== la) return lb - la;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const now = Date.now();
  const activosSemana = rows.filter(
    (r) => r.act.lastActive !== null && now - r.act.lastActive <= WEEK_MS
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Usuarios</h1>
        <p className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "perfil" : "perfiles"} · {activosSemana}{" "}
          {activosSemana === 1 ? "activo" : "activos"} esta semana
        </p>
      </div>

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r) => {
          const done = r.onboarding_step >= ONBOARDING_COMPLETE;
          const recent =
            r.act.lastActive !== null && now - r.act.lastActive <= WEEK_MS;
          return (
            <Link
              key={r.id}
              href={`/admin/usuarios/${r.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-bg"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {r.email}
                  {r.is_admin ? (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-ink">
                      admin
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-xs text-muted">
                  {r.gender ?? "sin género"} · paleta {r.palette_season ?? "—"} ·{" "}
                  {done ? "completo" : `paso ${r.onboarding_step}`}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`text-xs font-medium ${recent ? "text-success" : "text-muted"}`}
                >
                  {hace(r.act.lastActive)}
                </span>
                <span className="text-xs text-muted">
                  🧺 {r.act.outfits} · 👍 {r.act.votes} · ✓ {r.act.worn}
                </span>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 ? (
          <span className="px-4 py-3 text-sm text-muted">Sin usuarios todavía.</span>
        ) : null}
      </div>
    </div>
  );
}
