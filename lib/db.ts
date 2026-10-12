import { Pool, type PoolClient } from "pg";

// Acceso directo a Postgres (DATABASE_URL) para procesos server-side SIN sesión
// de usuario, donde RLS no aplica y el acceso ya está protegido por otra vía:
// los crons (CRON_SECRET), la baja de correo (token único) y las pantallas del
// admin (requireAdmin). La app normal NO usa esto — va por Supabase JS + RLS.
//
// UN POOL, NO UN CLIENT POR LLAMADA (2026-10-12). Nació como "un client por
// invocación" cuando sólo lo usaba el cron semanal; después el admin entero
// pasó a Postgres directo y cada pantalla hacía dos o tres llamadas. Medido:
// abrir la conexión cuesta ~1 s (TLS contra Supabase), así que una consulta de
// 173 filas tardaba 1.25 s y la lista de Personas, con tres llamadas, 3 s de
// servidor sin señal en pantalla. Con el pool la conexión se reutiliza
// mientras la instancia viva (en Vercel las instancias se reutilizan entre
// peticiones), y las llamadas siguientes cuestan lo que la consulta.
//
// `max: 3` a propósito: el admin lo usa una persona, y Supabase limita las
// conexiones directas. El cliente que se entrega es exclusivo mientras dura
// `fn`, así que una transacción (begin/commit en lib/borrador-adoptar.ts) sigue
// siendo segura.

let pool: Pool | null = null;

function elPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL ausente");
    pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 60_000, keepAlive: true });
    // Un error en una conexión ociosa no debe tumbar el proceso.
    pool.on("error", (e) => console.error("[db] conexión ociosa falló:", e.message));
  }
  return pool;
}

export async function withDb<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await elPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
