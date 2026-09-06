import type { SupabaseClient } from "@supabase/supabase-js";
import { withDb } from "@/lib/db";

// BORRAR LA CUENTA ENTERA, Y SUS FOTOS.
//
// POR QUÉ EXISTE
// Hasta el 2026-09-06 no había forma de borrar una cuenta desde la app. La
// única vía era `scripts/reset-usuario.ts`, desde la terminal de Roberto, y
// además CONSERVABA la cuenta por diseño (es un "volver a empezar", no un
// "borrarme"). En un producto que guarda fotos de la cara, del cuerpo y del
// clóset, "escríbenos y lo borramos a mano" no alcanza: el aviso de
// privacidad promete que se puede, y tiene que ser un botón.
//
// QUÉ SE BORRA, EN ORDEN:
//   1. Los archivos de Storage (avatar, cara, sheet, fotos de prendas, renders,
//      try-ons, fit checks, referencias de estilo). Van PRIMERO y con la sesión
//      de la persona —la RLS de Storage permite borrar lo propio— porque después
//      de tirar la fila de auth ya no hay con qué firmar nada.
//   2. Las filas, en una sola transacción: lo que no cascadea (wishlist,
//      ai_calls) explícito, y el perfil, que arrastra por FK todo lo demás
//      (items, outfits, events, trips, library_candidates).
//   3. El usuario de auth. Esto es lo que hace que "borrar" sea borrar: sin
//      esta fila no hay sesión, no hay correo asociado, no hay nada.
//
// LO QUE NO SE TOCA: la fila de `allowlist`. Es una invitación, no un dato de
// la persona, y quitársela cerraría la puerta a quien se arrepiente.
//
// NO SE PUEDE DESHACER. La confirmación vive en la UI (escribir "borrar").

/**
 * Las tablas con `user_id` que NO cascadean desde `profiles`. Si aparece una
 * tabla nueva con user_id y sin FK, hay que sumarla aquí — el test contra el
 * script de reset lo recuerda.
 */
export const TABLAS_SIN_CASCADA = ["wishlist_items", "ai_calls"] as const;

/** Las que sí cascadean; se listan para el test y para leerlo de un vistazo. */
export const TABLAS_EN_CASCADA = [
  "events",
  "outfits",
  "items",
  "trips",
  "library_candidates",
] as const;

/** Todas las rutas de Storage que son de esta persona, en los dos buckets. */
export async function rutasDeLaPersona(uid: string): Promise<{
  prendas: string[];
  referencias: string[];
}> {
  return withDb(async (c) => {
    const p = await c.query<{ avatar_path: string | null; style_reference: unknown }>(
      `select avatar_path, style_reference from profiles where id = $1`,
      [uid]
    );
    const perfil = p.rows[0];
    const prendas = new Set<string>();
    if (perfil?.avatar_path) prendas.add(perfil.avatar_path);
    // Convención del wizard de avatar (lib/avatar-upload.ts): cara y sheet
    // viven al lado del avatar con nombre fijo.
    prendas.add(`${uid}/avatar-face.jpg`);
    prendas.add(`${uid}/avatar-sheet.jpg`);

    const a = await c.query<{ ruta: string }>(
      `select photo_path as ruta from items where user_id = $1 and photo_path is not null
       union select render_path from items where user_id = $1 and render_path is not null
       union select attrs->>'origen_foto' from items where user_id = $1 and attrs->>'origen_foto' is not null
       union select tryon_path from outfits where user_id = $1 and tryon_path is not null
       union select photo_path from outfits where user_id = $1 and photo_path is not null
       union select image_path from wishlist_items where user_id = $1 and image_path is not null`,
      [uid]
    );
    for (const r of a.rows) if (r.ruta) prendas.add(r.ruta);

    const sr = perfil?.style_reference as { image_paths?: unknown } | null;
    const referencias = Array.isArray(sr?.image_paths)
      ? (sr!.image_paths as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    return { prendas: Array.from(prendas), referencias };
  });
}

/**
 * Un cliente de Storage mínimo, para poder probar el recorrido sin Supabase.
 * `id === null` es cómo Supabase marca una CARPETA en `list()`.
 */
export type ListaStorage = {
  list: (
    carpeta: string,
    opts: { limit: number; offset: number }
  ) => Promise<{ data: { name: string; id: string | null }[] | null; error: unknown }>;
};

/**
 * TODO lo que hay bajo `${uid}/` en un bucket, recorriendo subcarpetas.
 *
 * Existe porque la primera versión reconstruía las rutas desde las filas
 * (photo_path, render_path, tryon_path…) y el primer borrado real dejó 48
 * archivos huérfanos: renders de prendas ya borradas, fit checks, referencias
 * de estilo en `style-ref/` (que viven en el bucket `prendas`, no en
 * `referencias`), la carpeta del comparador. Las filas no son el inventario;
 * la carpeta sí.
 */
export async function listarCarpeta(
  bucket: ListaStorage,
  carpeta: string
): Promise<string[]> {
  const out: string[] = [];
  const PAGINA = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await bucket.list(carpeta, { limit: PAGINA, offset });
    if (error || !data) break;
    for (const f of data) {
      const ruta = `${carpeta}/${f.name}`;
      if (f.id === null) out.push(...(await listarCarpeta(bucket, ruta)));
      else out.push(ruta);
    }
    if (data.length < PAGINA) break;
    offset += PAGINA;
  }
  return out;
}

/**
 * Borra los archivos con la sesión de la persona (la RLS de Storage permite
 * listar y borrar lo propio). Se une lo que dice la carpeta con lo que dicen
 * las filas: cinturón y tirantes. Best-effort por bucket: un archivo que ya no
 * existe no debe frenar el borrado de la cuenta.
 */
export async function borrarArchivos(
  supabase: SupabaseClient,
  uid: string,
  rutas: { prendas: string[]; referencias: string[] }
): Promise<{ prendas: number; referencias: number }> {
  const borrados = { prendas: 0, referencias: 0 };
  for (const bucket of ["prendas", "referencias"] as const) {
    const b = supabase.storage.from(bucket);
    const enCarpeta = await listarCarpeta(b as unknown as ListaStorage, uid);
    const todas = Array.from(new Set([...enCarpeta, ...rutas[bucket]]));
    if (!todas.length) continue;
    // remove() acepta lotes; 100 por llamada para no pasarse del cuerpo.
    for (let i = 0; i < todas.length; i += 100) {
      const lote = todas.slice(i, i + 100);
      const { error } = await b.remove(lote);
      if (error) console.error(`[borrar-cuenta] storage ${bucket}:`, error.message);
      else borrados[bucket] += lote.length;
    }
  }
  return borrados;
}

/** Las filas y el usuario de auth, en una transacción. Lanza si algo falla. */
export async function borrarFilasYAuth(uid: string): Promise<void> {
  await withDb(async (c) => {
    try {
      await c.query("begin");
      for (const t of TABLAS_SIN_CASCADA) {
        await c.query(`delete from public.${t} where user_id = $1`, [uid]);
      }
      // El perfil arrastra por FK las tablas en cascada.
      await c.query(`delete from public.profiles where id = $1`, [uid]);
      await c.query(`delete from auth.users where id = $1`, [uid]);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  });
}
