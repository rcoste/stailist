// Corre SQL contra la DB de Supabase usando DATABASE_URL de .env.local.
// Uso:  node scripts/db.mjs supabase/migrations/0003_x.sql
//       node scripts/db.mjs -c "select count(*) from public.archetypes"
import { readFileSync } from "node:fs";
import pg from "pg";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
if (!envLine) {
  console.error("No encontré DATABASE_URL en .env.local");
  process.exit(1);
}
const url = envLine.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");

const [flagOrFile, inline] = process.argv.slice(2);
if (!flagOrFile) {
  console.error("Uso: node scripts/db.mjs <archivo.sql>  |  -c \"<sql>\"");
  process.exit(1);
}
const sql = flagOrFile === "-c" ? inline : readFileSync(flagOrFile, "utf8");

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();
try {
  const res = await client.query(sql);
  for (const r of Array.isArray(res) ? res : [res]) {
    if (r.rows?.length) console.table(r.rows);
    else console.log(`${r.command} OK (${r.rowCount ?? 0} filas)`);
  }
} finally {
  await client.end();
}
