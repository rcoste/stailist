// Quita referencias VISUALMENTE duplicadas de la cosecha.
//
// POR QUÉ NO BASTABA EL DEDUP QUE YA HABÍA
// La cosecha deduplica por el hash del archivo de Pinterest, y eso solo cacha
// la misma URL dos veces. Pero la misma foto re-subida por otra persona —cosa
// normalísima en Pinterest— llega con otro nombre, así que pasaba como nueva.
// Resultado: la misma imagen aparecía varias veces en el swipe, que además de
// molesto sesga la destilación (un look repetido cuenta como patrón).
//
// Se compara el CONTENIDO con dHash: se reduce la imagen a 9x8 en grises y se
// guarda si cada pixel es más claro que el de su derecha. Da 64 bits robustos a
// cambios de tamaño, compresión y recortes leves — que es exactamente cómo
// difieren las copias de una misma foto.
//
// NO borra: marca las duplicadas en la base con motivo 'duplicada' para que
// salgan del swipe, y respeta lo ya juzgado a mano.
//
// Uso: node scripts/dedup-referencias.mjs [genero]

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import pg from "pg";

const genero = process.argv[2] ?? "hombre";
const RAIZ = `docs_para_claude/cosecha-${genero}`;
// 8 bits, calibrado a ojo contra los pares reales, no elegido de memoria: a
// d=0 y d=7 son la misma foto o dos tomas de la misma sesión; de d=9 en
// adelante ya son outfits distintos (un overshirt gris contra una chamarra
// café) que compartían composición y encuadre. Subirlo a 12 pescaría algún
// duplicado más a cambio de borrar referencias buenas — mal negocio.
const UMBRAL = 8;

const env = readFileSync(".env.local", "utf8");
const leer = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(k + "="));
  return l ? l.slice(k.length + 1).trim().replace(/^"|"$/g, "") : null;
};

const db = new pg.Client({
  connectionString: leer("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
});
await db.connect();

// Solo las PENDIENTES: lo que ya se juzgó a mano no se toca. Si alguien aprobó
// una foto y su duplicada sigue pendiente, gana la aprobada.
const { rows } = await db.query(
  `select id, estilo, path, sirve from public.referencias
   where genero = $1 order by estilo, (sirve is null), path`,
  [genero]
);

const dhash = (ruta) => {
  try {
    return execFileSync("python3", [
      "-c",
      `from PIL import Image
im = Image.open("${ruta}").convert("L").resize((9, 8), Image.LANCZOS)
p = list(im.get_flattened_data() if hasattr(im,"get_flattened_data") else im.getdata())
bits = [1 if p[r*9+c] > p[r*9+c+1] else 0 for r in range(8) for c in range(8)]
print("".join(map(str, bits)))`,
    ])
      .toString()
      .trim();
  } catch {
    return null;
  }
};

const distancia = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
};

const porEstilo = new Map();
for (const r of rows) {
  if (!porEstilo.has(r.estilo)) porEstilo.set(r.estilo, []);
  porEstilo.get(r.estilo).push(r);
}

let total = 0;
for (const [estilo, fotos] of porEstilo) {
  const vistas = []; // { hash, id }
  const duplicadas = [];

  for (const f of fotos) {
    const archivo = f.path.split("/").pop();
    const h = dhash(`${RAIZ}/${estilo}/${archivo}`);
    if (!h) continue;
    const gemela = vistas.find((v) => distancia(v.hash, h) <= UMBRAL);
    if (gemela) {
      // Solo se descarta si está PENDIENTE. Una foto ya juzgada a mano se
      // respeta aunque tenga gemela: el juicio humano manda sobre el dedup.
      if (f.sirve === null) duplicadas.push(f.id);
    } else {
      vistas.push({ hash: h, id: f.id });
    }
  }

  if (duplicadas.length) {
    await db.query(
      `update public.referencias set sirve = false, motivo = 'duplicada'
       where id = any($1::uuid[])`,
      [duplicadas]
    );
    total += duplicadas.length;
  }
  console.log(`${estilo}: ${duplicadas.length} duplicadas de ${fotos.length}`);
}

console.log(`\n${total} duplicadas marcadas en total.`);
await db.end();
