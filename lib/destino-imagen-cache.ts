import type { SupabaseClient } from "@supabase/supabase-js";
import { imagenCatalogo, imagenGenerica, slugDestino } from "@/lib/destino-imagen";

// SIN `server-only` A PROPÓSITO, y no por descuido: lib/home-trip.ts importa de
// aquí y a lib/home-trip lo importan client components (aunque sea `import
// type`, que se borra al compilar — pero el día que alguien importe un valor,
// un server-only transitivo rompería la compilación de la ruta entera; ya pasó
// con lib/trip-context, está contado en lib/trip.ts). Este módulo no tiene
// nada de servidor: recibe el cliente de Supabase de quien llama.

// LA FOTO DE CADA VIAJE, resuelta con las tres fuentes en orden:
//   1. catálogo estático (public/destinos) — curado a mano, gana siempre;
//   2. foto generada del destino (destino_imagenes, status listo);
//   3. la genérica (playa/ciudad según lo que la persona dijo del viaje).
//
// UNA SOLA QUERY para todos los viajes de la pantalla, y SOLO LECTURA: esta
// función jamás dispara una generación (abrir la lista con 5 viajes de cola
// larga dispararía 5) — generar es del wizard y de nadie más.

export async function fotosDeViajes(
  supabase: SupabaseClient,
  viajes: { lugar: string; ocasiones?: string[] | null }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pendientes = new Map<string, string[]>(); // slug → lugares que lo piden

  for (const v of viajes) {
    if (out.has(v.lugar)) continue;
    const estatica = imagenCatalogo(v.lugar);
    if (estatica) {
      out.set(v.lugar, estatica);
    } else {
      const slug = slugDestino(v.lugar);
      pendientes.set(slug, [...(pendientes.get(slug) ?? []), v.lugar]);
    }
  }

  if (pendientes.size > 0) {
    const { data } = await supabase
      .from("destino_imagenes")
      .select("slug, path")
      .in("slug", Array.from(pendientes.keys()))
      .eq("status", "listo");
    for (const fila of data ?? []) {
      if (!fila.path) continue;
      const url = supabase.storage
        .from("destinos")
        .getPublicUrl(fila.path as string).data.publicUrl;
      for (const lugar of pendientes.get(fila.slug as string) ?? []) {
        out.set(lugar, url);
      }
    }
  }

  // Lo que no resolvió ninguna de las dos: la genérica por ocasiones.
  for (const v of viajes) {
    if (!out.has(v.lugar)) out.set(v.lugar, imagenGenerica(v.ocasiones ?? []));
  }
  return out;
}
