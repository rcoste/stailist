// Borra objetos de storage que ya no referencia NADIE en la base.
//
// Dos fuentes de huérfanos conocidas:
//   · catalog — al arreglar las 98 imágenes cuadradas (0.2.45.0) se subió una
//     versión nueva `<key>__34.jpg` y el registro se reapuntó ahí; la vieja
//     `<key>.jpg` quedó suelta.
//   · prendas — al resetear una cuenta se borran las filas de items, pero sus
//     fotos siguen en el bucket.
//
// El criterio NO es el nombre ni la fecha, y TAMPOCO una lista de columnas
// escrita a mano: eso fue el primer intento y estuvo a punto de borrar 64
// imágenes vivas de una usuaria real porque olvidé library_candidates.image_path.
// Ahora el conjunto de rutas REFERENCIADAS se descubre solo: se recorren TODAS
// las columnas de texto y jsonb del esquema público y se recoge cualquier valor
// que parezca un archivo de imagen. Si mañana alguien agrega una columna o mete
// una ruta dentro de un jsonb, este script la respeta sin que nadie lo actualice.
//
// ALCANCE por defecto: SOLO lo que se puede justificar uno por uno —
//   · el bucket catalog entero (los duplicados que dejó el arreglo de aspecto);
//   · los archivos de cuentas que ya no existen.
// Los huérfanos de usuarios VIVOS (renders superados, try-ons de outfits
// borrados) se dejan en paz por defecto: son contenido de una persona real y el
// ahorro son unos megas — la relación riesgo/beneficio no da, sobre todo después
// de que la primera versión de este script casi borra 64 imágenes vivas.
// `--todo` los incluye, para cuando alguien lo decida a conciencia.
//
// Uso:  node scripts/limpiar-huerfanos.mjs --dry          (obligatorio verlo antes)
//       node scripts/limpiar-huerfanos.mjs                (alcance seguro)
//       node scripts/limpiar-huerfanos.mjs --todo --dry   (incluye usuarios vivos)
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");
const TODO = process.argv.includes("--todo");

const api = async (path, body) => {
  const r = await fetch(`${URL_BASE}/storage/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
};

// Lista TODO un bucket, paginando (la API tope a 100 por llamada).
async function listarTodo(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api(`/object/list/${bucket}`, { prefix, limit: 100, offset });
    if (!page.length) break;
    for (const o of page) {
      // Las "carpetas" vienen sin id; se recorren aparte.
      if (o.id) out.push(prefix ? `${prefix}${o.name}` : o.name);
      else out.push(...(await listarTodo(bucket, `${prefix}${o.name}/`)));
    }
    if (page.length < 100) break;
  }
  return out;
}

const db = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();

// ── Conjunto de rutas REFERENCIADAS (descubierto del esquema) ──────────────
const refs = new Set();
const IMG = /[\w./-]+\.(?:jpg|jpeg|png|webp)/gi;
const cosechar = (v) => {
  if (v == null) return;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  for (const m of s.match(IMG) ?? []) refs.add(m.replace(/^\/+/, ""));
};

const { rows: cols } = await db.query(`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and data_type in ('text','character varying','jsonb','json')
  order by table_name, column_name`);

for (const c of cols) {
  const { rows } = await db.query(
    `select "${c.column_name}"::text as v from public."${c.table_name}"
      where "${c.column_name}" is not null`
  );
  for (const r of rows) cosechar(r.v);
}
console.log(
  `referencias descubiertas: ${refs.size} (de ${cols.length} columnas de texto/jsonb)`
);

// Los avatares se resuelven por CONVENCIÓN de ruta, no por columna: se protegen.
for (const r of (await db.query("select id from public.profiles")).rows) {
  for (const n of ["avatar.jpg", "avatar-face.jpg", "avatar-sheet.jpg"]) {
    refs.add(`${r.id}/${n}`);
  }
}

// Cuentas vivas: sus archivos no se tocan salvo --todo.
const vivos = new Set(
  (await db.query("select id::text from public.profiles")).rows.map((r) => r.id)
);

let totalBorrados = 0;
for (const bucket of ["catalog", "prendas"]) {
  const objetos = await listarTodo(bucket);
  let huerfanos = objetos.filter((o) => !refs.has(o));
  if (bucket === "prendas" && !TODO) {
    const antes = huerfanos.length;
    huerfanos = huerfanos.filter((o) => !vivos.has(o.split("/")[0]));
    console.log(
      `\n(protegidos ${antes - huerfanos.length} archivos de cuentas vivas — usa --todo para incluirlos)`
    );
  }
  console.log(
    `\n${bucket}: ${objetos.length} objetos · ${huerfanos.length} huérfanos`
  );
  if (DRY) {
    huerfanos.slice(0, 8).forEach((h) => console.log("   ·", h));
    if (huerfanos.length > 8) console.log(`   … y ${huerfanos.length - 8} más`);
    continue;
  }
  for (let i = 0; i < huerfanos.length; i += 50) {
    const lote = huerfanos.slice(i, i + 50);
    await fetch(`${URL_BASE}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: lote }),
    });
    totalBorrados += lote.length;
  }
  console.log(`   borrados: ${huerfanos.length}`);
}

console.log(DRY ? "\n(dry-run, no se borró nada)" : `\ntotal borrado: ${totalBorrados}`);
await db.end();
