// Crea 2 usuarios de PRUEBA LOCAL con contraseña, para entrar en dev sin magic
// link. NO son correos reales de personas (para no ponerle contraseña a la
// cuenta real de nadie en la DB compartida). La contraseña se genera una vez
// y se guarda en .env.local (gitignored). Idempotente: re-correr no rompe nada.
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { readFileSync, appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DB = env.DATABASE_URL;

let pwd = env.DEV_LOGIN_PASSWORD;
if (!pwd) {
  pwd = "Dev-" + randomUUID();
  appendFileSync(
    ".env.local",
    `\n# Contraseña de los usuarios de prueba locales (solo dev, NUNCA en prod)\nDEV_LOGIN_PASSWORD=${pwd}\n`
  );
  console.log("Generé DEV_LOGIN_PASSWORD y lo guardé en .env.local");
}

const USERS = ["roberto.dev@stailist.app", "claude.dev@stailist.app"];

const pgc = new pg.Client({
  connectionString: DB,
  ssl: { rejectUnauthorized: false },
});
await pgc.connect();

// La allowlist (y su trigger) exige que el correo esté permitido ANTES del alta.
for (const email of USERS) {
  await pgc.query(
    "insert into public.allowlist (email, invited_by) values ($1,'dev-local') on conflict do nothing",
    [email]
  );
}

const supabase = createClient(URL, ANON);
for (const email of USERS) {
  const { rows } = await pgc.query(
    "select id from auth.users where email=$1",
    [email]
  );
  if (rows.length === 0) {
    const { error } = await supabase.auth.signUp({ email, password: pwd });
    console.log(error ? `signUp ${email}: ${error.message}` : `creado ${email}`);
  } else {
    console.log(`ya existe ${email}`);
  }
}

// Confirmar correos para que signInWithPassword funcione (sin paso de correo).
await pgc.query(
  "update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where email = any($1)",
  [USERS]
);
console.log("Usuarios de prueba listos:", USERS.join(", "));
await pgc.end();
