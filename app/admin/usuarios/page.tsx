import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_COMPLETE } from "@/lib/onboarding";
import { ultimoUsoPorUsuario } from "@/lib/admin/actividad";
import { todasLasFilas } from "@/lib/todas-las-filas";
import { UsuariosTable, type UserRow } from "./usuarios-table";
import { withDb } from "@/lib/db";
import {
  EVENTOS_QUE_NO_SON_VOLVER,
  SQL_ADQUISICION,
  campanaDe,
  fuenteDe,
  ventanaCerrada,
  volvioEn7Dias,
} from "@/lib/admin/adquisicion";
import { esDeCampana } from "@/lib/admin/campana";
import { origenDesdeDato } from "@/lib/origen";
import { PESTANAS_PERSONAS, Pestanas } from "../_compartido/pestanas";

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  onboarding_step: number;
  palette_season: string | null;
  avatar_path: string | null;
  capsule_target: unknown | null;
  created_at: string;
  pais: string | null;
};

export default async function AdminUsuarios() {
  const supabase = await createClient();

  // Traemos todo y agregamos en memoria. De mil en mil: PostgREST corta en
  // 1000 sin avisar, y con events e items pasando de dos mil la tabla contaba
  // clósets de menos sin que nada se viera roto (lib/admin/todas-las-filas.ts).
  const [perfilesRaw, items, outfits, trips, wishlist, events] = await Promise.all([
    todasLasFilas((d, h) =>
      supabase
        .from("profiles")
        .select(
          "id, email, is_admin, onboarding_step, palette_season, avatar_path, capsule_target, created_at, pais"
        )
        // Los borradores (sin correo, lib/borrador.ts) no son usuarias todavía.
        .not("email", "is", null)
        .order("id")
        .range(d, h)
    ),
    todasLasFilas((d, h) => supabase.from("items").select("user_id, source, created_at, deleted_at").order("id").range(d, h)),
    todasLasFilas((d, h) =>
      supabase.from("outfits").select("user_id, created_at").is("deleted_at", null).order("id").range(d, h)
    ),
    todasLasFilas((d, h) =>
      supabase.from("trips").select("user_id, created_at").is("deleted_at", null).order("id").range(d, h)
    ),
    todasLasFilas((d, h) => supabase.from("wishlist_items").select("user_id, created_at").order("id").range(d, h)),
    todasLasFilas((d, h) => supabase.from("events").select("user_id, type, created_at").order("id").range(d, h)),
  ]);
  const profilesRes = { data: perfilesRaw };
  const itemsRes = { data: items };
  const outfitsRes = { data: outfits };
  const tripsRes = { data: trips };
  const wishlistRes = { data: wishlist };
  const eventsRes = { data: events };

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
  };
  const empty = (): Agg => ({
    closet: 0,
    closetPhotos: 0,
    looks: 0,
    viaje: 0,
    cartera: 0,
    worn: 0,
    votes: 0,
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
  // Clóset: cuenta solo prendas vivas; las fotos propias son señal de esfuerzo.
  for (const it of itemsRes.data ?? []) {
    if (!it.user_id) continue;
    const a = bump(it.user_id);
    if (it.deleted_at) continue;
    a.closet++;
    if (it.source === "photo") a.closetPhotos++;
  }
  for (const o of outfitsRes.data ?? []) {
    if (!o.user_id) continue;
    bump(o.user_id).looks++;
  }
  for (const t of tripsRes.data ?? []) {
    if (!t.user_id) continue;
    bump(t.user_id).viaje++;
  }
  for (const w of wishlistRes.data ?? []) {
    if (!w.user_id) continue;
    bump(w.user_id).cartera++;
  }
  for (const e of eventsRes.data ?? []) {
    if (!e.user_id) continue;
    const a = bump(e.user_id);
    if (e.type === "vote_up" || e.type === "vote_down") a.votes++;
    else if (e.type === "worn") a.worn++;
  }

  // "Último uso" sale del MISMO cálculo que el detalle de cada persona
  // (lib/admin/actividad.ts): esta columna y esa ficha discreparon hasta el
  // 2026-09-12 porque cada una lo hacía por su cuenta.
  const uso = ultimoUsoPorUsuario({
    items: (itemsRes.data ?? []) as never,
    outfits: (outfitsRes.data ?? []) as never,
    trips: (tripsRes.data ?? []) as never,
    wishlist: (wishlistRes.data ?? []) as never,
    events: (eventsRes.data ?? []) as never,
  });

  // DE DÓNDE LLEGÓ Y SI VOLVIÓ, con las mismas definiciones que Campañas y
  // Retención (SQL_ADQUISICION): la lista ya no dice una cosa y el resto otra.
  const ahora = new Date();
  const adquisicion = new Map(
    (await withDb(async (c) => (await c.query(SQL_ADQUISICION, [EVENTOS_QUE_NO_SON_VOLVER])).rows)).map((r) => {
      const o = origenDesdeDato(r.origen);
      const campana = campanaDe(o);
      return [
        r.id as string,
        {
          origen: campana !== "—" ? campana : fuenteDe(o),
          deAnuncio: esDeCampana(o),
          volvio: volvioEn7Dias(r.dia_inicio, r.dias)
            ? ("si" as const)
            : ventanaCerrada(r.dia_inicio, ahora)
              ? ("no" as const)
              : ("semana" as const),
        },
      ];
    })
  );

  const rows: UserRow[] = profiles.map((p) => {
    const a = agg.get(p.id) ?? empty();
    const q = adquisicion.get(p.id);
    return {
      id: p.id,
      email: p.email,
      pais: p.pais,
      origen: q?.origen ?? "—",
      deAnuncio: q?.deAnuncio ?? false,
      volvio: q?.volvio ?? null,
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
      lastActive: uso.has(p.id) ? new Date(uso.get(p.id)!).getTime() : null,
    };
  });

  const now = ahora.getTime();

  return (
    <div className="flex flex-col gap-5">
      <Pestanas pestanas={PESTANAS_PERSONAS} activa="/admin/usuarios" />
      <UsuariosTable rows={rows} now={now} />
    </div>
  );
}
