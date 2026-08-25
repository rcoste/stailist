// Backfill del apetito de acentos para usuarios que YA hicieron swipes.
//
// Lee los swipes crudos de events (onboarding_step, data.swipes — el último
// gana), deriva con la MISMA función que usa el onboarding (lib/looks.ts) y
// escribe profiles.acento_apetito SOLO donde está NULL: si alguien ya lo
// corrigió a mano, el manual gana y esto no lo pisa.
//
// Uso: node scripts/backfill-acento-apetito.mjs [--dry]
import { readFileSync } from "node:fs";
import pg from "pg";
import { apetitoDeAcentos } from "../lib/looks.ts";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
const url = envLine.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const dry = process.argv.includes("--dry");

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(`
  select e.user_id, u.email, e.data->'swipes' as swipes, e.created_at
  from events e
  join auth.users u on u.id = e.user_id
  join profiles p on p.id = e.user_id
  where e.type = 'onboarding_step' and e.data ? 'swipes'
    and p.acento_apetito is null
  order by e.created_at
`);

const porUser = new Map();
for (const r of rows) if (Array.isArray(r.swipes)) porUser.set(r.user_id, r);

let n = 0;
for (const [userId, r] of porUser) {
  const apetito = apetitoDeAcentos(r.swipes);
  console.log(`${r.email.padEnd(34)} → ${apetito}`);
  if (!dry) {
    await client.query(
      `update profiles set acento_apetito = $1 where id = $2 and acento_apetito is null`,
      [apetito, userId]
    );
  }
  n++;
}
console.log(`\n${dry ? "(dry run) " : ""}${n} perfiles ${dry ? "se derivarían" : "derivados"}`);
await client.end();
