import { withDb } from "@/lib/db";
import type { FuentesCrudas } from "@/lib/admin/actividad";

// LAS FUENTES DE PERSONAS Y ACTIVIDAD, EN UNA SOLA IDA A LA BASE (2026-10-12).
//
// Las dos pantallas pedían las seis tablas enteras por supabase-js, de mil en
// mil (lib/todas-las-filas.ts): con events e items arriba de dos mil filas eran
// ~10 idas y vueltas y 2.2-3.3 s de servidor, y en ese rato la pantalla no
// daba ninguna señal. Roberto: "no funciona el clic". Postgres directo, como
// el resto del admin: una conexión, seis consultas, y las fechas ya en ISO
// (el feed las compara como texto, así que tienen que venir todas iguales).
// Sin RLS: sólo lo llaman páginas que ya exigieron admin.

export type PerfilAdmin = {
  id: string;
  email: string | null;
  created_at: string;
  pais: string | null;
  origen: unknown;
  como_nos_conocio: string | null;
  is_admin: boolean;
  onboarding_step: number;
  palette_season: string | null;
  avatar_path: string | null;
  capsule_target: unknown;
  onboarding_variante: string | null;
};

export type FuentesPersonas = Omit<FuentesCrudas, "profiles" | "items"> & {
  items: (FuentesCrudas["items"][number] & { source: string | null })[];
};

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

/**
 * `desde`: sólo lo que pasó desde esa fecha (lo creado o lo borrado). La
 * actividad enseña una ventana, no la historia entera: traer y pintar 1936
 * momentos costaba 2 s de base y otros 2 de render.
 */
export async function cargarPersonas(desde?: Date | null): Promise<{ perfiles: PerfilAdmin[]; fuentes: FuentesPersonas }> {
  const d = desde ? desde.toISOString() : null;
  const ventana = (col: string, conBorrado: boolean) =>
    d ? ` where ${col} >= $1${conBorrado ? ` or deleted_at >= $1` : ""}` : "";
  const args = d ? [d] : [];
  return withDb(async (c) => {
    const perfiles = (
      await c.query(
        `select id, email, created_at, pais, origen, como_nos_conocio, coalesce(is_admin, false) as is_admin,
                coalesce(onboarding_step, 0) as onboarding_step, palette_season, avatar_path, capsule_target, onboarding_variante
           from public.profiles`
      )
    ).rows.map((p) => ({ ...p, created_at: iso(p.created_at) as string })) as PerfilAdmin[];
    const items = (await c.query(`select id, user_id, source, created_at, deleted_at from public.items${ventana("created_at", true)}`, args)).rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      source: r.source,
      created_at: iso(r.created_at),
      deleted_at: iso(r.deleted_at),
    }));
    const conVida = (q: string) =>
      c.query(q, args).then((r) =>
        r.rows.map((x) => ({ id: x.id, user_id: x.user_id, created_at: iso(x.created_at), deleted_at: iso(x.deleted_at) }))
      );
    const outfits = await conVida(`select id, user_id, created_at, deleted_at, source from public.outfits${ventana("created_at", true)}`);
    const trips = await conVida(`select id, user_id, created_at, deleted_at from public.trips${ventana("created_at", true)}`);
    const wishlist = (await c.query(`select user_id, created_at from public.wishlist_items${ventana("created_at", false)}`, args)).rows.map((w) => ({
      user_id: w.user_id,
      created_at: iso(w.created_at),
    }));
    const events = (await c.query(`select user_id, outfit_id, type, data, created_at from public.events${ventana("created_at", false)}`, args)).rows.map((e) => ({
      user_id: e.user_id,
      outfit_id: e.outfit_id,
      type: e.type,
      data: e.data,
      created_at: iso(e.created_at),
    }));
    return { perfiles, fuentes: { items, outfits, trips, wishlist, events } };
  });
}

/** Lo que la lista de Personas necesita de cada cuenta, ya sumado en la base. */
export type ResumenPersona = {
  closet: number;
  closetPhotos: number;
  looks: number;
  viaje: number;
  cartera: number;
  worn: number;
  votes: number;
  /** El último rastro de cualquier tipo, ISO (lib/admin/actividad.ts ultimoUsoPorUsuario). */
  ultimoUso: string | null;
};

/**
 * La lista de Personas sumaba 6000 filas en memoria en cada carga (2 s sólo de
 * traerlas). Esto devuelve una fila por cuenta con los mismos números, y
 * "último uso" con la misma regla que la ficha: todo rastro cuenta, también
 * los borrados.
 */
export async function cargarResumenPersonas(): Promise<Map<string, ResumenPersona>> {
  const filas = await withDb(
    async (c) =>
      (
        await c.query(`
with it as (
  select user_id,
    count(*) filter (where deleted_at is null)::int as closet,
    count(*) filter (where deleted_at is null and source = 'photo')::int as closet_photos,
    greatest(max(created_at), max(deleted_at)) as ultimo
  from public.items group by user_id),
o as (select user_id, count(*) filter (where deleted_at is null)::int as looks, greatest(max(created_at), max(deleted_at)) as ultimo from public.outfits group by user_id),
t as (select user_id, count(*) filter (where deleted_at is null)::int as viaje, greatest(max(created_at), max(deleted_at)) as ultimo from public.trips group by user_id),
w as (select user_id, count(*)::int as cartera, max(created_at) as ultimo from public.wishlist_items group by user_id),
e as (select user_id,
    count(*) filter (where type = 'worn')::int as worn,
    count(*) filter (where type in ('vote_up', 'vote_down'))::int as votes,
    max(created_at) as ultimo
  from public.events group by user_id)
select p.id,
  coalesce(it.closet, 0) closet, coalesce(it.closet_photos, 0) closet_photos, coalesce(o.looks, 0) looks,
  coalesce(t.viaje, 0) viaje, coalesce(w.cartera, 0) cartera, coalesce(e.worn, 0) worn, coalesce(e.votes, 0) votes,
  greatest(it.ultimo, o.ultimo, t.ultimo, w.ultimo, e.ultimo) as ultimo_uso
from public.profiles p
left join it on it.user_id = p.id left join o on o.user_id = p.id left join t on t.user_id = p.id
left join w on w.user_id = p.id left join e on e.user_id = p.id`)
      ).rows
  );
  return new Map(
    filas.map((r) => [
      r.id as string,
      {
        closet: Number(r.closet),
        closetPhotos: Number(r.closet_photos),
        looks: Number(r.looks),
        viaje: Number(r.viaje),
        cartera: Number(r.cartera),
        worn: Number(r.worn),
        votes: Number(r.votes),
        ultimoUso: iso(r.ultimo_uso),
      },
    ])
  );
}
