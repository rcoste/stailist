import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_COMPLETE } from "@/lib/onboarding";
import { UsuariosTable, type UserRow } from "./usuarios-table";

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  onboarding_step: number;
  palette_season: string | null;
  avatar_path: string | null;
  capsule_target: unknown | null;
  created_at: string;
};

export default async function AdminUsuarios() {
  const supabase = await createClient();

  // En beta cerrada las tablas son diminutas: traemos todo y agregamos en
  // memoria (mismo patrón que el dashboard). Si esto crece a miles de filas,
  // se mueve a una vista SQL con conteos por usuario.
  const [profilesRes, itemsRes, outfitsRes, tripsRes, wishlistRes, eventsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, is_admin, onboarding_step, palette_season, avatar_path, capsule_target, created_at"
        ),
      supabase.from("items").select("user_id, source, created_at, deleted_at"),
      supabase.from("outfits").select("user_id, created_at").is("deleted_at", null),
      supabase.from("trips").select("user_id, created_at").is("deleted_at", null),
      supabase.from("wishlist_items").select("user_id, created_at"),
      supabase.from("events").select("user_id, type, created_at"),
    ]);

  const profiles = (profilesRes.data ?? []) as Profile[];

  // Acumulador por usuario de todo lo que no vive en profiles.
  type Agg = {
    closet: number;
    closetPhotos: number;
    looks: number;
    viaje: number;
    cartera: number;
    worn: number;
    votes: number;
    lastActive: number | null;
  };
  const empty = (): Agg => ({
    closet: 0,
    closetPhotos: 0,
    looks: 0,
    viaje: 0,
    cartera: 0,
    worn: 0,
    votes: 0,
    lastActive: null,
  });
  const agg = new Map<string, Agg>();
  const bump = (uid: string): Agg => {
    let a = agg.get(uid);
    if (!a) {
      a = empty();
      agg.set(uid, a);
    }
    return a;
  };
  const touch = (a: Agg, iso: string | null | undefined) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (a.lastActive === null || t > a.lastActive) a.lastActive = t;
  };

  // Clóset: cuenta solo prendas vivas; las fotos propias son señal de esfuerzo.
  for (const it of itemsRes.data ?? []) {
    if (!it.user_id) continue;
    const a = bump(it.user_id);
    touch(a, it.created_at);
    if (it.deleted_at) continue;
    a.closet++;
    if (it.source === "photo") a.closetPhotos++;
  }
  for (const o of outfitsRes.data ?? []) {
    if (!o.user_id) continue;
    const a = bump(o.user_id);
    a.looks++;
    touch(a, o.created_at);
  }
  for (const t of tripsRes.data ?? []) {
    if (!t.user_id) continue;
    const a = bump(t.user_id);
    a.viaje++;
    touch(a, t.created_at);
  }
  for (const w of wishlistRes.data ?? []) {
    if (!w.user_id) continue;
    const a = bump(w.user_id);
    a.cartera++;
    touch(a, w.created_at);
  }
  for (const e of eventsRes.data ?? []) {
    if (!e.user_id) continue;
    const a = bump(e.user_id);
    touch(a, e.created_at);
    if (e.type === "vote_up" || e.type === "vote_down") a.votes++;
    else if (e.type === "worn") a.worn++;
  }

  const rows: UserRow[] = profiles.map((p) => {
    const a = agg.get(p.id) ?? empty();
    return {
      id: p.id,
      email: p.email,
      isAdmin: p.is_admin,
      onboardingStep: p.onboarding_step ?? 0,
      onboardingDone: (p.onboarding_step ?? 0) >= ONBOARDING_COMPLETE,
      color: !!p.palette_season,
      avatar: !!p.avatar_path,
      capsula: !!p.capsule_target,
      closet: a.closet,
      closetPhotos: a.closetPhotos,
      looks: a.looks,
      viaje: a.viaje,
      cartera: a.cartera,
      worn: a.worn,
      votes: a.votes,
      lastActive: a.lastActive,
    };
  });

  const now = Date.now();

  return <UsuariosTable rows={rows} now={now} />;
}
