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
import type { Referencia } from "./destilador-tipos";

export type { Juicio, Referencia } from "./destilador-tipos";

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
 * Las fotos de un estilo, con URL firmada, las pendientes primero.
 *
 * Las pendientes van al principio porque el trabajo es terminar de juzgar: si
 * la lista arrancara por el orden del archivo, cada sesión nueva empezaría
 * repasando lo ya visto.
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
    .order("sirve", { ascending: true, nullsFirst: true })
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
