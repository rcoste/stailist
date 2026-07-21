import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// El viaje "vivo" del usuario: el que está en curso o arranca pronto. Lo comparten
// la card contextual del home y el badge del botón "Más" de la tab bar, para que
// ambos digan lo mismo y con la misma ventana.
export type TripContext = {
  id: string;
  lugar: string;
  dias: number; // 0 = ya empezó
  href: string; // detalle si ya hay maleta; la lista si aún no
};

// Un viaje a dos meses no es contexto de hoy: fuera de esta ventana no se anuncia.
export const VENTANA_VIAJE_DIAS = 7;

// Días entre hoy y una fecha YYYY-MM-DD, comparando fechas puras (sin horas):
// evita que un viaje que empieza hoy salga como "faltan -1 días" por zona horaria.
function diasHasta(fecha: string, hoy: string): number {
  const a = Date.parse(`${hoy}T00:00:00Z`);
  const b = Date.parse(`${fecha}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export async function loadTripContext(
  supabase: SupabaseClient,
  userId: string
): Promise<TripContext | null> {
  const hoy = new Date().toISOString().slice(0, 10);
  // fecha_fin >= hoy cubre los dos casos (en curso y por venir); el más cercano
  // primero. La ventana se aplica después, ya en memoria.
  const { data } = await supabase
    .from("trips")
    .select("id, lugar, fecha_inicio, fecha_fin, capsule_match")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("fecha_fin", hoy)
    .order("fecha_inicio", { ascending: true })
    .limit(1);

  const trip = data?.[0];
  if (!trip) return null;

  const dias = diasHasta(trip.fecha_inicio as string, hoy);
  if (dias > VENTANA_VIAJE_DIAS) return null;

  return {
    id: trip.id as string,
    lugar: trip.lugar as string,
    dias: Math.max(0, dias),
    href: trip.capsule_match ? `/viaje/${trip.id}` : "/viaje/lista",
  };
}

// Lo que la tab bar necesita del server: quién eres (para la hoja de añadir) y
// tu viaje vivo (para el aviso). Resuelve sesión por su cuenta y NUNCA lanza —
// la barra se pinta en todas las pantallas y un fallo aquí no puede tumbarlas.
// `cache` dedupe por render: aunque la pidan el shell y la página, va una vez.
//
// Usa el usuario REAL de la sesión, no el de "ver como": en ese modo el proxy
// bloquea los POST, así que la hoja de añadir no puede escribir de todos modos.
export const loadNavState = cache(
  async (): Promise<{ userId: string; trip: TripContext | null } | null> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      return { userId: user.id, trip: await loadTripContext(supabase, user.id) };
    } catch {
      return null;
    }
  }
);
