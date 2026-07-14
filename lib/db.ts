import { Client } from "pg";

// Acceso directo a Postgres (DATABASE_URL) para procesos server-side SIN sesión
// de usuario, donde RLS no aplica y el acceso ya está protegido por otra vía:
// el cron del correo semanal (CRON_SECRET) y la baja de correo (token único).
// La app normal NO usa esto — va por Supabase JS + RLS con la sesión del usuario.
//
// Un client por invocación (conecta → corre → cierra). Es un cron semanal y
// clics de baja esporádicos: no vale la pena un pool persistente.
export async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL ausente");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
