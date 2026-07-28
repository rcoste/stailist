// Arregla los renders del catálogo que se generaron CUADRADOS (1:1).
//
// El bug (0.2.36.2): las imágenes se generaban 1:1 pero se muestran en un hueco
// 3:4 con object-cover, así que el navegador las ampliaba ~33% y les recortaba
// los lados — la prenda salía grande, apretada y corta (lo cachó Roberto con un
// polo negro). El generador ya pide 3:4 desde entonces, pero 98 de 102 imágenes
// del catálogo son anteriores al fix.
//
// Por qué RELLENAR y no regenerar: catalog_renders solo guarda `key` y `path`.
// La descripción con la que se generó cada imagen (nombre, categoría, formalidad,
// detalle visual del estilista) NO se guarda, así que regenerar obligaría a
// reconstruirla a ciegas desde tipo+color+género y saldrían imágenes DISTINTAS,
// probablemente peores, además de ~98 llamadas de pago. Rellenar es exacto,
// determinista, gratis y conserva la prenda tal cual: solo añade fondo arriba y
// abajo hasta el 3:4 para que el hueco deje de recortarla.
//
// El relleno REPLICA el borde (extendWith: "copy") en vez de pintar un color
// plano. Se probó primero muestreando el color de una esquina y salió mal: el
// papel de los flat-lays tiene viñeteado, así que la esquina es más oscura que el
// centro y aparecían dos bandas grises evidentes. Copiando la fila del borde, el
// degradado del papel continúa y la unión no se ve.
//
// Por qué escribe en una RUTA NUEVA en vez de sobrescribir: el bucket `catalog`
// solo tiene políticas de lectura pública e inserción autenticada — no hay UPDATE
// ni DELETE, así que un upsert falla. (El service key del .env quedó en el formato
// viejo tras la migración de llaves de Supabase y ya no sirve.) Así que sube
// `<key>__34.jpg` y reapunta catalog_renders.path por SQL. Las imágenes viejas
// quedan huérfanas en el bucket; son ~20 MB y se pueden limpiar cuando la llave
// de servicio vuelva a funcionar.
//
// Uso:  node scripts/fix-catalog-aspect.mjs --dry     (solo reporta)
//       node scripts/fix-catalog-aspect.mjs           (escribe)
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
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

const BUCKET = "catalog";
const DRY = process.argv.includes("--dry");

// Storage: sesión de un usuario real (la inserción pide estar autenticado).
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: "roberto.dev@stailist.app",
  password: env.DEV_LOGIN_PASSWORD,
});
if (authErr) {
  console.error("no pude autenticarme:", authErr.message);
  process.exit(1);
}

// El registro va por SQL directo (DATABASE_URL), que es lo que sí funciona.
const db = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
const { rows } = await db.query("select key, path from catalog_renders order by created_at");
const publicUrl = (p) =>
  `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;

let cuadrados = 0;
let arreglados = 0;
let yaBien = 0;
const fallos = [];

for (const row of rows) {
  let buf;
  try {
    const res = await fetch(publicUrl(row.path));
    if (!res.ok) throw new Error(String(res.status));
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    fallos.push(`${row.path}: no se pudo bajar (${e.message})`);
    continue;
  }
  const meta = await sharp(buf).metadata();
  const ratio = meta.width / meta.height;

  // Ya es 3:4 (o más alto) → nada que hacer.
  if (ratio < 0.98) {
    yaBien++;
    continue;
  }
  cuadrados++;

  // Alto objetivo para dejarla en 3:4 conservando el ancho.
  const alto = Math.round(meta.width * (4 / 3));
  const falta = alto - meta.height;
  const arriba = Math.floor(falta / 2);

  const salida = await sharp(buf)
    .extend({ top: arriba, bottom: falta - arriba, left: 0, right: 0, extendWith: "copy" })
    .jpeg({ quality: 88 })
    .toBuffer();

  if (DRY) {
    console.log(
      `· ${row.path}  ${meta.width}x${meta.height} → ${meta.width}x${alto}`
    );
    continue;
  }

  const nuevo = row.path.replace(/\.jpg$/, "__34.jpg");
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(nuevo, salida, { contentType: "image/jpeg", upsert: false });
  // Si ya existía (re-corrida), seguimos: lo que importa es que el registro apunte ahí.
  if (upErr && !/exist|dupl/i.test(upErr.message)) {
    fallos.push(`${row.path}: ${upErr.message}`);
    continue;
  }
  await db.query("update catalog_renders set path=$2 where key=$1", [row.key, nuevo]);
  arreglados++;
  if (arreglados % 10 === 0) console.log(`  ${arreglados} arregladas…`);
}

console.log(`\ntotal: ${rows.length}`);
console.log(`ya estaban en 3:4: ${yaBien}`);
console.log(`cuadradas: ${cuadrados}`);
console.log(DRY ? "(dry-run, no se escribió nada)" : `arregladas: ${arreglados}`);
if (fallos.length) {
  console.log(`\nfallos (${fallos.length}):`);
  fallos.forEach((f) => console.log("  " + f));
}
await db.end();
