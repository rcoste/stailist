// Script de un solo uso: prende/apaga/consulta is_admin en un perfil por email.
// Usa la conexión directa de Postgres (DATABASE_URL) — ignora RLS.
// Uso:  node scripts/toggle-admin.mjs <email> <on|off|check>
// Ej.:  node scripts/toggle-admin.mjs claude.dev@stailist.app on
//       node scripts/toggle-admin.mjs claude.dev@stailist.app check   (solo lee)
import { readFileSync } from "node:fs";
import pg from "pg";

const [, , email, mode] = process.argv;
if (!email || (mode !== "on" && mode !== "off" && mode !== "check")) {
  console.error("Uso: node scripts/toggle-admin.mjs <email> <on|off|check>");
  process.exit(1);
}

// Lee DATABASE_URL de .env.local sin depender de dotenv.
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.error("No encontré DATABASE_URL en .env.local");
  process.exit(1);
}
const connectionString = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  if (mode === "check") {
    const res = await client.query(
      "select is_admin from profiles where email = $1",
      [email]
    );
    if (res.rowCount === 0) {
      console.log(`SIN PERFIL · no existe un perfil con email ${email}`);
    } else {
      console.log(`CHECK · ${email} → is_admin = ${res.rows[0].is_admin}`);
    }
    await client.end();
    process.exit(0);
  }

  const isAdmin = mode === "on";
  const res = await client.query(
    "update profiles set is_admin = $1 where email = $2",
    [isAdmin, email]
  );
  if (res.rowCount === 1) {
    console.log(`OK · ${email} → is_admin = ${isAdmin} (1 fila)`);
  } else if (res.rowCount === 0) {
    console.log(`SIN CAMBIOS · no existe un perfil con email ${email} (0 filas)`);
  } else {
    console.log(`OJO · ${res.rowCount} filas cambiadas (esperaba 1)`);
  }
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
