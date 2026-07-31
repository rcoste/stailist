// Sube las fotos de referencia ya filtradas al bucket privado y las registra
// en public.referencias, que es de donde el destilador las lee.
//
// El destilador arrancó leyendo del disco, y con eso solo servía sentado frente
// a la computadora. La curaduría son ~90 fotos por tanda y se hace en ratos
// muertos, desde el celular, así que las fotos tienen que estar en un servidor.
//
// El bucket es PRIVADO y solo admin lo lee (ver 0095): son fotos de terceros
// cosechadas de Pinterest. Privado + URL firmada equivale a un board privado;
// público sería redistribuirlas.
//
// Idempotente: `path` es unique y el insert hace on conflict do nothing, así
// que re-correrlo tras cosechar más fotos solo sube las nuevas.
//
// Uso: node scripts/subir-referencias.mjs [genero]   (default hombre)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const genero = process.argv[2] ?? "hombre";
const RAIZ = `docs_para_claude/cosecha-${genero}`;
if (!existsSync(RAIZ)) {
  console.error(`No existe ${RAIZ}`);
  process.exit(1);
}

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};

const supabase = createClient(
  leer("NEXT_PUBLIC_SUPABASE_URL"),
  leer("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
const db = new pg.Client({
  connectionString: leer("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const estilos = readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_descartadas")
  .map((e) => e.name);

let subidas = 0;
let yaEstaban = 0;
for (const estilo of estilos) {
  const dir = path.join(RAIZ, estilo);
  const fotos = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));

  for (const foto of fotos) {
    const destino = `${genero}/${estilo}/${foto}`;
    const { error } = await supabase.storage
      .from("referencias")
      .upload(destino, readFileSync(path.join(dir, foto)), {
        contentType: foto.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        upsert: false,
      });
    // "already exists" no es un fallo: es el caso normal al re-correr.
    if (error && !/exists/i.test(error.message)) {
      console.error(`  ⚠ ${destino}: ${error.message}`);
      continue;
    }
    const r = await db.query(
      `insert into public.referencias (estilo, genero, path)
       values ($1, $2, $3) on conflict (path) do nothing`,
      [estilo, genero, destino]
    );
    if (r.rowCount) subidas++;
    else yaEstaban++;
  }
  console.log(`${estilo}: ${fotos.length} fotos`);
}

const { rows } = await db.query(
  `select estilo, count(*) as total, count(sirve) as juzgadas
   from public.referencias where genero = $1 group by estilo order by estilo`,
  [genero]
);
console.table(rows);
console.log(`\n${subidas} nuevas, ${yaEstaban} ya estaban.`);
await db.end();
