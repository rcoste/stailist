import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// LA LLAVE MAESTRA DE SUPABASE (service_role). ENCERRADA A PROPÓSITO.
//
// Hasta el 2026-09-10 la app no la usaba en ningún lado, y eso era una
// propiedad de seguridad que la auditoría pre-release anotó a favor. Ese día
// Roberto eligió el borrado programado con recuperación completa (opción A): a
// los 30 días hay que borrar las fotos de una cuenta cuya dueña ya no tiene
// sesión, y la RLS de Storage sólo deja borrar lo propio. Sin esta llave, o se
// borraban las fotos el mismo día (recuperar devolvía una cuenta a medias) o se
// quedaban huérfanas para siempre.
//
// LA REGLA: sólo la importa app/api/cron/limpieza/route.ts, protegida por
// CRON_SECRET. lib/contrato-llave-servicio.test.ts lo impide en cualquier otro
// archivo. Esta llave se salta TODA la RLS: nunca en un componente, nunca en una
// ruta que responda a una persona, nunca en el navegador.
//
// Riesgo marginal, dicho claro: en Vercel ya vive DATABASE_URL, que abre toda la
// base; esta llave suma los archivos de Storage.

/** Cliente con la llave de servicio, o null si falta la variable (la limpieza falla cerrada). */
export function clienteDeServicio(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) return null;
  if (typeof window !== "undefined") throw new Error("la llave de servicio no puede usarse en el navegador");
  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
