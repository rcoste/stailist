// El destilador: las fotos de referencia con las que se destila cómo se lleva
// cada estilo (ver lib/engine/recetario.ts), y los juicios sobre ellas.
//
// Las fotos viven en el bucket PRIVADO `referencias` y se sirven con URL
// firmada. Son de terceros (cosechadas de Pinterest): privado + firmada es el
// equivalente a un board privado; público sería redistribuirlas.
//
// Por qué en servidor y no en el disco: la curaduría son ~90 fotos por tanda y
// se hace en ratos muertos, desde el celular. Un archivo local no sincroniza.

import { createClient } from "@/lib/supabase/server";
import type { Referencia, Discrepancia } from "./destilador-tipos";

export type { Juicio, Referencia, Discrepancia } from "./destilador-tipos";

/** Cuántas fotos hay y cuántas van juzgadas, por estilo. */
export async function resumenPorEstilo(
  genero: "hombre" | "mujer"
): Promise<{ estilo: string; total: number; juzgadas: number; sirven: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("referencias")
    .select("estilo, sirve")
    .eq("genero", genero);

  const porEstilo = new Map<string, { total: number; juzgadas: number; sirven: number }>();
  for (const r of data ?? []) {
    // Los que empiezan con "_" son carpetas de tránsito, no estilos: la cosecha
    // de clima llega sin estilo asignado y un clasificador la reparte después
    // (scripts/clasificar-estilo.mjs). Lo que no se pudo repartir se queda ahí y
    // no es curable — mostrarlo sería inventar un estilo que no existe.
    if (r.estilo.startsWith("_")) continue;
    const acc = porEstilo.get(r.estilo) ?? { total: 0, juzgadas: 0, sirven: 0 };
    acc.total++;
    if (r.sirve !== null) acc.juzgadas++;
    if (r.sirve === true) acc.sirven++;
    porEstilo.set(r.estilo, acc);
  }
  return [...porEstilo.entries()]
    .map(([estilo, v]) => ({ estilo, ...v }))
    .sort((a, b) => a.estilo.localeCompare(b.estilo));
}

/**
 * Las fotos PENDIENTES de un estilo, con URL firmada.
 *
 * Solo pendientes, no todas. La primera versión traía todas con las pendientes
 * al principio, y el resultado era que el swipe nunca se acababa: al terminar
 * lo pendiente seguía mostrando lo ya juzgado, sin nada que lo indicara. Se
 * sentía como si el trabajo no se guardara.
 */
export async function referenciasDeEstilo(
  genero: "hombre" | "mujer",
  estilo: string
): Promise<Referencia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("referencias")
    .select("id, path, sirve, motivo, mio, nota")
    .eq("genero", genero)
    .eq("estilo", estilo)
    .is("sirve", null)
    .order("path");

  if (!data?.length) return [];

  // Una hora alcanza de sobra para una sesión de curaduría y evita firmar de
  // nuevo en cada navegación.
  const { data: urls } = await supabase.storage
    .from("referencias")
    .createSignedUrls(data.map((r) => r.path), 3600);

  const porPath = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
  return data.map((r) => ({
    id: r.id,
    path: r.path,
    url: porPath.get(r.path) ?? null,
    sirve: r.sirve,
    motivo: r.motivo,
    mio: r.mio,
    nota: r.nota,
  }));
}

/**
 * Las fotos donde el humano dijo "no sirve" y el juez de taxonomía dice que SÍ
 * son del estilo — la cola de la segunda pasada.
 *
 * Es el único conjunto donde hace falta re-preguntar: si ambos dicen que no, no
 * hay nada que discutir, y las que el humano aprobó ya están dentro. Las ya
 * revisadas salen de la cola.
 */
export async function discrepancias(
  genero: "hombre" | "mujer"
): Promise<Discrepancia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("referencias")
    .select("id, path, estilo, sirve, motivo, mio, nota, referencias_juez!inner(es_del_estilo, ejecucion, observado)")
    .eq("genero", genero)
    .eq("sirve", false)
    .is("revision", null)
    .eq("referencias_juez.es_del_estilo", true)
    .order("estilo")
    .order("path");

  if (!data?.length) return [];

  const { data: urls } = await supabase.storage
    .from("referencias")
    .createSignedUrls(data.map((r) => r.path), 3600);
  const porPath = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));

  return data.map((r) => {
    // El embed llega como arreglo o como objeto según la forma del join; se
    // normaliza aquí para que la pantalla no cargue con ese detalle.
    const juez = Array.isArray(r.referencias_juez)
      ? r.referencias_juez[0]
      : r.referencias_juez;
    return {
      id: r.id,
      path: r.path,
      url: porPath.get(r.path) ?? null,
      sirve: r.sirve,
      motivo: r.motivo,
      mio: r.mio,
      nota: r.nota,
      observado: juez?.observado ?? null,
      ejecucion: juez?.ejecucion ?? 0,
    };
  });
}
